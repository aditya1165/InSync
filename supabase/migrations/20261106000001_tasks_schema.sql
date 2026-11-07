-- Feature F2: Task Dependency Mapping Schema
-- InSync architecture rule: external content (Slack messages, GitHub diffs)
-- is NEVER stored persistently. Only task context and endpoint mappings live here.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 255),
  component text not null check (length(trim(component)) between 1 and 120),
  status text not null check (status in ('todo', 'in_progress', 'done')) default 'in_progress',
  created_at timestamptz not null default now()
);

create table if not exists public.task_api_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  endpoint text not null check (length(trim(endpoint)) between 1 and 255),
  used_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.task_api_dependencies enable row level security;

revoke all on public.tasks from anon, authenticated;
revoke all on public.task_api_dependencies from anon, authenticated;
