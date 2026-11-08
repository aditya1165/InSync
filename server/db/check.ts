import 'dotenv/config'
import { createDatabasePool } from './pool.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Set DATABASE_URL in .env before running npm run db:check.')
}

const pool = createDatabasePool(connectionString)
try {
  const result = await pool.query<{
    profiles: string | null
    memberships: string | null
    sources: string | null
    access: string | null
    catchups: string | null
    tasks: string | null
    mappings: string | null
  }>(
    `select to_regclass('public.profiles')::text as profiles,
            to_regclass('public.workspace_memberships')::text as memberships,
            to_regclass('public.source_scopes')::text as sources,
            to_regclass('public.user_source_access')::text as access,
            to_regclass('public.catchup_runs')::text as catchups,
            to_regclass('public.tasks')::text as tasks,
            to_regclass('public.task_api_dependencies')::text as mappings`,
  )
  const row = result.rows[0]
  if (!row || Object.values(row).some((value) => value === null)) {
    throw new Error('Database connected, but the InSync migration has not been applied.')
  }
  console.log('Database connected; InSync schema is present.')
} finally {
  await pool.end()
}
