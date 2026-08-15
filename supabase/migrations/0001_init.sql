-- Caseform MVP schema + RLS (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner',
  primary key (org_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  title text not null,
  status text not null default 'draft',
  generation_brief jsonb,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists specifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null default 'paste',
  raw_text text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists exemplar_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  source_type text not null default 'manual_form',
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table if not exists exemplars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  exemplar_set_id uuid not null references exemplar_sets(id) on delete cascade,
  title text not null,
  preconditions text not null default '',
  steps jsonb not null,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists project_exemplar_sets (
  project_id uuid not null references projects(id) on delete cascade,
  exemplar_set_id uuid not null references exemplar_sets(id) on delete cascade,
  primary key (project_id, exemplar_set_id)
);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  specification_id uuid references specifications(id),
  kind text not null,
  prompt_template_id text not null,
  prompt_version text not null,
  model text not null,
  input_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists test_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  specification_id uuid references specifications(id),
  title text not null,
  preconditions text not null default '',
  steps jsonb not null,
  status text not null default 'generated',
  generation_id uuid references generations(id),
  version int not null default 1,
  requirement_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_case_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  test_case_id uuid not null references test_cases(id) on delete cascade,
  body text not null,
  author_id uuid references users(id),
  consumed_in_generation_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists test_case_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  test_case_id uuid not null references test_cases(id) on delete cascade,
  before jsonb,
  after jsonb,
  source text not null,
  generation_id uuid,
  edited_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists projects_org_updated_idx on projects (org_id, updated_at desc);
create index if not exists test_cases_project_idx on test_cases (project_id, created_at);
create index if not exists exemplars_set_idx on exemplars (exemplar_set_id, sort_order);

-- RLS
alter table orgs enable row level security;
alter table users enable row level security;
alter table org_members enable row level security;
alter table projects enable row level security;
alter table specifications enable row level security;
alter table exemplar_sets enable row level security;
alter table exemplars enable row level security;
alter table project_exemplar_sets enable row level security;
alter table generations enable row level security;
alter table test_cases enable row level security;
alter table test_case_comments enable row level security;
alter table test_case_revisions enable row level security;

create or replace function public.is_org_member(check_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m
    where m.org_id = check_org and m.user_id = auth.uid()
  );
$$;

create policy users_self on users for all using (id = auth.uid()) with check (id = auth.uid());
create policy org_members_select on org_members for select using (user_id = auth.uid() or public.is_org_member(org_id));
create policy orgs_member on orgs for select using (public.is_org_member(id));

create policy projects_all on projects for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy specs_all on specifications for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy exemplar_sets_all on exemplar_sets for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy exemplars_all on exemplars for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy project_exemplar_sets_all on project_exemplar_sets for all
  using (exists (select 1 from projects p where p.id = project_id and public.is_org_member(p.org_id)))
  with check (exists (select 1 from projects p where p.id = project_id and public.is_org_member(p.org_id)));
create policy generations_all on generations for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy test_cases_all on test_cases for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy comments_all on test_case_comments for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy revisions_all on test_case_revisions for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
