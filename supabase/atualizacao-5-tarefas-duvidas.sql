-- =========================================================
-- ObraFlow · Atualização 5: tarefas e dúvidas na planta (gotas) e notificações
-- Corre DEPOIS das atualizações 2, 3 e 4.
-- Supabase → SQL Editor → New query → colar tudo → Run. Pode correr-se mais de uma vez.
--
-- O que muda nos emails:
--  * criar uma tarefa ou dúvida com responsável → email "Tarefa/Dúvida para ti" a essa pessoa;
--  * nova dúvida → email à coordenação e aos administradores da obra;
--  * resposta ou comentário numa tarefa/dúvida → email a quem a criou e ao responsável;
--  * tarefa concluída / dúvida respondida → email a quem a criou e ao responsável;
--  * seguidores recebem as respostas, conclusões e verificações; quem é adicionado como seguidor é avisado;
--  * tarefa verificada → email ao responsável e aos seguidores;
--  * os emails dizem "Tarefa", "Dúvida" ou "Anomalia" conforme o caso.
-- (Não há tabelas novas: as tarefas e dúvidas ficam junto das anomalias.)
-- =========================================================

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'notif_mentions' and pronamespace = 'public'::regnamespace) then
    raise exception 'Corre primeiro as atualizações 2, 3 e 4 e depois esta.';
  end if;
end $$;

create or replace function public.notif_on_docs() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  actor uuid := auth.uid();
  pj text := new.project;
  who text; code text; pname text; st text; kn text; lab text; r record; uid_re text := '^[0-9a-fA-F-]{36}$'; obra text;
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

    elsif new.col = 'issues' and coalesce(n->>'kind','') in ('tarefa','duvida') then
      -- tarefas e dúvidas marcadas na planta
      kn := case when n->>'kind' = 'duvida' then 'Dúvida' else 'Tarefa' end;
      lab := kn || coalesce(' #' || (n->>'seq'), '') || ' «' || left(coalesce(n->>'title', ''), 120) || '»';
      select data->>'name' into pname from public.docs where project = pj and col = 'plans' and id = n->>'planId';
      if tg_op = 'INSERT' or coalesce(o->>'title', '') = '' then
        if coalesce(n->>'assignee','') ~ uid_re and (n->>'assignee')::uuid is distinct from actor then
          perform public.notif_add((n->>'assignee')::uuid, 'atribuido', obra || ' · ' || kn || ' para ti: ' || left(coalesce(n->>'title',''), 80),
            who || ' atribuiu-te ' || 'a ' || lower(left(lab,1)) || substr(lab,2) || ' em ' || coalesce(pname,'?') || coalesce('. Prazo: ' || nullif(n->>'due',''), '')
            || coalesce('. ' || nullif(left(n->>'text', 300), ''), '') || '.');
        end if;
        if n->>'kind' = 'duvida' then
          for r in select distinct m.user_id from public.members m join public.project_members pm on pm.user_id = m.user_id and pm.project_id = pj
                    where (m.role in ('coord','admin') or pm.role = 'admin') and m.user_id is distinct from actor
                      and m.user_id::text is distinct from coalesce(n->>'assignee','') loop
            perform public.notif_add(r.user_id, 'anomalia', obra || ' · Nova dúvida: ' || left(coalesce(n->>'title',''), 80),
              who || ' colocou uma dúvida em ' || coalesce(pname,'?') || coalesce(': ' || nullif(left(n->>'text', 300), ''), ''));
          end loop;
        end if;
      elsif coalesce(n->>'verifiedAt','') <> '' and coalesce(o->>'verifiedAt','') = '' then
        for r in select distinct x::uuid as u from unnest(array[n->>'createdBy', n->>'assignee'] || array(select jsonb_array_elements_text(coalesce(n->'followers','[]'::jsonb)))) x
                  where x ~ uid_re and x::uuid is distinct from actor loop
          perform public.notif_add(r.u, 'anomalia', obra || ' · ' || kn || ' verificada: ' || left(coalesce(n->>'title',''), 80),
            who || ' verificou a ' || lower(left(lab,1)) || substr(lab,2) || '.');
        end loop;
      elsif n->>'status' = 'resolvida' and coalesce(o->>'status','') <> 'resolvida' then
        for r in select distinct x::uuid as u from unnest(array[n->>'createdBy', n->>'assignee'] || array(select jsonb_array_elements_text(coalesce(n->'followers','[]'::jsonb)))) x
                  where x ~ uid_re and x::uuid is distinct from actor loop
          perform public.notif_add(r.u, 'anomalia', obra || ' · ' || kn || case when n->>'kind' = 'duvida' then ' respondida: ' else ' concluída: ' end || left(coalesce(n->>'title',''), 80),
            who || case when n->>'kind' = 'duvida' then ' marcou como respondida ' else ' concluiu ' end || 'a ' || lower(left(lab,1)) || substr(lab,2) || '.');
        end loop;
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

create or replace function public.notif_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  actor uuid := auth.uid();
  who text; obra text; what text; txt text; r record; kn text; nm text[] := '{}'; c jsonb; uid_re text := '^[0-9a-fA-F-]{36}$'; icode text;
begin
  begin
    if new.deleted then return new; end if;
    select name into who from public.members where user_id = actor;
    who := coalesce(who, 'Alguém');
    select name into obra from public.projects where id = new.project;
    obra := coalesce(obra, 'Obra');
    if new.col = 'issues' then
      select data->>'code' into icode from public.docs where project = new.project and col = 'items' and id = n->>'itemId';
    end if;
    what := case when new.col = 'items' then coalesce(n->>'code', 'um equipamento')
                 when new.col = 'issues' and n->>'kind' = 'duvida' then 'a dúvida' || coalesce(' #' || (n->>'seq'), '') || ' «' || left(coalesce(n->>'title',''), 80) || '»'
                 when new.col = 'issues' and n->>'kind' = 'tarefa' then 'a tarefa' || coalesce(' #' || (n->>'seq'), '') || ' «' || left(coalesce(n->>'title',''), 80) || '»'
                 when new.col = 'issues' then 'uma pendência' || coalesce(' (' || icode || ')', '')
                 when new.id like 'diary_%' then 'o diário de ' || to_char(to_date(substr(new.id, 7), 'YYYY-MM-DD'), 'DD/MM')
                 else 'a obra' end;
    txt := left(coalesce(n->>'mentionText', n->>'note', n->>'text', n->>'notes', ''), 400);
    for r in select value as v from jsonb_array_elements_text(coalesce(n->'mentions', '[]'::jsonb))
              where value ~ uid_re and not coalesce(o->'mentions', '[]'::jsonb) ? value loop
      if r.v::uuid is distinct from actor and public.in_project_user(new.project, r.v::uuid) then
        perform public.notif_add(r.v::uuid, 'mencao', obra || ' · ' || who || replace(' identificou-te em ' || what, ' em a ', ' na '), txt);
        nm := nm || r.v;
      end if;
    end loop;
    if new.col = 'issues' and tg_op = 'UPDATE' and coalesce(n->>'assignee', '') ~ uid_re
       and (n->>'assignee') is distinct from (o->>'assignee') and (n->>'assignee')::uuid is distinct from actor then
      kn := case n->>'kind' when 'tarefa' then 'Tarefa' when 'duvida' then 'Dúvida' else 'Pendência' end;
      perform public.notif_add((n->>'assignee')::uuid, 'atribuido', obra || ' · ' || kn || ' atribuída a ti' || coalesce(' (' || icode || ')', '')
          || coalesce(': ' || nullif(left(n->>'title', 80), ''), ''),
        who || ' atribuiu-te ' || what || coalesce(': ' || nullif(left(n->>'text', 300), ''), '') || coalesce('. Prazo: ' || nullif(n->>'due', ''), ''));
    end if;
    -- novos seguidores de uma tarefa ou dúvida
    if new.col = 'issues' and n->>'kind' in ('tarefa','duvida') then
      for r in select value as v from jsonb_array_elements_text(coalesce(n->'followers', '[]'::jsonb))
                where value ~ uid_re and not coalesce(o->'followers', '[]'::jsonb) ? value loop
        if r.v::uuid is distinct from actor and not (r.v = any(nm)) and public.in_project_user(new.project, r.v::uuid) then
          perform public.notif_add(r.v::uuid, 'atribuido', obra || ' · Segues agora ' || what, who || ' adicionou-te como seguidor. Vais receber as respostas e mudanças de estado.');
          nm := nm || r.v;
        end if;
      end loop;
    end if;
    -- nova resposta/comentário numa tarefa ou dúvida: avisa quem a criou e o responsável
    if new.col = 'issues' and tg_op = 'UPDATE' and n->>'kind' in ('tarefa','duvida')
       and jsonb_array_length(coalesce(n->'comments', '[]'::jsonb)) > jsonb_array_length(coalesce(o->'comments', '[]'::jsonb)) then
      c := n->'comments'->-1;
      for r in select distinct x as v from unnest(array[n->>'createdBy', n->>'assignee'] || array(select jsonb_array_elements_text(coalesce(n->'followers','[]'::jsonb)))) x
                where x ~ uid_re and x::uuid is distinct from actor and not (x = any(nm)) loop
        perform public.notif_add(r.v::uuid, 'mencao', obra || ' · ' || who || case when n->>'kind' = 'duvida' then ' respondeu à ' else ' comentou na ' end
          || regexp_replace(what, '^a ', ''), left(coalesce(c->>'text', ''), 400));
      end loop;
    end if;
  exception when others then
    null;   -- uma notificação nunca pode impedir a gravação dos dados
  end;
  return new;
end $$;

select 'Atualização 5 instalada: tarefas e dúvidas com emails.' as resultado;
