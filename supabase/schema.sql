-- =====================================================================
-- Planta de Obra · esquema da base de dados (Supabase)
-- Correr UMA vez: Supabase → SQL Editor → New query → colar tudo → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Equipa: quem pode entrar e com que papel
--    pendente  = registou-se mas ainda não foi aprovado (não vê nada)
--    tecnico   = trabalha em obra (marca, fotografa, testa)
--    fiscal    = fiscalização / cliente (pode marcar "Aceite")
--    coord     = coordenação (valida, atribui, aprova a equipa, importa)
-- A primeira pessoa a registar-se fica automaticamente como coordenação.
-- ---------------------------------------------------------------------
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  email      text not null default '',
  role       text not null default 'pendente'
             check (role in ('pendente','tecnico','fiscal','coord')),
  created_at timestamptz not null default now()
);

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid()
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role <> 'pendente' from public.members where user_id = auth.uid()), false)
$$;

create or replace function public.is_coord() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'coord' from public.members where user_id = auth.uid()), false)
$$;

-- Novo registo → entra na equipa (a primeira pessoa é coordenação)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (user_id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.members) then 'pendente' else 'coord' end
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.members enable row level security;

drop policy if exists members_select on public.members;
create policy members_select on public.members for select
  using (user_id = auth.uid() or public.is_active());

drop policy if exists members_update_coord on public.members;
create policy members_update_coord on public.members for update
  using (public.is_coord()) with check (public.is_coord());

drop policy if exists members_update_self_name on public.members;
create policy members_update_self_name on public.members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = public.my_role());  -- pode mudar o nome, não o papel

drop policy if exists members_delete_coord on public.members;
create policy members_delete_coord on public.members for delete
  using (public.is_coord() and user_id <> auth.uid());

-- ---------------------------------------------------------------------
-- 2. Dados da obra: um documento JSON por registo
--    col = 'plans' (pisos), 'items' (equipamentos), 'issues' (anomalias),
--          'meta' (dados da obra)
--    updated_at é sempre posto pelo servidor: é o que a app usa para
--    sincronizar o que mudou desde a última ligação.
-- ---------------------------------------------------------------------
create table if not exists public.docs (
  col        text not null check (col in ('plans','items','issues','meta')),
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (col, id)
);
create index if not exists docs_updated_at on public.docs (updated_at);

create or replace function public.docs_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

alter table public.docs enable row level security;

drop policy if exists docs_select on public.docs;
create policy docs_select on public.docs for select using (public.is_active());

drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert with check (public.is_active());

drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update using (public.is_active()) with check (public.is_active());

-- (não há delete: apagar é marcar deleted = true, para os outros aparelhos saberem)

-- Tempo real: os outros aparelhos recebem as alterações na hora
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.members;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. Ficheiros (plantas, PDFs, fotos): bucket privado "ficheiros"
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('ficheiros', 'ficheiros', false, 52428800)   -- até 50 MB por ficheiro
on conflict (id) do nothing;

drop policy if exists ficheiros_select on storage.objects;
create policy ficheiros_select on storage.objects for select
  using (bucket_id = 'ficheiros' and public.is_active());

drop policy if exists ficheiros_insert on storage.objects;
create policy ficheiros_insert on storage.objects for insert
  with check (bucket_id = 'ficheiros' and public.is_active());

drop policy if exists ficheiros_delete on storage.objects;
create policy ficheiros_delete on storage.objects for delete
  using (bucket_id = 'ficheiros' and public.is_coord());
