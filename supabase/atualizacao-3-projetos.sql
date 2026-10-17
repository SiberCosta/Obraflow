-- =========================================================
-- ObraFlow · Atualização 3: vários projetos, cada um com a sua equipa
-- Corre DEPOIS da atualização 2 (acessos e notificações).
-- Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode correr-se mais de uma vez sem estragar nada (se já correste uma versão anterior, corre de novo: acrescenta papéis por obra e convites).
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

-- ---------- papéis por obra: Administrador · Membro · Seguidor ----------
alter table public.project_members add column if not exists role text not null default 'membro';
do $$ begin
  alter table public.project_members add constraint project_members_role_chk check (role in ('admin','membro','seguidor'));
exception when duplicate_object then null; end $$;
-- quem já tinha acesso: coordenação → Administrador da obra; leitura → Seguidor; restantes → Membro (só na 1.ª vez)
update public.project_members pm set role = case when m.role in ('admin','coord') then 'admin' when m.role = 'leitura' then 'seguidor' else 'membro' end
  from public.members m
 where m.user_id = pm.user_id and pm.role = 'membro' and not exists (select 1 from public.project_members x where x.role <> 'membro');

create or replace function public.proj_role(p text) returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then 'admin'
              else (select pm.role from public.project_members pm join public.members m on m.user_id = pm.user_id
                     where pm.project_id = p and pm.user_id = auth.uid() and m.role <> 'pendente') end
$$;
create or replace function public.proj_can_write(p text) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.proj_role(p) in ('admin','membro'), false) $$;
create or replace function public.proj_is_admin(p text) returns boolean
language sql stable security definer set search_path = public as $$ select coalesce(public.proj_role(p) = 'admin', false) $$;

create or replace function public.project_add_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into public.project_members (project_id, user_id, role) values (new.id, auth.uid(), 'admin')
    on conflict (project_id, user_id) do update set role = 'admin';
  end if;
  return new;
end $$;

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert with check (public.is_active() and public.proj_can_write(project));
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update
  using (public.is_active() and public.proj_can_write(project)) with check (public.is_active() and public.proj_can_write(project));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update using (public.proj_is_admin(id)) with check (public.proj_is_admin(id));
drop policy if exists pm_insert on public.project_members;
create policy pm_insert on public.project_members for insert with check (public.proj_is_admin(project_id));
drop policy if exists pm_update on public.project_members;
create policy pm_update on public.project_members for update using (public.proj_is_admin(project_id)) with check (public.proj_is_admin(project_id));
drop policy if exists pm_delete on public.project_members;
create policy pm_delete on public.project_members for delete using (public.proj_is_admin(project_id));

-- ---------- convites para entrar numa obra (link, QR code ou email) ----------
create table if not exists public.project_invites (
  token        text primary key,
  project_id   text not null references public.projects(id) on delete cascade,
  role         text not null default 'membro' check (role in ('admin','membro','seguidor')),
  email        text not null default '',
  max_uses     int,
  uses         int not null default 0,
  revoked      boolean not null default false,
  expires_at   timestamptz default now() + interval '30 days',
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  last_used_by uuid,
  last_used_at timestamptz
);
alter table public.project_invites enable row level security;
drop policy if exists inv_select on public.project_invites;
create policy inv_select on public.project_invites for select using (public.proj_is_admin(project_id));
drop policy if exists inv_insert on public.project_invites;
create policy inv_insert on public.project_invites for insert with check (public.proj_is_admin(project_id) and length(token) >= 16);
drop policy if exists inv_update on public.project_invites;
create policy inv_update on public.project_invites for update using (public.proj_is_admin(project_id)) with check (public.proj_is_admin(project_id));
drop policy if exists inv_delete on public.project_invites;
create policy inv_delete on public.project_invites for delete using (public.proj_is_admin(project_id));
grant select, insert, update, delete on public.project_invites to authenticated;

-- informação pública mínima do convite (para a página de entrada mostrar "convidado para a obra X")
create or replace function public.invite_info(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i public.project_invites;
begin
  select * into i from public.project_invites where token = p_token;
  if not found or i.revoked or (i.expires_at is not null and i.expires_at < now()) or (i.max_uses is not null and i.uses >= i.max_uses) then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'name', (select name from public.projects where id = i.project_id), 'role', i.role, 'email', i.email);
end $$;
grant execute on function public.invite_info(text) to anon, authenticated;

-- aceitar o convite: entra na obra com o papel do convite; uma conta nova fica logo aprovada
create or replace function public.accept_invite(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare i public.project_invites; me uuid := auth.uid(); my_email text;
begin
  if me is null then return jsonb_build_object('ok', false, 'erro', 'Entra primeiro com a tua conta.'); end if;
  select * into i from public.project_invites where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Convite inválido.'); end if;
  if i.revoked or (i.expires_at is not null and i.expires_at < now()) then return jsonb_build_object('ok', false, 'erro', 'Este convite já não é válido.'); end if;
  if i.max_uses is not null and i.uses >= i.max_uses then return jsonb_build_object('ok', false, 'erro', 'Este convite já foi usado.'); end if;
  select email into my_email from auth.users where id = me;
  if i.email <> '' and lower(i.email) <> lower(coalesce(my_email, '')) then
    return jsonb_build_object('ok', false, 'erro', 'Este convite foi enviado para ' || i.email || '. Entra com esse email.');
  end if;
  insert into public.project_members (project_id, user_id, role) values (i.project_id, me, i.role)
  on conflict (project_id, user_id) do update set role = case when public.project_members.role = 'admin' then 'admin'
                                                               when excluded.role = 'admin' then 'admin'
                                                               when public.project_members.role = 'membro' or excluded.role = 'membro' then 'membro'
                                                               else 'seguidor' end;
  update public.members set role = case when i.role = 'seguidor' then 'leitura' else 'tecnico' end where user_id = me and role = 'pendente';
  update public.project_invites set uses = uses + 1, last_used_by = me, last_used_at = now() where token = p_token;
  return jsonb_build_object('ok', true, 'project', i.project_id, 'name', (select name from public.projects where id = i.project_id), 'role', i.role);
end $$;
grant execute on function public.accept_invite(text) to authenticated;

-- tempo real para a lista de projetos
do $$ begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.project_members; exception when duplicate_object then null; end $$;

select 'Atualização 3 instalada: ' || (select count(*) from public.projects) || ' projeto(s).' as resultado;
