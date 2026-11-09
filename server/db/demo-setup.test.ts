import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'
import type { Pool } from 'pg'
import { applyTaskSetup, demoTaskId, demoWorkspaceId, verifyTaskSetup } from '../real-demo/task-setup.ts'
import { demoConfig } from '../real-demo/config.ts'
const env = { GITHUB_REPOSITORY: 'demo/repo', GITHUB_OWNER: 'demo', GITHUB_REPO: 'repo', SLACK_CHANNEL_ID: 'C123', GITHUB_DEMO_ALLOWLIST: 'demo/repo', SLACK_DEMO_ALLOWLIST: 'C123' }
const config = demoConfig(env)
const userId = '00000000-0000-4000-8000-000000000007'
const otherId = '00000000-0000-4000-8000-000000000008'
async function database() {
  const db = new PGlite()
  await db.exec("create schema auth; create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb); create role anon; create role authenticated;")
  for (const file of ['20261106000000_initial_schema.sql', '20261106000001_tasks_schema.sql']) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  await db.query('insert into auth.users (id) values ($1), ($2)', [userId, otherId])
  return db
}
test('dedicated setup is repeatable, authorizes task + sources, and preserves unrelated records', async () => {
  const db = await database(); const pool = db as unknown as Pool
  try {
    await db.query("insert into public.workspaces (id,name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Existing team')")
    await applyTaskSetup(pool, config, userId)
    assert.equal((await verifyTaskSetup(pool, config, userId, demoWorkspaceId)).id, demoTaskId)
    const snapshot = async () => {
      const tables = ['workspaces', 'workspace_memberships', 'tasks', 'task_api_dependencies', 'source_scopes', 'user_source_access']
      return Promise.all(tables.map(async (t) => (await db.query(`select * from public.${t} order by 1`)).rows))
    }
    const before = await snapshot()
    await applyTaskSetup(pool, config, userId)
    assert.deepEqual(await snapshot(), before)
    await assert.rejects(verifyTaskSetup(pool, config, otherId, demoWorkspaceId), /assignment/)
    await db.query('insert into public.user_source_preferences (workspace_id,user_id,source_id,included) select workspace_id,user_id,source_id,false from public.user_source_access where user_id = $1', [userId])
    await assert.rejects(verifyTaskSetup(pool, config, userId, demoWorkspaceId), /source access/)
  } finally { await db.close() }
})
test('setup rejects missing Auth users, workspace ownership collisions, changed mappings and changed targets without partial changes', async () => {
  const db = await database(); const pool = db as unknown as Pool
  try {
    await assert.rejects(applyTaskSetup(pool, config, '00000000-0000-4000-8000-000000000099'), /Auth user/)
    assert.equal((await db.query('select * from public.workspaces')).rows.length, 0)
    await applyTaskSetup(pool, config, userId)
    await assert.rejects(applyTaskSetup(pool, config, otherId), /ownership collision/)
    await assert.rejects(applyTaskSetup(pool, { ...config, repository: 'other/repo' }, userId), /source.*collision/)
    await db.query("update public.task_api_dependencies set used_fields = array['items'] where task_id = $1", [demoTaskId])
    await assert.rejects(applyTaskSetup(pool, config, userId), /dependency collision/)
    assert.deepEqual((await db.query('select used_fields from public.task_api_dependencies where task_id = $1', [demoTaskId])).rows[0]?.used_fields, ['items'])
    assert.equal((await db.query('select * from public.user_source_access')).rows.length, 2)
  } finally { await db.close() }
})
test('a reserved task in another workspace rolls back the new demo workspace and membership', async () => {
  const db = await database(); const pool = db as unknown as Pool
  try {
    await db.query("insert into public.workspaces (id,name) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Existing team')")
    await db.query("insert into public.tasks (id,workspace_id,user_id,title,component) values ($1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',$2,'Build ProductList pagination','ProductList')", [demoTaskId, userId])
    await assert.rejects(applyTaskSetup(pool, config, userId), /workspace collision/)
    assert.equal((await db.query('select * from public.workspaces where id = $1', [demoWorkspaceId])).rows.length, 0)
    assert.equal((await db.query('select * from public.workspace_memberships')).rows.length, 0)
  } finally { await db.close() }
})
test('task setup CLI is dry-run without a database or Auth user and requires exact apply confirmation', () => {
  const childEnv = { ...process.env, ...env, INSYNC_DEMO_USER_ID: '', DATABASE_URL: '' }; delete childEnv.NODE_TEST_CONTEXT
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import','tsx','server/real-demo/setup-cli.ts', ...args], { env: childEnv, encoding: 'utf8' })
  const dry = run(); assert.equal(dry.status, 0, dry.stderr); assert.equal(JSON.parse(dry.stdout).dryRun, true)
  childEnv.INSYNC_DEMO_USER_ID = userId
  const apply = run('--apply'); assert.equal(apply.status, 1); assert.match(apply.stderr, /confirmation required/)
})
test('an existing reserved workspace without proven owner membership is not adopted', async () => {
  const db = await database()
  try {
    await db.query('insert into public.workspaces (id,name) values ($1,$2)', [demoWorkspaceId, 'InSync · ProductList gallery demo'])
    await assert.rejects(applyTaskSetup(db as unknown as Pool, config, userId), /ownership collision/)
    assert.equal((await db.query('select * from public.workspace_memberships')).rows.length, 0)
    assert.equal((await db.query('select * from public.tasks')).rows.length, 0)
  } finally { await db.close() }
})
