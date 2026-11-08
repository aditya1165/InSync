import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { DemoConfig } from './config.ts'
export interface Manifest {
  version: 1; runId: string; repository: string; channel: string; createdAt: string
  repoId?: number; teamId?: string; botId?: string
  branches: Record<string, { name: string; sha: string; url?: string; committedAt?: string }>
  messages: Record<string, { ts: string; threadTs: string; url?: string; text: string }>
  pr?: { number: number; id: number; url: string; createdAt: string }
  relationship?: { decisionId: string; proposalTs: string; confirmationTs: string; prNumber: number; component: string; review: 'pending' }
  intents?: string[]; pending?: string; verifiedAt?: string; cleaned?: boolean
}
export function newManifest(c: DemoConfig): Manifest {
  return { version: 1, runId: c.runId, repository: c.repository, channel: c.channel,
    createdAt: new Date().toISOString(), branches: {}, messages: {} }
}
export function assertManifest(m: Manifest, c: DemoConfig) {
  if (m.version !== 1 || m.runId !== c.runId || m.repository !== c.repository || m.channel !== c.channel || !m.branches || !m.messages) throw new Error('Manifest target/schema mismatch; refusing cross-target access.')
  if (m.pr && (!Number.isSafeInteger(m.pr.number) || m.pr.number < 1 || !Number.isSafeInteger(m.pr.id) || m.pr.url.toLowerCase() !== `https://github.com/${c.repository}/pull/${m.pr.number}`.toLowerCase())) throw new Error('Unsafe manifest PR identity.')
  for (const message of Object.values(m.messages)) {
    if (!/^\d+\.\d+$/.test(message.ts) || !/^\d+\.\d+$/.test(message.threadTs) || typeof message.text !== 'string') throw new Error('Unsafe manifest Slack identity.')
  }
  for (const [key, branch] of Object.entries(m.branches)) {
    if (!['base', 'head'].includes(key) || branch.name !== branchName(c, key) || !/^[a-f0-9]{40}$/.test(branch.sha)) throw new Error('Unsafe manifest branch.')
  }
}
export const branchName = (c: DemoConfig, kind: string) => `insync-demo/${c.runId}-${kind}`
export const marker = (c: DemoConfig) => `[insync:${c.runId}]`
function privatePath(c: DemoConfig) {
  const path = resolve(c.manifestPath)
  if (!path.startsWith(resolve('.demo') + sep) || !path.endsWith('.json')) throw new Error('Manifest must be a .json file inside the gitignored .demo directory.')
  return path
}
export async function readManifest(c: DemoConfig): Promise<Manifest | undefined> {
  try { const m = JSON.parse(await readFile(privatePath(c), 'utf8')); assertManifest(m, c); return m }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e }
}
export async function saveManifest(c: DemoConfig, m: Manifest) {
  assertManifest(m, c)
  const path = privatePath(c)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path + '.tmp', JSON.stringify(m, null, 2) + '\n', { mode: 0o600 })
  await rename(path + '.tmp', path)
}
