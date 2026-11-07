import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import type { Pool } from 'pg'
import { getLastCoveredThrough, listUserSources, recordSuccessfulCatchUp } from './catchup.ts'

const userA = '11111111-1111-4111-8111-111111111111'
const userB = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'
const workspace = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const anotherWorkspace = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const githubSource = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const slackSource = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

test('migration scopes sources and successful checkpoints to workspace members', async () => {
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
    const migration = await readFile(
      new URL('../../supabase/migrations/20261106000000_initial_schema.sql', import.meta.url),
      'utf8',
    )
    await db.exec(migration)

    await db.query(
      `insert into auth.users (id, raw_user_meta_data)
       values ($1, '{"full_name":"Ada"}'), ($2, '{}'), ($3, '{}')`,
      [userA, userB, outsider],
    )
    const profile = await db.query<{ display_name: string }>(
      'select display_name from public.profiles where id = $1', [userA],
    )
    assert.equal(profile.rows[0]?.display_name, 'Ada')
    const protectedTables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relname in ('profiles', 'workspaces', 'workspace_memberships',
                          'source_scopes', 'user_source_access', 'user_source_preferences',
                          'external_identities', 'catchup_runs')`,
    )
    assert.equal(protectedTables.rows.length, 8)
    assert.ok(protectedTables.rows.every((row) => row.relrowsecurity))

    await db.query(
      `insert into public.workspaces (id, name) values ($1, 'Demo'), ($2, 'Other')`,
      [workspace, anotherWorkspace],
    )
    await db.query(
      `insert into public.workspace_memberships (workspace_id, user_id, role)
       values ($1, $2, 'owner'), ($1, $3, 'member')`,
      [workspace, userA, userB],
    )
    await db.query(
      `insert into public.source_scopes
         (id, workspace_id, provider, external_id, display_name)
       values ($1, $3, 'github', 'owner/repo', 'Demo repo'),
              ($2, $3, 'slack', 'C123', 'Planning')`,
      [githubSource, slackSource, workspace],
    )
    const queryable = db as unknown as Pool
    assert.deepEqual(await listUserSources(queryable, userA, workspace), [])
    await db.query(
      `insert into public.user_source_access (workspace_id, user_id, source_id)
       values ($1, $2, $4), ($1, $2, $5), ($1, $3, $4), ($1, $3, $5)`,
      [workspace, userA, userB, githubSource, slackSource],
    )
    await db.query(
      `insert into public.user_source_preferences
         (workspace_id, user_id, source_id, included)
       values ($1, $2, $3, false)`,
      [workspace, userA, slackSource],
    )

    assert.deepEqual(await listUserSources(queryable, userA, workspace), [{
      id: githubSource, provider: 'github', externalId: 'owner/repo', displayName: 'Demo repo',
    }])
    assert.equal((await listUserSources(queryable, userB, workspace)).length, 2)
    assert.deepEqual(await listUserSources(queryable, outsider, workspace), [])

    await assert.rejects(
      db.query(
        `insert into public.user_source_preferences
           (workspace_id, user_id, source_id, included)
         values ($1, $2, $3, true)`,
        [anotherWorkspace, userA, githubSource],
      ),
      /foreign key constraint/,
    )

    const window = {
      start: new Date('2026-11-05T00:00:00.000Z'),
      end: new Date('2026-11-06T00:00:00.000Z'),
    }
    assert.equal(await getLastCoveredThrough(queryable, userA, workspace), null)
    const recorded = await recordSuccessfulCatchUp(queryable, {
      userId: userA, workspaceId: workspace, rangeChoice: 'last24Hours',
      window, activityCount: 3,
    })
    assert.equal(new Date(recorded.coveredThrough).toISOString(), window.end.toISOString())
    await recordSuccessfulCatchUp(queryable, {
      userId: userA, workspaceId: workspace, rangeChoice: 'previousWeek',
      window: {
        start: new Date('2026-10-26T00:00:00.000Z'),
        end: new Date('2026-11-02T00:00:00.000Z'),
      },
      activityCount: 1,
    })
    assert.equal(new Date(await getLastCoveredThrough(queryable, userA, workspace) ?? 0).toISOString(), window.end.toISOString())
    assert.equal(await getLastCoveredThrough(queryable, userB, workspace), null)
    await assert.rejects(recordSuccessfulCatchUp(queryable, {
      userId: outsider, workspaceId: workspace, rangeChoice: 'last24Hours',
      window, activityCount: 0,
    }), /not a member/)
  } finally {
    await db.close()
  }
})
