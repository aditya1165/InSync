import 'dotenv/config'
import { mkdir, open, unlink } from 'node:fs/promises'
import { DemoApi } from './api.ts'
import { confirmation, demoConfig, requireCredentials } from './config.ts'
import { newManifest, readManifest, saveManifest } from './manifest.ts'
import { plan, Simulator } from './simulator.ts'
import { pinReplay, readReplay, saveReplay } from './replay.ts'
import { loadPagination } from './analysis.ts'
import { createDatabasePool } from '../db/pool.ts'
import { verifyTaskSetup } from './task-setup.ts'

async function main() {
  const [command = 'seed', ...args] = process.argv.slice(2)
  if (!['seed', 'verify', 'validate', 'cleanup', 'pin'].includes(command)) throw new Error('Use seed, validate, verify, pin, or cleanup.')
  const flags = new Map<string, string>()
  for (let i = 0; i < args.length; i++) {
    const flag = args[i]!
    if (['--apply', '--dry-run'].includes(flag)) flags.set(flag, 'true')
    else if (['--confirm', '--only', '--thread-ts'].includes(flag) && args[i + 1]) flags.set(flag, args[++i]!)
    else throw new Error('Unknown or incomplete CLI argument.')
  }
  if (flags.has('--apply') && flags.has('--dry-run')) throw new Error('Choose --apply or --dry-run.')
  const c = demoConfig()
  const writes = command === 'seed' || command === 'cleanup'
  if (writes && !flags.has('--apply')) {
    console.log(JSON.stringify({ command, dryRun: true, ...plan(c),
      ...(command === 'cleanup' ? { only: flags.get('--only') || 'all', recorded: await readManifest(c) || 'No recorded resources' } : {}) }, null, 2))
    return
  }
  if (writes && flags.get('--confirm') !== confirmation(c)) throw new Error(`Explicit target confirmation required: --confirm ${confirmation(c)}`)
  requireCredentials(c)
  const api = new DemoApi(c)
  if (command === 'validate') { await api.validate(); console.log('Credentials and allowlisted targets validated.'); return }
  // A local exclusive lock prevents concurrent seed processes from duplicating posts.
  await mkdir('.demo', { recursive: true, mode: 0o700 })
  const lock = `.demo/${c.runId}.lock`
  const handle = await open(lock, 'wx', 0o600).catch(() => { throw new Error('Run is locked. If a previous process crashed, confirm it has stopped before removing its .demo/*.lock file.') })
  try {
    const previous = await readManifest(c)
    if (!previous && command !== 'seed') throw new Error('No manifest. Cleanup and verification require the original journal.')
    const simulator = new Simulator(api, previous || newManifest(c), (m) => saveManifest(c, m))
    if (command === 'seed') await simulator.seed()
    if (command === 'pin') {
      const profile = await pinReplay(api, simulator.manifest, flags.get('--thread-ts'))
      await saveReplay(c, profile)
      console.log('Saved human DEC-15 identifiers and real event window in the ignored replay profile. No remote writes.')
    }
    if (command === 'verify') {
      const profile = await readReplay(c, simulator.manifest)
      if (!profile) throw new Error('Pin the human DEC-15 thread with demo:pin first.')
      if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL and the demo assignment before verification.')
      const db = createDatabasePool(process.env.DATABASE_URL)
      try {
        const task = await verifyTaskSetup(db, c, process.env.INSYNC_DEMO_USER_ID || '', process.env.INSYNC_DEMO_WORKSPACE_ID || '')
        await api.validateReads(simulator.manifest.teamId)
        const result = await loadPagination(api, simulator.manifest, new Date(profile.window.start), new Date(profile.window.end), profile.threadTs, task)
        if (result.pr.number !== profile.prNumber || result.decision.id !== profile.decisionId || result.decision.status !== 'confirmed' || result.impact !== 'breaking' || !result.inWindow) throw new Error('Pinned decision or contract evidence is missing, changed, or outside the saved window.')
        console.log('Read-only checks passed: member assignment, mapping, source grants, pinned human discussion, PR lifecycle and contract evidence.')
      } finally { await db.end() }
    }
    if (command === 'cleanup') {
      const only = flags.get('--only') || 'all'
      if (!['all', 'github', 'slack'].includes(only)) throw new Error('--only must be all, github, or slack.')
      await simulator.cleanup(only as 'all' | 'github' | 'slack')
    }
    console.log(`${command} completed. Journal: ${c.manifestPath}${simulator.manifest.pr ? `; PR: ${simulator.manifest.pr.url}` : ''}`)
  } finally { await handle.close(); await unlink(lock) }
}
main().catch((e) => { console.error(e instanceof Error && !('severity' in e) ? e.message : 'Demo database request failed. Check local database settings.'); process.exitCode = 1 })
