import 'dotenv/config'
import { demoConfig } from './config.ts'
import { applyTaskSetup, demoWorkspaceId, taskConfirmation, taskSetupPlan, uuid } from './task-setup.ts'
import { createDatabasePool } from '../db/pool.ts'
async function main() {
  const args = process.argv.slice(2)
  if (args.some((a, i) => !['--apply', '--dry-run', '--confirm'].includes(a) && args[i - 1] !== '--confirm') || (args.includes('--apply') && args.includes('--dry-run'))) throw new Error('Use --dry-run or --apply --confirm TARGET.')
  const c = demoConfig()
  const userId = process.env.INSYNC_DEMO_USER_ID?.trim() || ''
  const plan = taskSetupPlan(c, userId)
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ dryRun: true, ...plan, confirmation: userId ? taskConfirmation(c, userId) : 'Available after setting INSYNC_DEMO_USER_ID', nextWorkspaceSetting: `INSYNC_DEMO_WORKSPACE_ID=${demoWorkspaceId}` }, null, 2))
    return
  }
  if (!uuid(userId)) throw new Error('Set INSYNC_DEMO_USER_ID to the Auth user you created in the Supabase dashboard.')
  const confirmationIndex = args.indexOf('--confirm')
  if (confirmationIndex < 0 || args[confirmationIndex + 1] !== taskConfirmation(c, userId)) throw new Error('Explicit target confirmation required. Preview demo:setup-task and use its exact confirmation value.')
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL locally.')
  const pool = createDatabasePool(process.env.DATABASE_URL)
  try {
    const client = await pool.connect()
    try { await applyTaskSetup(client, c, userId) } finally { client.release() }
    console.log(`Dedicated ProductList assignment and grants are ready. Set INSYNC_DEMO_WORKSPACE_ID=${demoWorkspaceId} and restart the API.`)
  } finally { await pool.end() }
}
main().catch((e) => { console.error(e instanceof Error && !('severity' in e) ? e.message : 'Task setup database request failed; no partial changes were kept.'); process.exitCode = 1 })
