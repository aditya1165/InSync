import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { ReplaySettings } from '../../src/lib/real-demo.ts'
import type { DemoConfig } from './config.ts'
import type { Manifest } from './manifest.ts'
import { DemoApi } from './api.ts'
import { loadPagination } from './analysis.ts'

/** Identifiers and dates only. Human messages never enter simulator ownership. */
export interface ReplayProfile extends ReplaySettings {
  version: 1
  repository: string
  channel: string
  runId: string
}
function profilePath(c: DemoConfig) {
  const path = resolve(c.manifestPath.replace(/\.json$/, '.replay.json'))
  if (!path.startsWith(resolve('.demo') + sep) || !path.endsWith('.replay.json')) throw new Error('Replay must stay inside .demo beside its manifest.')
  return path
}
export function assertReplay(p: ReplayProfile, c: DemoConfig, manifest?: Manifest) {
  if (p.version !== 1 || p.repository !== c.repository || p.channel !== c.channel || p.runId !== c.runId
    || !/^\d+\.\d{6}$/.test(p.threadTs) || !/^DEC-\d+$/.test(p.decisionId)
    || !Number.isSafeInteger(p.prNumber) || p.prNumber < 1
    || !Number.isFinite(Date.parse(p.window?.start)) || !Number.isFinite(Date.parse(p.window?.end))
    || Date.parse(p.window.start) >= Date.parse(p.window.end)
    || (manifest && manifest.pr?.number !== p.prNumber)) throw new Error('Replay target, PR, identifiers or window do not match the approved scenario.')
}
export async function readReplay(c: DemoConfig, manifest?: Manifest): Promise<ReplayProfile | undefined> {
  try {
    const p = JSON.parse(await readFile(profilePath(c), 'utf8'))
    assertReplay(p, c, manifest)
    return p
  } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e }
}
export async function saveReplay(c: DemoConfig, profile: ReplayProfile) {
  assertReplay(profile, c)
  const path = profilePath(c)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path + '.tmp', JSON.stringify(profile, null, 2) + '\n', { mode: 0o600 })
  await rename(path + '.tmp', path)
}
export function replaySettings(p: ReplayProfile): ReplaySettings {
  return { threadTs: p.threadTs, decisionId: p.decisionId, prNumber: p.prNumber, window: p.window }
}
/** Read-only discovery; refuse ambiguity instead of silently pinning another conversation. */
export async function pinReplay(api: DemoApi, manifest: Manifest, threadTs?: string): Promise<ReplayProfile> {
  await api.validateReads(manifest.teamId)
  if (!threadTs) {
    const roots = (await api.history()).filter((m) => !m.bot_id && !m.app_id && m.user && /\bDEC-15\b|cursor[- ]based pagination/i.test(m.text || ''))
    if (roots.length !== 1) throw new Error('Expected one human DEC-15 parent. Supply --thread-ts with the intended human thread ID.')
    threadTs = roots[0].ts
  }
  if (!/^\d+\.\d{6}$/.test(threadTs!)) throw new Error('Invalid human thread ID.')
  const data = await loadPagination(api, manifest, new Date(0), new Date(), threadTs)
  if (data.decision.id !== 'DEC-15' || data.decision.status !== 'confirmed' || data.impact !== 'breaking') {
    throw new Error('Expected inspectable confirmed DEC-15 and complete pagination contract evidence before pinning.')
  }
  const times = [data.pr.createdAt || data.pr.timestamp, data.pr.updatedAt || data.pr.timestamp, ...data.messages.map((m) => m.timestamp)].map(Date.parse)
  const profile: ReplayProfile = { version: 1, repository: api.config.repository, channel: api.config.channel, runId: api.config.runId,
    threadTs: threadTs!, decisionId: data.decision.id, prNumber: data.pr.number,
    window: { start: new Date(Math.min(...times) - 1000).toISOString(), end: new Date(Math.max(...times) + 1000).toISOString() } }
  assertReplay(profile, api.config, manifest)
  return profile
}
