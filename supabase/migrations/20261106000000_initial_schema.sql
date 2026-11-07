-- InSync stores user context and catch-up checkpoints here. Slack and GitHub
-- message bodies remain in their source systems.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  time_zone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

revoke all on function public.create_profile_for_new_user()
  from public, anon, authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- One row is one GitHub repository or Slack channel available to a workspace.
-- Access tokens are kept in server configuration or a future secret store.
create table public.source_scopes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('github', 'slack')),
  external_id text not null check (length(trim(external_id)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, provider, external_id)
);

-- A workspace member sees a source only after an explicit access grant.
-- Later Slack/GitHub account linking must verify that grant is appropriate.
create table public.user_source_access (
  workspace_id uuid not null,
  user_id uuid not null,
  source_id uuid not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, source_id),
  unique (workspace_id, user_id, source_id),
  foreign key (workspace_id, user_id)
    references public.workspace_memberships (workspace_id, user_id) on delete cascade,
  foreign key (workspace_id, source_id)
    references public.source_scopes (workspace_id, id) on delete cascade
);

-- An omitted preference includes an accessible source. A user can opt out
-- without changing their access grant or the workspace source list.
create table public.user_source_preferences (
  workspace_id uuid not null,
  user_id uuid not null,
  source_id uuid not null,
  included boolean not null,
  primary key (user_id, source_id),
  foreign key (workspace_id, user_id, source_id)
    references public.user_source_access (workspace_id, user_id, source_id) on delete cascade
);

-- External identities support ranking mentions, assignments, and reviews.
create table public.external_identities (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('github', 'slack')),
  provider_workspace_id text not null default '',
  external_user_id text not null check (length(trim(external_user_id)) > 0),
  primary key (user_id, provider, provider_workspace_id),
  unique (provider, provider_workspace_id, external_user_id)
);

-- Insert a run only after every configured source succeeds. window_end is
-- the coverage checkpoint; completed_at is when the result finished loading.
create table public.catchup_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  range_choice text not null check (
    range_choice in ('last24Hours', 'previousWeek', 'sinceLastCatchUp')
  ),
  window_start timestamptz not null,
  window_end timestamptz not null,
  completed_at timestamptz not null default now(),
  activity_count integer not null check (activity_count >= 0),
  check (window_start < window_end),
  foreign key (workspace_id, user_id)
    references public.workspace_memberships (workspace_id, user_id) on delete cascade
);

create index catchup_runs_checkpoint_idx
  on public.catchup_runs (workspace_id, user_id, window_end desc);

-- The browser will use Supabase only for Auth. App data goes through Fastify,
-- which must check workspace membership before every database operation.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.source_scopes enable row level security;
alter table public.user_source_access enable row level security;
alter table public.user_source_preferences enable row level security;
alter table public.external_identities enable row level security;
alter table public.catchup_runs enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_memberships from anon, authenticated;
revoke all on public.source_scopes from anon, authenticated;
revoke all on public.user_source_access from anon, authenticated;
revoke all on public.user_source_preferences from anon, authenticated;
revoke all on public.external_identities from anon, authenticated;
revoke all on public.catchup_runs from anon, authenticated;
