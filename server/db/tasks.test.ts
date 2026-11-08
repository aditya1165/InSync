import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Pool } from 'pg'
import { listAssignedTasks } from './tasks.ts'

test('assigned tasks come from the selected member and include mapped endpoints', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth; create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb); create role anon; create role authenticated;`)
    await db.exec(await readFile(new URL('../../supabase/migrations/20261106000000_initial_schema.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../../supabase/migrations/20261106000001_tasks_schema.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../../supabase/seed.sql', import.meta.url), 'utf8'))

    const queryable = db as unknown as Pick<Pool, 'query'>
    const userId = '00000000-0000-4000-8000-000000000001'
    const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const tasks = await listAssignedTasks(queryable, userId, workspaceId)
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0]?.title, 'Build profile settings component')
    assert.deepEqual(tasks[0]?.dependencies, [{ endpoint: 'GET /users/id', usedFields: ['user_name'] }])

    assert.deepEqual(await listAssignedTasks(queryable, '00000000-0000-4000-8000-000000000002', workspaceId), [])
    assert.deepEqual(await listAssignedTasks(queryable, userId, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), [])
  } finally {
    await db.close()
  }
})
