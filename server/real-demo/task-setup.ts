import type { Pool } from 'pg'
import type { DemoConfig } from './config.ts'
import { listAssignedTasks } from '../db/tasks.ts'
import { listUserSources } from '../db/catchup.ts'

// Reserved for this dedicated demo only; never repurpose an existing team workspace.
export const demoWorkspaceId = 'b7d521e0-9324-477a-9b62-075965d06001'
export const demoTaskId = 'b7d521e0-9324-477a-9b62-075965d06002'
const dependencyId = 'b7d521e0-9324-477a-9b62-075965d06003'
const githubId = 'b7d521e0-9324-477a-9b62-075965d06004'
const slackId = 'b7d521e0-9324-477a-9b62-075965d06005'
const workspaceName = 'InSync · ProductList gallery demo'
export const uuid = (value: string) => /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value)
export function taskSetupPlan(c: DemoConfig, userId?: string) {
  return { workspace: { id: demoWorkspaceId, name: workspaceName }, userId: userId || 'Create an Auth user in Supabase, then set INSYNC_DEMO_USER_ID.',
    task: { id: demoTaskId, title: 'Build ProductList pagination', component: 'ProductList', status: 'in_progress' },
    dependency: { endpoint: 'GET /products', usedFields: ['totalPages'] },
    sourceGrants: [{ provider: 'github', externalId: c.repository }, { provider: 'slack', externalId: c.channel }] }
}
export const taskConfirmation = (c: DemoConfig, userId: string) => `${userId}:${demoWorkspaceId}:${c.repository}:${c.channel}`

/** Caller supplies a dedicated connection. Transaction rolls back on any collision. */
export async function applyTaskSetup(db: Pick<Pool, 'query'>, c: DemoConfig, userId: string) {
  if (!uuid(userId)) throw new Error('Set INSYNC_DEMO_USER_ID to an existing Supabase Auth UUID.')
  await db.query('begin')
  try {
    const user = await db.query('select id from auth.users where id = $1', [userId])
    if (!user.rows.length) throw new Error('Auth user does not exist. Create one through the Supabase dashboard first.')
    const created = await db.query('insert into public.workspaces (id, name) values ($1, $2) on conflict (id) do nothing returning id', [demoWorkspaceId, workspaceName])
    const workspace = await db.query('select name from public.workspaces where id = $1 for update', [demoWorkspaceId])
    const memberships = await db.query('select user_id, role from public.workspace_memberships where workspace_id = $1', [demoWorkspaceId])
    if (workspace.rows[0]?.name !== workspaceName || memberships.rows.some((m) => m.user_id !== userId || m.role !== 'owner')
      || (!created.rows.length && !memberships.rows.some((m) => m.user_id === userId && m.role === 'owner'))) throw new Error('Demo workspace ownership collision; no records were changed.')
    await db.query("insert into public.workspace_memberships (workspace_id, user_id, role) values ($1, $2, 'owner') on conflict do nothing", [demoWorkspaceId, userId])
    const existingTasks = await db.query('select id, user_id, title, component, status from public.tasks where workspace_id = $1 or id = $2', [demoWorkspaceId, demoTaskId])
    if (existingTasks.rows.some((t) => t.id !== demoTaskId || t.user_id !== userId || t.component !== 'ProductList' || t.title !== 'Build ProductList pagination' || t.status !== 'in_progress')) throw new Error('Demo task ownership or content collision; no records were changed.')
    // Also check workspace on the reserved ID (a cross-workspace collision must fail).
    const taskCollision = await db.query('select workspace_id from public.tasks where id = $1', [demoTaskId])
    if (taskCollision.rows.some((t) => t.workspace_id !== demoWorkspaceId)) throw new Error('Demo task workspace collision.')
    await db.query("insert into public.tasks (id, workspace_id, user_id, title, component, status) values ($1, $2, $3, 'Build ProductList pagination', 'ProductList', 'in_progress') on conflict (id) do nothing", [demoTaskId, demoWorkspaceId, userId])
    const deps = await db.query('select id, task_id, endpoint, used_fields from public.task_api_dependencies where task_id = $1 or id = $2', [demoTaskId, dependencyId])
    if (deps.rows.some((d) => d.id !== dependencyId || d.task_id !== demoTaskId || d.endpoint !== 'GET /products' || JSON.stringify(d.used_fields) !== '["totalPages"]')) throw new Error('Demo dependency collision; existing mappings were preserved.')
    await db.query("insert into public.task_api_dependencies (id, task_id, endpoint, used_fields) values ($1, $2, 'GET /products', array['totalPages']) on conflict (id) do nothing", [dependencyId, demoTaskId])
    for (const [id, provider, externalId] of [[githubId, 'github', c.repository], [slackId, 'slack', c.channel]]) {
      const scopes = await db.query('select id, workspace_id, provider, external_id from public.source_scopes where id = $1 or (workspace_id = $2 and provider = $3 and external_id = $4)', [id, demoWorkspaceId, provider, externalId])
      if (scopes.rows.some((s) => s.id !== id || s.workspace_id !== demoWorkspaceId || s.provider !== provider || s.external_id !== externalId)) throw new Error('Demo source scope collision; grants were preserved.')
      // Refuse a changed target under a reused dedicated workspace.
      const other = await db.query('select id from public.source_scopes where workspace_id = $1 and provider = $2 and id <> $3', [demoWorkspaceId, provider, id])
      if (other.rows.length) throw new Error('Demo source target collision.')
      await db.query('insert into public.source_scopes (id, workspace_id, provider, external_id, display_name) values ($1, $2, $3, $4, $4) on conflict (id) do nothing', [id, demoWorkspaceId, provider, externalId])
      await db.query('insert into public.user_source_access (workspace_id, user_id, source_id) values ($1, $2, $3) on conflict do nothing', [demoWorkspaceId, userId, id])
    }
    await db.query('commit')
  } catch (e) { await db.query('rollback'); throw e }
}
export async function verifyTaskSetup(db: Pool, c: DemoConfig, userId: string, workspaceId: string) {
  if (!uuid(userId) || !uuid(workspaceId)) throw new Error('Set valid local demo user/workspace UUIDs.')
  const task = (await listAssignedTasks(db, userId, workspaceId)).find((t) => t.id === demoTaskId)
  const sources = await listUserSources(db, userId, workspaceId)
  if (!task || task.component !== 'ProductList' || !task.dependencies.some((d) => d.endpoint === 'GET /products' && d.usedFields.includes('totalPages'))) throw new Error('ProductList assignment or dependency is missing for this workspace member.')
  if (!sources.some((s) => s.provider === 'github' && s.externalId === c.repository) || !sources.some((s) => s.provider === 'slack' && s.externalId === c.channel)) throw new Error('Scenario source access is missing or opted out.')
  return task
}
