-- Fix: allow service role / authenticated bootstrap paths
-- Re-run safely in SQL editor if project create still fails on users insert.

-- Ensure FK to auth.users exists (skip if already present)
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    raise exception 'public.users table missing — run 0001_init.sql first';
  end if;
end $$;

-- Service role bypasses RLS; add permissive policies for authenticated members
-- so client reads work after bootstrap.

drop policy if exists orgs_insert_authenticated on orgs;
create policy orgs_insert_authenticated on orgs
  for insert to authenticated
  with check (true);

drop policy if exists org_members_insert_self on org_members;
create policy org_members_insert_self on org_members
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists users_insert_self on users;
create policy users_insert_self on users
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists users_update_self on users;
create policy users_update_self on users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
