-- =========================================================
-- ObraFlow · Atualização 3: vários projetos, cada um com a sua equipa
-- Corre DEPOIS da atualização 2 (acessos e notificações).
-- Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode correr-se mais de uma vez sem estragar nada.
--
-- O que muda:
--  * nova tabela "projects" (obras) e "project_members" (quem tem acesso a cada obra);
--  * todos os dados (plantas, equipamentos, anomalias, documentos) passam a pertencer a um projeto;
--  * os dados que já existem ficam no primeiro projeto, com acesso para todas as contas aprovadas;
--  * cada pessoa só vê e altera as obras a que tem acesso (o Administrador vê todas);
--  * as notificações por email só vão para quem tem acesso à obra.
-- =========================================================

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'can_write' and pronamespace = 'public'::regnamespace) then
    raise exception 'Corre primeiro o ficheiro atualizacao-2-acessos-notificacoes.sql e depois este.';
  end if;
end $$;

-- ---------- projetos ----------
create table if not exists public.projects (
  id         text primary key,
  name       text not null default 'Obra',
  client     text not null default '',
  address    text not null default '',
  status     text not null default 'em_curso' check (status in ('em_curso','pausa','concluido')),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_members (
  project_id text not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.members(user_id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- ---------- os dados passam a ter projeto ----------
alter table public.docs add column if not exists project text not null default 'p0';

do $$
declare pk text;
begin
  select conname into pk from pg_constraint where conrelid = 'public.docs'::regclass and contype = 'p';
  if pk is not null and (select array_length(conkey,1) from pg_constraint where conname = pk and conrelid = 'public.docs'::regclass) = 2 then
    execute format('alter table public.docs drop constraint %I', pk);
    alter table public.docs add primary key (project, col, id);
  end if;
end $$;
create index if not exists docs_project_updated on public.docs (project, updated_at);

-- primeiro projeto com os dados que já existiam
insert into public.projects (id, name, client, address)
select 'p0',
       coalesce((select data->>'name' from public.docs where col = 'meta' and id = 'project' and project = 'p0' limit 1), 'A minha obra'),
       coalesce((select data->>'client' from public.docs where col = 'meta' and id = 'project' and project = 'p0' limit 1), ''),
       coalesce((select data->>'address' from public.docs where col = 'meta' and id = 'project' and project = 'p0' limit 1), '')
on conflict (id) do nothing;

insert into public.project_members (project_id, user_id)
select 'p0', user_id from public.members where role <> 'pendente'
on conflict do nothing;

-- ---------- regras de acesso ----------
create or replace function public.in_project(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.project_members pm
                  join public.members m on m.user_id = pm.user_id
                 where pm.project_id = p and pm.user_id = auth.uid() and m.role <> 'pendente')
$$;

-- quem cria um projeto fica logo com acesso a ele
create or replace function public.project_add_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into public.project_members (project_id, user_id) values (new.id, auth.uid()) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists project_add_creator on public.projects;
create trigger project_add_creator after insert on public.projects
  for each row execute function public.project_add_creator();

create or replace function public.projects_touch() returns trigger
language plpgsql as $$ begin new.updated_at := clock_timestamp(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.projects_touch();

alter table public.projects enable row level security;
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (public.is_active() and public.in_project(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert with check (public.is_coord());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using (public.is_coord() and public.in_project(id)) with check (public.is_coord() and public.in_project(id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete using (public.is_admin());

alter table public.project_members enable row level security;
drop policy if exists pm_select on public.project_members;
create policy pm_select on public.project_members for select using (public.is_active());
drop policy if exists pm_insert on public.project_members;
create policy pm_insert on public.project_members for insert with check (public.is_coord() and public.in_project(project_id));
drop policy if exists pm_delete on public.project_members;
create policy pm_delete on public.project_members for delete using (public.is_coord() and public.in_project(project_id));

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select using (public.is_active() and public.in_project(project));
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert with check (public.can_write() and public.in_project(project));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update
  using (public.can_write() and public.in_project(project)) with check (public.can_write() and public.in_project(project));

grant select, insert, update, delete on public.projects, public.project_members to authenticated;

-- ---------- notificações: só para quem tem acesso à obra ----------
create or replace function public.notif_on_docs() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  actor uuid := auth.uid();
  pj text := new.project;
  who text; code text; pname text; st text; r record; uid_re text := '^[0-9a-fA-F-]{36}$'; obra text;
begin
  begin
    if new.deleted then return new; end if;
    select name into who from public.members where user_id = actor;
    who := coalesce(who, 'Alguém');
    select name into obra from public.projects where id = pj;
    obra := coalesce(obra, 'Obra');

    if new.col = 'items' then
      code := coalesce(n->>'devId', '') ;
      code := coalesce(n->>'code', '?') || case when code <> '' then ' (ID ' || code || ')' else '' end;
      select data->>'name' into pname from public.docs where project = pj and col = 'plans' and id = n->>'planId';
      if coalesce(n->>'assignee','') ~ uid_re and coalesce(n->>'assignee','') is distinct from coalesce(o->>'assignee','')
         and (n->>'assignee')::uuid is distinct from actor then
        perform public.notif_add((n->>'assignee')::uuid, 'atribuido', obra || ' · Atribuído a ti: ' || code,
          who || ' atribuiu-te ' || code || ' em ' || coalesce(pname,'?') || coalesce('. Prazo: ' || (n->>'due'), '') || '.');
      end if;
      st := n->>'stage';
      if tg_op = 'UPDATE' and st is distinct from (o->>'stage') then
        if st = 'testado' then
          for r in select m.user_id from public.members m join public.project_members pm on pm.user_id = m.user_id and pm.project_id = pj
                    where m.role in ('coord','admin') and m.user_id is distinct from actor loop
            perform public.notif_add(r.user_id, 'etapas', obra || ' · Para validar: ' || code, who || ' marcou ' || code || ' como Testado em ' || coalesce(pname,'?') || '.');
          end loop;
        elsif st = 'validado' then
          for r in select m.user_id from public.members m join public.project_members pm on pm.user_id = m.user_id and pm.project_id = pj
                    where m.role = 'fiscal' and m.user_id is distinct from actor loop
            perform public.notif_add(r.user_id, 'etapas', obra || ' · Para aceitar: ' || code, who || ' validou ' || code || ' em ' || coalesce(pname,'?') || '.');
          end loop;
        elsif st = 'aceite' then
          for r in select m.user_id from public.members m join public.project_members pm on pm.user_id = m.user_id and pm.project_id = pj
                    where m.role in ('coord','admin') and m.user_id is distinct from actor loop
            perform public.notif_add(r.user_id, 'etapas', obra || ' · Aceite: ' || code, who || ' aceitou ' || code || ' em ' || coalesce(pname,'?') || '.');
          end loop;
        end if;
      end if;

    elsif new.col = 'issues' then
      select data->>'code' into code from public.docs where project = pj and col = 'items' and id = n->>'itemId';
      select data->>'name' into pname from public.docs where project = pj and col = 'plans' and id = n->>'planId';
      if coalesce(o->>'text','') = '' then
        for r in select m.user_id from public.members m join public.project_members pm on pm.user_id = m.user_id and pm.project_id = pj
                  where (m.role in ('coord','admin') or (coalesce(n->>'assignee','') ~ uid_re and m.user_id = (n->>'assignee')::uuid))
                    and m.user_id is distinct from actor loop
          perform public.notif_add(r.user_id, 'anomalia', obra || ' · Anomalia: ' || coalesce(code,'?'),
            who || ' registou em ' || coalesce(code,'?') || ' (' || coalesce(pname,'?') || '): ' || left(coalesce(n->>'text',''), 300));
        end loop;
      elsif n->>'status' = 'resolvida' and coalesce(o->>'status','') <> 'resolvida'
            and coalesce(n->>'createdBy','') ~ uid_re and (n->>'createdBy')::uuid is distinct from actor then
        perform public.notif_add((n->>'createdBy')::uuid, 'anomalia', obra || ' · Anomalia resolvida: ' || coalesce(code,'?'),
          who || ' resolveu: ' || left(coalesce(n->>'text',''), 300));
      end if;

    elsif new.col = 'plans' then
      if tg_op = 'INSERT' or coalesce(n->>'img','') is distinct from coalesce(o->>'img','') then
        for r in select m.user_id from public.members m join public.project_members pm on pm.user_id = m.user_id and pm.project_id = pj
                  where m.role <> 'pendente' and m.user_id is distinct from actor loop
          perform public.notif_add(r.user_id, 'plantas',
            obra || ' · ' || case when tg_op = 'INSERT' or coalesce(o->>'img','') = '' then 'Planta nova: ' else 'Planta trocada: ' end || coalesce(n->>'name','?'),
            who || case when tg_op = 'INSERT' or coalesce(o->>'img','') = '' then ' carregou a planta ' else ' trocou a planta ' end || coalesce(n->>'name','?') || '.');
        end loop;
      end if;
      for r in select value::text as v from jsonb_array_elements_text(coalesce(n->'assignees','[]'::jsonb))
                where value ~ uid_re and not coalesce(o->'assignees','[]'::jsonb) ? value loop
        if r.v::uuid is distinct from actor then
          perform public.notif_add(r.v::uuid, 'atribuido', obra || ' · Piso atribuído: ' || coalesce(n->>'name','?'), who || ' atribuiu-te o piso ' || coalesce(n->>'name','?') || '.');
        end if;
      end loop;
    end if;
  exception when others then
    null;
  end;
  return new;
end $$;

-- tempo real para a lista de projetos
do $$ begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.project_members; exception when duplicate_object then null; end $$;

select 'Atualização 3 instalada: ' || (select count(*) from public.projects) || ' projeto(s).' as resultado;
