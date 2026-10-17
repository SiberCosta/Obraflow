-- =====================================================================
-- ObraFlow · atualização 2: hierarquia de acesso + notificações por email
-- Correr UMA vez: Supabase → SQL Editor → New query → colar tudo → Run.
-- (Pode correr-se outra vez sem estragar nada.)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HIERARQUIA DE ACESSO
--    admin    = Administrador: tudo + gere coordenadores/administradores + email
--    coord    = Coordenação: valida, atribui, aprova técnicos/fiscalização/leitura
--    tecnico  = Técnico: marca, fotografa, testa, regista anomalias
--    fiscal   = Fiscalização / cliente: vê tudo, regista anomalias, marca "Aceite"
--    leitura  = Só leitura: vê tudo, não altera nada
--    pendente = à espera de aprovação (não vê nada)
-- ---------------------------------------------------------------------
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('pendente','leitura','fiscal','tecnico','coord','admin'));

-- a primeira pessoa da coordenação passa a Administrador (se ainda não houver)
update public.members set role = 'admin'
 where user_id = (select user_id from public.members where role = 'coord' order by created_at limit 1)
   and not exists (select 1 from public.members where role = 'admin');

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.members where user_id = auth.uid()), false)
$$;
create or replace function public.is_coord() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('coord','admin') from public.members where user_id = auth.uid()), false)
$$;
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('tecnico','fiscal','coord','admin') from public.members where user_id = auth.uid()), false)
$$;

-- novo registo: a primeira conta fica Administrador, as outras à espera de aprovação
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (user_id, name, email, role)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          new.email,
          case when exists (select 1 from public.members) then 'pendente' else 'admin' end)
  on conflict (user_id) do nothing;
  return new;
end $$;

-- quem pode mudar papéis: o administrador muda qualquer um; a coordenação só
-- aprova/muda técnicos, fiscalização, só leitura e pendentes (não promove a coordenação)
drop policy if exists members_update_coord on public.members;
drop policy if exists members_update_mgr on public.members;
create policy members_update_mgr on public.members for update
  using (public.is_admin() or (public.is_coord() and role in ('pendente','leitura','fiscal','tecnico') and user_id <> auth.uid()))
  with check (public.is_admin() or (public.is_coord() and role in ('pendente','leitura','fiscal','tecnico')));
drop policy if exists members_delete_coord on public.members;
drop policy if exists members_delete_admin on public.members;
create policy members_delete_admin on public.members for delete
  using (public.is_admin() and user_id <> auth.uid());

-- tem de existir sempre pelo menos um administrador
create or replace function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin')
     and not exists (select 1 from public.members where role = 'admin' and user_id <> old.user_id) then
    raise exception 'Tem de existir pelo menos um administrador.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists keep_one_admin on public.members;
create trigger keep_one_admin before update or delete on public.members
  for each row execute function public.keep_one_admin();

-- "Só leitura" vê mas não altera dados nem ficheiros
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert with check (public.can_write());
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update using (public.can_write()) with check (public.can_write());
drop policy if exists ficheiros_insert on storage.objects;
create policy ficheiros_insert on storage.objects for insert
  with check (bucket_id = 'ficheiros' and public.can_write());

-- ---------------------------------------------------------------------
-- 2. NOTIFICAÇÕES POR EMAIL (gratuito: Brevo, 300 emails/dia)
--    Cada pessoa escolhe na app se quer receber e o quê.
--    As alterações entram numa fila; de 5 em 5 minutos (ou 1 vez por dia,
--    às ~18h, para quem escolher "resumo diário") é enviado UM email por pessoa.
-- ---------------------------------------------------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.notif_prefs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  enabled      boolean not null default false,
  mode         text not null default 'imediato' check (mode in ('imediato','diario')),
  ev_atribuido boolean not null default true,   -- equipamento/piso atribuído a mim
  ev_anomalia  boolean not null default true,   -- anomalias novas e resolvidas
  ev_etapas    boolean not null default true,   -- testado → para validar; validado → para aceitar; aceite
  ev_plantas   boolean not null default false,  -- plantas novas ou trocadas
  updated_at   timestamptz not null default now()
);
alter table public.notif_prefs enable row level security;
drop policy if exists notif_prefs_own_sel on public.notif_prefs;
create policy notif_prefs_own_sel on public.notif_prefs for select using (user_id = auth.uid());
drop policy if exists notif_prefs_own_ins on public.notif_prefs;
create policy notif_prefs_own_ins on public.notif_prefs for insert with check (user_id = auth.uid() and public.is_active());
drop policy if exists notif_prefs_own_upd on public.notif_prefs;
create policy notif_prefs_own_upd on public.notif_prefs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notif_queue (
  id bigserial primary key,
  user_id uuid not null,
  ev text not null,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.notif_queue enable row level security;  -- sem políticas: só as funções abaixo lhe mexem

create table if not exists public.app_config (name text primary key, value text);
alter table public.app_config enable row level security;   -- sem políticas: a chave do email nunca chega à app

create or replace function public.html_esc(t text) returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t,''),'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;')
$$;

-- junta uma notificação à fila, se a pessoa a quiser receber
create or replace function public.notif_add(p_user uuid, p_ev text, p_title text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.notif_prefs;
begin
  if p_user is null then return; end if;
  select * into p from public.notif_prefs where user_id = p_user;
  if not found or not p.enabled then return; end if;
  if (p_ev = 'atribuido' and not p.ev_atribuido) or (p_ev = 'anomalia' and not p.ev_anomalia)
     or (p_ev = 'etapas' and not p.ev_etapas) or (p_ev = 'plantas' and not p.ev_plantas) then return; end if;
  if not exists (select 1 from public.members where user_id = p_user and role <> 'pendente') then return; end if;
  insert into public.notif_queue (user_id, ev, title, body) values (p_user, p_ev, p_title, p_body);
end $$;

-- deteta as alterações que interessam em cada gravação de dados
create or replace function public.notif_on_docs() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  actor uuid := auth.uid();
  who text; code text; pname text; st text; r record; uid_re text := '^[0-9a-fA-F-]{36}$';
begin
  begin
    if new.deleted then return new; end if;
    select name into who from public.members where user_id = actor;
    who := coalesce(who, 'Alguém');

    if new.col = 'items' then
      code := coalesce(n->>'devId', '') ;
      code := coalesce(n->>'code', '?') || case when code <> '' then ' (ID ' || code || ')' else '' end;
      select data->>'name' into pname from public.docs where col = 'plans' and id = n->>'planId';
      -- atribuído a alguém
      if coalesce(n->>'assignee','') ~ uid_re and coalesce(n->>'assignee','') is distinct from coalesce(o->>'assignee','')
         and (n->>'assignee')::uuid is distinct from actor then
        perform public.notif_add((n->>'assignee')::uuid, 'atribuido', 'Atribuído a ti: ' || code,
          who || ' atribuiu-te ' || code || ' em ' || coalesce(pname,'?') || coalesce('. Prazo: ' || (n->>'due'), '') || '.');
      end if;
      -- mudança de etapa
      st := n->>'stage';
      if tg_op = 'UPDATE' and st is distinct from (o->>'stage') then
        if st = 'testado' then
          for r in select user_id from public.members where role in ('coord','admin') and user_id is distinct from actor loop
            perform public.notif_add(r.user_id, 'etapas', 'Para validar: ' || code, who || ' marcou ' || code || ' como Testado em ' || coalesce(pname,'?') || '.');
          end loop;
        elsif st = 'validado' then
          for r in select user_id from public.members where role = 'fiscal' and user_id is distinct from actor loop
            perform public.notif_add(r.user_id, 'etapas', 'Para aceitar: ' || code, who || ' validou ' || code || ' em ' || coalesce(pname,'?') || '.');
          end loop;
        elsif st = 'aceite' then
          for r in select user_id from public.members where role in ('coord','admin') and user_id is distinct from actor loop
            perform public.notif_add(r.user_id, 'etapas', 'Aceite: ' || code, who || ' aceitou ' || code || ' em ' || coalesce(pname,'?') || '.');
          end loop;
        end if;
      end if;

    elsif new.col = 'issues' then
      select data->>'code' into code from public.docs where col = 'items' and id = n->>'itemId';
      select data->>'name' into pname from public.docs where col = 'plans' and id = n->>'planId';
      if coalesce(o->>'text','') = '' then   -- anomalia nova
        for r in select user_id from public.members
                  where (role in ('coord','admin') or (coalesce(n->>'assignee','') ~ uid_re and user_id = (n->>'assignee')::uuid))
                    and user_id is distinct from actor loop
          perform public.notif_add(r.user_id, 'anomalia', 'Anomalia: ' || coalesce(code,'?'),
            who || ' registou em ' || coalesce(code,'?') || ' (' || coalesce(pname,'?') || '): ' || left(coalesce(n->>'text',''), 300));
        end loop;
      elsif n->>'status' = 'resolvida' and coalesce(o->>'status','') <> 'resolvida'
            and coalesce(n->>'createdBy','') ~ uid_re and (n->>'createdBy')::uuid is distinct from actor then
        perform public.notif_add((n->>'createdBy')::uuid, 'anomalia', 'Anomalia resolvida: ' || coalesce(code,'?'),
          who || ' resolveu: ' || left(coalesce(n->>'text',''), 300));
      end if;

    elsif new.col = 'plans' then
      if tg_op = 'INSERT' or coalesce(n->>'img','') is distinct from coalesce(o->>'img','') then
        for r in select user_id from public.members where role <> 'pendente' and user_id is distinct from actor loop
          perform public.notif_add(r.user_id, 'plantas',
            case when tg_op = 'INSERT' or coalesce(o->>'img','') = '' then 'Planta nova: ' else 'Planta trocada: ' end || coalesce(n->>'name','?'),
            who || case when tg_op = 'INSERT' or coalesce(o->>'img','') = '' then ' carregou a planta ' else ' trocou a planta ' end || coalesce(n->>'name','?') || '.');
        end loop;
      end if;
      -- piso atribuído
      for r in select value::text as v from jsonb_array_elements_text(coalesce(n->'assignees','[]'::jsonb))
                where value ~ uid_re and not coalesce(o->'assignees','[]'::jsonb) ? value loop
        if r.v::uuid is distinct from actor then
          perform public.notif_add(r.v::uuid, 'atribuido', 'Piso atribuído: ' || coalesce(n->>'name','?'), who || ' atribuiu-te o piso ' || coalesce(n->>'name','?') || '.');
        end if;
      end loop;
    end if;
  exception when others then
    null;   -- uma notificação nunca pode impedir a gravação dos dados
  end;
  return new;
end $$;
drop trigger if exists notif_on_docs on public.docs;
create trigger notif_on_docs after insert or update on public.docs
  for each row execute function public.notif_on_docs();

-- envio: um email por pessoa com tudo o que está na fila
create or replace function public.notif_send(p_daily boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare k text; se text; sn text; site text; r record; items text; n int; total int; cnt int := 0; subj text;
begin
  select value into k  from public.app_config where name = 'brevo_key';
  select value into se from public.app_config where name = 'sender_email';
  select value into sn from public.app_config where name = 'sender_name';
  select value into site from public.app_config where name = 'site_url';
  if k is null or se is null then return 0; end if;
  for r in
    select m.user_id, m.email, m.name from public.members m join public.notif_prefs p using (user_id)
     where p.enabled and m.role <> 'pendente'
       and ((p.mode = 'imediato' and not p_daily) or (p.mode = 'diario' and p_daily))
       and exists (select 1 from public.notif_queue q where q.user_id = m.user_id and q.sent_at is null)
  loop
    select count(*) into total from public.notif_queue where user_id = r.user_id and sent_at is null;
    select string_agg('<li style="margin:0 0 10px"><b>' || public.html_esc(title) || '</b><br><span style="color:#5e6b66">'
                      || public.html_esc(body) || ' · ' || to_char(created_at at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') || '</span></li>', '' order by id)
      into items
      from (select * from public.notif_queue where user_id = r.user_id and sent_at is null order by id limit 40) x;
    select title into subj from public.notif_queue where user_id = r.user_id and sent_at is null order by id limit 1;
    subj := case when total = 1 then subj else total || ' atualizações na obra' end;
    perform net.http_post(
      url := 'https://api.brevo.com/v3/smtp/email',
      headers := jsonb_build_object('api-key', k, 'Content-Type', 'application/json', 'accept', 'application/json'),
      body := jsonb_build_object(
        'sender', jsonb_build_object('email', se, 'name', coalesce(sn, 'ObraFlow')),
        'to', jsonb_build_array(jsonb_build_object('email', r.email, 'name', r.name)),
        'subject', 'ObraFlow · ' || subj,
        'htmlContent', '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2421;max-width:600px">'
          || '<h2 style="margin:0 0 12px">ObraFlow</h2><p>Olá ' || public.html_esc(r.name) || ', '
          || case when p_daily then 'este é o resumo do dia:' else 'há novidades na obra:' end || '</p><ul style="padding-left:18px">' || items || '</ul>'
          || case when total > 40 then '<p>… e mais ' || (total - 40) || '.</p>' else '' end
          || case when site is not null then '<p><a href="' || public.html_esc(site) || '" style="background:#e8a317;color:#1d2421;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Abrir a ObraFlow</a></p>' else '' end
          || '<p style="color:#8a948f;font-size:12px">Recebes este email porque ativaste as notificações na ObraFlow (Início → Notificações por email).</p></div>'),
      timeout_milliseconds := 10000);
    update public.notif_queue set sent_at = now() where user_id = r.user_id and sent_at is null;
    cnt := cnt + 1;
  end loop;
  delete from public.notif_queue where sent_at < now() - interval '30 days';
  return cnt;
end $$;
revoke execute on function public.notif_send(boolean) from public, anon, authenticated;

-- configuração do email (só o Administrador). A chave fica guardada no servidor e nunca volta à app.
create or replace function public.set_mail_config(p_key text, p_sender text, p_name text, p_site text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Só o administrador pode configurar o email.'; end if;
  if coalesce(p_key,'') <> '' then insert into public.app_config values ('brevo_key', p_key) on conflict (name) do update set value = excluded.value; end if;
  insert into public.app_config values ('sender_email', p_sender) on conflict (name) do update set value = excluded.value;
  insert into public.app_config values ('sender_name', coalesce(nullif(p_name,''), 'ObraFlow')) on conflict (name) do update set value = excluded.value;
  insert into public.app_config values ('site_url', p_site) on conflict (name) do update set value = excluded.value;
end $$;
create or replace function public.mail_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_coord() then jsonb_build_object(
    'configured', exists (select 1 from public.app_config where name = 'brevo_key'),
    'sender', (select value from public.app_config where name = 'sender_email'),
    'name', (select value from public.app_config where name = 'sender_name'),
    'last', (select max(sent_at) from public.notif_queue))
  else '{}'::jsonb end
$$;
-- email de teste para o próprio administrador
create or replace function public.mail_test() returns void
language plpgsql security definer set search_path = public as $$
declare k text; se text; sn text; em text; nm text;
begin
  if not public.is_admin() then raise exception 'Só o administrador pode enviar o teste.'; end if;
  select value into k  from public.app_config where name = 'brevo_key';
  select value into se from public.app_config where name = 'sender_email';
  select value into sn from public.app_config where name = 'sender_name';
  select email, name into em, nm from public.members where user_id = auth.uid();
  if k is null or se is null then raise exception 'Falta configurar a chave e o remetente.'; end if;
  perform net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object('api-key', k, 'Content-Type', 'application/json', 'accept', 'application/json'),
    body := jsonb_build_object('sender', jsonb_build_object('email', se, 'name', coalesce(sn,'ObraFlow')),
      'to', jsonb_build_array(jsonb_build_object('email', em, 'name', nm)),
      'subject', 'ObraFlow · email de teste',
      'htmlContent', '<p>Olá ' || public.html_esc(nm) || ', as notificações por email da ObraFlow estão a funcionar.</p>'),
    timeout_milliseconds := 10000);
end $$;
-- resultado do último pedido de envio (para a app mostrar se o Brevo aceitou)
create or replace function public.mail_last_result() returns jsonb
language sql stable security definer set search_path = public, net as $$
  select case when public.is_admin() then
    (select jsonb_build_object('status', status_code, 'body', left(content::text, 300), 'at', created)
       from net._http_response order by id desc limit 1)
  else null end
$$;

-- agendamentos: de 5 em 5 minutos (imediato) e todos os dias às 17:00 UTC (~18h em Lisboa)
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('obraflow-notif', 'obraflow-diario');
exception when others then null; end $$;
select cron.schedule('obraflow-notif', '*/5 * * * *', $$select public.notif_send(false)$$);
select cron.schedule('obraflow-diario', '0 17 * * *', $$select public.notif_send(true)$$);

-- tempo real para a equipa ver as mudanças de papéis
do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;
