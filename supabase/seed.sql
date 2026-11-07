-- Supabase SQL Seed Script (Feature F2 - Task Mapping)
-- Default Authenticated Demo User: Sameer
-- Adheres strictly to InSync architecture rule: external content is NEVER stored persistently.

do $$
declare
  sameer_id uuid := '00000000-0000-4000-8000-000000000001';
  demo_workspace_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  profile_task_id uuid := 'd0000000-0000-4000-8000-000000000001';
begin
  -- 1. Seed default user Sameer in auth.users if not present
  if not exists (select 1 from auth.users where id = sameer_id) then
    insert into auth.users (id, raw_user_meta_data)
    values (sameer_id, '{"full_name": "Sameer"}'::jsonb);
  end if;

  -- 2. Ensure profile exists with display_name 'Sameer'
  insert into public.profiles (id, display_name)
  values (sameer_id, 'Sameer')
  on conflict (id) do update set display_name = 'Sameer';

  -- 3. Ensure demo workspace exists
  insert into public.workspaces (id, name)
  values (demo_workspace_id, 'InSync Demo Workspace')
  on conflict (id) do nothing;

  -- 4. Ensure Sameer has owner membership in the demo workspace
  insert into public.workspace_memberships (workspace_id, user_id, role)
  values (demo_workspace_id, sameer_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  -- 5. Create task for user Sameer: "Build profile settings component"
  insert into public.tasks (id, workspace_id, user_id, title, component, status)
  values (
    profile_task_id,
    demo_workspace_id,
    sameer_id,
    'Build profile settings component',
    'ProfileSettings',
    'in_progress'
  )
  on conflict (id) do update set
    title = 'Build profile settings component',
    component = 'ProfileSettings',
    status = 'in_progress';

  -- 6. Create API dependency mapping linking this task to GET /users/id
  delete from public.task_api_dependencies where task_id = profile_task_id;
  insert into public.task_api_dependencies (task_id, endpoint, used_fields)
  values (
    profile_task_id,
    'GET /users/id',
    array['user_name']
  );

end $$;
