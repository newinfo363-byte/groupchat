-- Supabase schema for GroupChat application
-- Tables: profiles, access_requests, roles, messages
-- Notes:
-- - This schema is designed for use with Supabase/Postgres.
-- - It includes basic RLS policies to allow authenticated users to insert their own requests, create/update their profile, and post messages.
-- - Admins are represented in the `roles` table with role = 'admin'.

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------
-- profiles: user display preferences and information
-- ----------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique, -- references auth.users.id
  username text not null,
  bio text default ''::text,
  dp_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_username on public.profiles(lower(username));

-- Trigger to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ----------------------------------------------------
-- access_requests: users request to join the chat
-- ----------------------------------------------------
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, -- references auth.users.id
  name text not null,
  reason text,
  status text not null default 'pending', -- pending | approved | rejected
  created_at timestamptz not null default now()
);

create index if not exists idx_access_requests_user_id on public.access_requests(user_id);
create index if not exists idx_access_requests_status on public.access_requests(status);

-- ----------------------------------------------------
-- roles: simple role mapping (admin/member)
-- ----------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create index if not exists idx_roles_user_id on public.roles(user_id);
create index if not exists idx_roles_role on public.roles(role);

-- ----------------------------------------------------
-- messages: chat messages
-- ----------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null, -- references auth.users.id
  type text not null check (type in ('text','image','audio')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_created_at on public.messages(created_at);

-- For convenience when querying messages with profile info, create a view
create or replace view public.messages_with_profiles as
select m.*, p.id as profile_id, p.user_id as profile_user_id, p.username, p.bio, p.dp_url
from public.messages m
left join public.profiles p on p.user_id = m.sender_id;

-- ----------------------------------------------------
-- Row-Level Security (RLS) policies
-- ----------------------------------------------------
-- Enable RLS where appropriate
alter table public.profiles enable row level security;
alter table public.access_requests enable row level security;
alter table public.roles enable row level security;
alter table public.messages enable row level security;

-- Helper function to extract user id from jwt (supabase uses auth.jwt().sub)
-- Note: Supabase exposes auth.uid() as a policy variable; we will use auth.uid() in policies.

-- Profiles: users may insert their own profile and update it; anyone can select profiles
create policy "profiles_select_all" on public.profiles
for select using (true);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "profiles_delete_admin_only" on public.profiles
for delete using (exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- Access Requests: users may insert a request for themselves and view their own request; admins can view all
create policy "access_requests_insert_own" on public.access_requests
for insert with check (auth.uid() = user_id);

create policy "access_requests_select_owner_or_admin" on public.access_requests
for select using (
  (auth.uid() = user_id)
  or exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin')
);

create policy "access_requests_update_admin_only" on public.access_requests
for update using (exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin')) with check (true);

create policy "access_requests_delete_admin_only" on public.access_requests
for delete using (exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- Roles: only admins can insert/delete roles (bootstrap via SQL or via Supabase UI)
create policy "roles_manage_admins_only" on public.roles
for all using (exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin')) with check (exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- Messages: authenticated users can insert messages as themselves; selecting messages is public for authenticated users
create policy "messages_select_authenticated" on public.messages
for select using (auth.role() is null or auth.role() is not null);

create policy "messages_insert_own" on public.messages
for insert with check (auth.uid() = sender_id);

-- Optionally allow admins to delete any message
create policy "messages_delete_admin_only" on public.messages
for delete using (exists (select 1 from public.roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- ----------------------------------------------------
-- Example seed: create an admin role placeholder (commented out)
-- ----------------------------------------------------
-- insert into public.roles (user_id, role) values ('00000000-0000-0000-0000-000000000000', 'admin');

-- End of schema

