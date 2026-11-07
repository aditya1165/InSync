import type { Pool } from 'pg'
import type { RangeChoice, TimeWindow } from '../../src/lib/time.ts'

export interface SourceScope {
  id: string
  provider: 'github' | 'slack'
  externalId: string
  displayName: string
}

export interface SuccessfulCatchUp {
  id: string
  coveredThrough: Date
  completedAt: Date
}

function validateWindow(window: TimeWindow): void {
  if (!Number.isFinite(window.start.getTime()) ||
      !Number.isFinite(window.end.getTime()) ||
      window.start >= window.end) {
    throw new Error('The catch-up window must have valid dates with start before end.')
  }
}

// Every query includes both the signed-in user ID and selected workspace ID.
// The membership join is essential while Fastify uses a privileged DB connection.
export async function listUserSources(
  db: Pool,
  userId: string,
  workspaceId: string,
): Promise<SourceScope[]> {
  const result = await db.query<{
    id: string
    provider: 'github' | 'slack'
    external_id: string
    display_name: string
  }>(
    `select s.id, s.provider, s.external_id, s.display_name
       from public.workspace_memberships m
       join public.user_source_access a
         on a.workspace_id = m.workspace_id and a.user_id = m.user_id
       join public.source_scopes s
         on s.workspace_id = a.workspace_id and s.id = a.source_id
       left join public.user_source_preferences p
         on p.workspace_id = m.workspace_id
        and p.user_id = m.user_id
        and p.source_id = s.id
      where m.workspace_id = $1 and m.user_id = $2
        and coalesce(p.included, true)
      order by s.provider, s.display_name`,
    [workspaceId, userId],
  )

  return result.rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    externalId: row.external_id,
    displayName: row.display_name,
  }))
}

export async function getLastCoveredThrough(
  db: Pool,
  userId: string,
  workspaceId: string,
): Promise<Date | null> {
  const result = await db.query<{ covered_through: Date | null }>(
    `select max(r.window_end) as covered_through
       from public.workspace_memberships m
       left join public.catchup_runs r
         on r.workspace_id = m.workspace_id and r.user_id = m.user_id
      where m.workspace_id = $1 and m.user_id = $2`,
    [workspaceId, userId],
  )
  return result.rows[0]?.covered_through ?? null
}

export async function recordSuccessfulCatchUp(
  db: Pool,
  input: {
    userId: string
    workspaceId: string
    rangeChoice: RangeChoice
    window: TimeWindow
    activityCount: number
  },
): Promise<SuccessfulCatchUp> {
  validateWindow(input.window)
  if (!Number.isInteger(input.activityCount) || input.activityCount < 0) {
    throw new Error('activityCount must be a non-negative integer.')
  }

  const result = await db.query<{
    id: string
    window_end: Date
    completed_at: Date
  }>(
    `insert into public.catchup_runs
       (workspace_id, user_id, range_choice, window_start, window_end, activity_count)
     select m.workspace_id, m.user_id, $3, $4, $5, $6
       from public.workspace_memberships m
      where m.workspace_id = $1 and m.user_id = $2
     returning id, window_end, completed_at`,
    [
      input.workspaceId,
      input.userId,
      input.rangeChoice,
      input.window.start,
      input.window.end,
      input.activityCount,
    ],
  )

  if (result.rows.length !== 1) {
    throw new Error('User is not a member of this workspace.')
  }
  const row = result.rows[0]!
  return { id: row.id, coveredThrough: row.window_end, completedAt: row.completed_at }
}
