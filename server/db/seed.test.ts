import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const sameerId = '00000000-0000-4000-8000-000000000001'
const profileTaskId = 'd0000000-0000-4000-8000-000000000001'

test('Supabase schema & seed script populates Sameer task mapping and respects privacy constraints', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create schema auth;
      create table auth.users (
        id uuid primary key,
        raw_user_meta_data jsonb not null default '{}'::jsonb
      );
      create role anon;
      create role authenticated;
    `)

    const initialMigration = await readFile(
      new URL('../../supabase/migrations/20261106000000_initial_schema.sql', import.meta.url),
      'utf8',
    )
    await db.exec(initialMigration)

    const tasksMigration = await readFile(
      new URL('../../supabase/migrations/20261106000001_tasks_schema.sql', import.meta.url),
      'utf8',
    )
    await db.exec(tasksMigration)

    const seedSql = await readFile(
      new URL('../../supabase/seed.sql', import.meta.url),
      'utf8',
    )
    await db.exec(seedSql)

    // Verify user Sameer profile
    const profileResult = await db.query<{ display_name: string }>(
      'select display_name from public.profiles where id = $1',
      [sameerId],
    )
    assert.equal(profileResult.rows[0]?.display_name, 'Sameer')

    // Verify task for user Sameer
    const taskResult = await db.query<{ id: string; title: string; component: string; status: string }>(
      'select id, title, component, status from public.tasks where user_id = $1',
      [sameerId],
    )
    assert.equal(taskResult.rows.length, 1)
    assert.equal(taskResult.rows[0]?.id, profileTaskId)
    assert.equal(taskResult.rows[0]?.title, 'Build profile settings component')
    assert.equal(taskResult.rows[0]?.component, 'ProfileSettings')
    assert.equal(taskResult.rows[0]?.status, 'in_progress')

    // Verify API dependency mapping
    const dependencyResult = await db.query<{ endpoint: string; used_fields: string[] }>(
      'select endpoint, used_fields from public.task_api_dependencies where task_id = $1',
      [profileTaskId],
    )
    assert.equal(dependencyResult.rows.length, 1)
    assert.equal(dependencyResult.rows[0]?.endpoint, 'GET /users/id')
    assert.deepEqual(dependencyResult.rows[0]?.used_fields, ['user_name'])

    // Verify RLS enabled on tasks and task_api_dependencies
    const rlsCheck = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname in ('tasks', 'task_api_dependencies')`,
    )
    assert.equal(rlsCheck.rows.length, 2)
    assert.ok(rlsCheck.rows.every((row) => row.relrowsecurity))

    // Verify constraint: strictly NO tables for storing external Slack messages or GitHub diffs
    const externalStorageTables = await db.query<{ tablename: string }>(
      `select tablename from pg_tables
        where schemaname = 'public'
          and tablename in ('slack_messages', 'slack_threads', 'github_diffs', 'pr_diffs', 'external_messages')`,
    )
    assert.equal(externalStorageTables.rows.length, 0, 'No tables should store external messages or diffs.')
  } finally {
    await db.close()
  }
})
