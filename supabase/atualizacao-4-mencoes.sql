-- =========================================================
-- ObraFlow · Atualização 4: emails quando identificas alguém numa tarefa
-- Corre DEPOIS das atualizações 2 e 3.
-- Supabase → SQL Editor → New query → colar tudo → Run. Pode correr-se mais de uma vez.
--
-- O que muda:
--  * escrever "@Nome" numa nota, pendência ou no diário envia email a essa pessoa;
--  * atribuir um equipamento ou uma pendência a alguém envia email (também quando se muda o responsável);
--  * as notificações ficam LIGADAS por defeito para todos (cada pessoa pode desligar em Definições);
--  * avisos de atribuição e menções saem logo (verificação a cada minuto), mesmo para quem escolheu resumo diário.
-- Os emails são enviados pelo Brevo (gratuito, 300/dia): configura em Definições da obra → Envio de emails.
-- =========================================================

do $$ begin
  if not exists (select 1 from pg_proc where proname = 'in_project' and pronamespace = 'public'::regnamespace) then
    raise exception 'Corre primeiro as atualizações 2 e 3 e depois esta.';
  end if;
end $$;

alter table public.notif_prefs alter column enabled set default true;
alter table public.notif_prefs add column if not exists ev_mencao boolean not null default true;

-- junta uma notificação à fila (quem nunca mexeu nas preferências recebe tudo menos "plantas")
create or replace function public.notif_add(p_user uuid, p_ev text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.notif_prefs;
begin
  if p_user is null then return; end if;
  if not exists (select 1 from public.members where user_id = p_user and role <> 'pendente') then return; end if;
  select * into p from public.notif_prefs where user_id = p_user;
  if found then
    if not p.enabled then return; end if;
    if (p_ev = 'atribuido' and not p.ev_atribuido) or (p_ev = 'anomalia' and not p.ev_anomalia)
       or (p_ev = 'etapas' and not p.ev_etapas) or (p_ev = 'plantas' and not p.ev_plantas)
       or (p_ev = 'mencao' and not p.ev_mencao) then return; end if;
  elsif p_ev = 'plantas' then return;
  end if;
  insert into public.notif_queue (user_id, ev, title, body) values (p_user, p_ev, p_title, p_body);
end $$;

-- menções (@Nome) e mudança de responsável de uma pendência
create or replace function public.notif_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  actor uuid := auth.uid();
  who text; obra text; what text; txt text; r record; uid_re text := '^[0-9a-fA-F-]{36}$'; icode text;
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
                 when new.col = 'issues' then 'uma pendência' || coalesce(' (' || icode || ')', '')
                 when new.id like 'diary_%' then 'o diário de ' || to_char(to_date(substr(new.id, 7), 'YYYY-MM-DD'), 'DD/MM')
                 else 'a obra' end;
    txt := left(coalesce(n->>'mentionText', n->>'note', n->>'text', n->>'notes', ''), 400);
    for r in select value as v from jsonb_array_elements_text(coalesce(n->'mentions', '[]'::jsonb))
              where value ~ uid_re and not coalesce(o->'mentions', '[]'::jsonb) ? value loop
      if r.v::uuid is distinct from actor and public.in_project_user(new.project, r.v::uuid) then
        perform public.notif_add(r.v::uuid, 'mencao', obra || ' · ' || who || ' identificou-te em ' || what, txt);
      end if;
    end loop;
    if new.col = 'issues' and tg_op = 'UPDATE' and coalesce(n->>'assignee', '') ~ uid_re
       and (n->>'assignee') is distinct from (o->>'assignee') and (n->>'assignee')::uuid is distinct from actor then
      perform public.notif_add((n->>'assignee')::uuid, 'atribuido', obra || ' · Pendência atribuída a ti' || coalesce(' (' || icode || ')', ''),
        who || ' atribuiu-te: ' || left(coalesce(n->>'text', ''), 300) || coalesce('. Prazo: ' || (n->>'due'), ''));
    end if;
  exception when others then
    null;   -- uma notificação nunca pode impedir a gravação dos dados
  end;
  return new;
end $$;

create or replace function public.in_project_user(p text, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = u and role = 'admin')
      or exists (select 1 from public.project_members where project_id = p and user_id = u)
$$;

drop trigger if exists notif_mentions on public.docs;
create trigger notif_mentions after insert or update on public.docs
  for each row execute function public.notif_mentions();

-- envio: um email por pessoa; atribuições e menções saem logo, o resto conforme a preferência
create or replace function public.notif_send(p_daily boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare k text; se text; sn text; site text; r record; items text; total int; cnt int := 0; subj text; ids bigint[];
begin
  select value into k  from public.app_config where name = 'brevo_key';
  select value into se from public.app_config where name = 'sender_email';
  select value into sn from public.app_config where name = 'sender_name';
  select value into site from public.app_config where name = 'site_url';
  if k is null or se is null then return 0; end if;
  for r in
    select m.user_id, m.email, m.name, coalesce(p.mode, 'imediato') as mode
      from public.members m left join public.notif_prefs p using (user_id)
     where coalesce(p.enabled, true) and m.role <> 'pendente'
  loop
    -- linhas a enviar agora
    select array_agg(q.id order by q.id) into ids from public.notif_queue q
     where q.user_id = r.user_id and q.sent_at is null
       and ((p_daily and r.mode = 'diario') or (not p_daily and (r.mode = 'imediato' or q.ev in ('mencao', 'atribuido'))));
    total := coalesce(array_length(ids, 1), 0);
    if total = 0 then continue; end if;
    select string_agg('<li style="margin:0 0 10px"><b>' || public.html_esc(title) || '</b><br><span style="color:#5e6b66">'
                      || public.html_esc(body) || ' · ' || to_char(created_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') || '</span></li>', '' order by id)
      into items from (select q.* from public.notif_queue q where q.id = any(ids) order by q.id limit 40) x;
    select title into subj from public.notif_queue q where q.id = any(ids) order by q.id limit 1;
    subj := case when total = 1 then subj else total || ' atualizações nas tuas obras' end;
    perform net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', k, 'Content-Type', 'application/json', 'accept', 'application/json'),
      body := jsonb_build_object(
        'sender', jsonb_build_object('email', se, 'name', coalesce(sn, 'ObraFlow')),
        'to', jsonb_build_array(jsonb_build_object('email', r.email, 'name', r.name)),
        'subject', 'ObraFlow · ' || subj,
        'htmlContent', '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2421;max-width:600px">'
          || '<h2 style="margin:0 0 12px">Obra<span style="color:#e8a317">Flow</span></h2><p>Olá ' || public.html_esc(r.name) || ', '
          || case when p_daily then 'este é o resumo do dia:' else 'há novidades para ti:' end || '</p><ul style="padding-left:18px">' || items || '</ul>'
          || case when total > 40 then '<p>… e mais ' || (total - 40) || '.</p>' else '' end
          || case when site is not null then '<p><a href="' || public.html_esc(site) || '" style="background:#e8a317;color:#1d2421;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Abrir o ObraFlow</a></p>' else '' end
          || '<p style="color:#8a948f;font-size:12px">Recebes este email porque fazes parte de uma obra no ObraFlow. Podes mudar o que recebes em Definições da obra → Notificações por email.</p></div>'),
      timeout_milliseconds := 10000);
    update public.notif_queue set sent_at = now() where id = any(ids);
    cnt := cnt + 1;
  end loop;
  delete from public.notif_queue where sent_at < now() - interval '30 days';
  return cnt;
end $$;
revoke execute on function public.notif_send(boolean) from public, anon, authenticated;

-- verificação a cada minuto (em vez de 5 em 5) e resumo diário às ~18h
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('costaplan-notif', 'obraflow-notif', 'costaplan-diario', 'obraflow-diario');
exception when others then null; end $$;
select cron.schedule('obraflow-notif', '* * * * *', $$select public.notif_send(false)$$);
select cron.schedule('obraflow-diario', '0 17 * * *', $$select public.notif_send(true)$$);

select 'Atualização 4 instalada: menções e atribuições por email.' as resultado;
