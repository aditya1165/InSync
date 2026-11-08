import type { DemoSource, PaginationCatchUp } from '../../src/lib/real-demo.ts'
import { DemoApi } from './api.ts'
import type { Manifest } from './manifest.ts'
import { Simulator } from './simulator.ts'
import { backendPath, baselineBackend, cursorBackend, frontendPath, productList } from './scenario.ts'
export interface PaginationEvidence {
  mode: 'live' | 'sample'; pr: PaginationCatchUp['pr']; before: string; after: string; frontend: string
  patch?: string; complete: boolean; humanDiscussion?: boolean; code: DemoSource[]; messages: DemoSource[]
}
export function analyzePagination(input: PaginationEvidence, start: Date, end: Date): PaginationCatchUp {
  const { before, after, frontend, patch = '', messages, pr } = input
  const removed = /\btotalPages\s*:/.test(before) && !/\btotalPages\s*:/.test(after)
  const cursor = /\bnextCursor\s*:/.test(after)
  const consumer = /response\.totalPages\b/.test(frontend)
  const grounded = input.complete && removed && cursor && consumer && /^-.*\btotalPages\b/m.test(patch)
  const times = [pr.timestamp, ...(input.humanDiscussion ? messages.map((m) => m.timestamp) : [])]
  const inWindow = times.some((time) => new Date(time) >= start && new Date(time) < end)
  const proposal = messages.find((m) => /propos/i.test(m.body) && /cursor[- ]based pagination/i.test(m.body))
  const agreement = messages.find((m) => /\+1|\bi agree\b/i.test(m.body))
  const ordered = (a: DemoSource, b: DemoSource) => new Date(a.timestamp) < new Date(b.timestamp)
  const confirmations = messages.filter((m) => /Decision (DEC-\d+) confirmed:/i.test(m.body)
    && /remove totalPages/.test(m.body) && /nextCursor/.test(m.body)
    && !/\b(?:not|never|don't|do not|shouldn't|should not)\b/i.test(m.body))
  const confirmation = confirmations.at(-1)
  const id = confirmation?.body.match(/Decision (DEC-\d+) confirmed:/i)?.[1]?.toUpperCase()
    || messages.map((m) => m.body.match(/\bDEC-\d+\b/i)?.[0]).find(Boolean)?.toUpperCase() || 'Unassigned'
  const superseded = messages.find((m) => new RegExp(`${id}.*superseded`, 'i').test(m.body)
    && (!confirmation || ordered(confirmation, m)))
  const confirmed = !!(proposal && agreement && confirmation && ordered(proposal, agreement) && ordered(agreement, confirmation))
  const linked = messages.find((m) => id !== 'Unassigned' && m.body.includes(id) && !!pr.url && m.body.includes(pr.url))
  const status = superseded ? 'superseded' : confirmed ? 'confirmed' : proposal ? 'proposed' : 'unverified'
  return {
    mode: input.mode, generatedBy: 'evidence_rules', task: { owner: 'Leo', component: 'ProductList', endpoint: 'GET /products' },
    inWindow, impact: grounded ? 'breaking' : 'uncertain',
    explanation: grounded
      ? `PR #${pr.number} removes totalPages from GET /products and returns nextCursor. ProductList still reads response.totalPages to build page buttons. Using this PR's backend with the current frontend would fail the contract test. PR status: ${pr.lifecycle}; deployment is unverified.`
      : 'Impact uncertain: complete backend removal, cursor response, patch, and ProductList consumer evidence are required.',
    actions: grounded ? ['Inspect the backend diff and ProductList source below.', 'Migrate ProductList to nextCursor and next/previous navigation, or agree on a compatibility response.', 'Run the contract test on both branches before merging; coordinate release timing with Maya.'] : ['Inspect the source records and restore missing contract evidence before accepting an impact claim.'],
    uncertainty: ['The PR lifecycle does not establish deployment.', 'The Slack-to-PR relationship requires human review.', ...(!input.complete ? ['PR file evidence is incomplete.'] : [])],
    pr, code: input.code, messages,
    decision: { id, status, evidenceIds: [proposal, agreement, confirmation, superseded].filter((x): x is DemoSource => !!x).map((m) => m.id) },
    link: { status: 'possible', rationale: linked && confirmed
      ? 'The ordered proposal, agreement, and explicit decision confirmation are supported by a message citing this exact PR URL. Review the relationship before confirming it.'
      : 'Possible match based on pagination terminology; an ordered confirmed decision and exact PR reference have not both been established.',
      evidenceIds: [pr.id, ...(linked ? [linked.id] : []), ...(confirmation ? [confirmation.id] : [])] },
  }
}
export async function loadPagination(api: DemoApi, manifest: Manifest, start: Date, end: Date, humanThreadTs?: string) {
  if (manifest.cleaned) throw new Error('Demo run has been cleaned; create and verify a new run.')
  const simulator = new Simulator(api, manifest, async () => {})
  const { pr, messages } = humanThreadTs
    ? { pr: await simulator.verifyGitHub(), messages: (await api.thread(humanThreadTs)).filter((m) => !m.bot_id && !m.app_id && typeof m.user === 'string') }
    : await simulator.verify()
  const baseSha = pr.base.sha; const headSha = pr.head.sha
  const read = async (path: string, sha: string) => {
    const record = await api.gh(`/contents/${path}?ref=${sha}`)
    if (record.encoding !== 'base64' || typeof record.content !== 'string') throw new Error('Code evidence unavailable.')
    return Buffer.from(record.content, 'base64').toString('utf8')
  }
  const [before, after, frontend] = await Promise.all([read(backendPath, baseSha), read(backendPath, headSha), read(frontendPath, headSha)])
  // Read the real patch. Refuse to claim complete evidence if GitHub omits it.
  const files: any[] = []; let complete = false
  for (let page = 1; page <= 10; page++) {
    const batch = await api.gh(`/pulls/${pr.number}/files?per_page=100&page=${page}`)
    files.push(...batch)
    if (batch.length < 100) { complete = true; break }
  }
  const change = files.find((f) => f.filename === backendPath)
  const timestamp = [pr.created_at, pr.updated_at].find((value) => new Date(value) >= start && new Date(value) < end) || pr.updated_at || pr.created_at
  const code = [
    { id: `github:${baseSha}:${backendPath}`, title: 'Backend before the PR', body: before, url: `https://github.com/${api.config.repository}/blob/${baseSha}/${backendPath}`, timestamp },
    { id: `github:${headSha}:${backendPath}`, title: 'Backend proposed response', body: after, url: `https://github.com/${api.config.repository}/blob/${headSha}/${backendPath}`, timestamp },
    { id: `github:${headSha}:${frontendPath}`, title: 'ProductList consumer (Leo)', body: frontend, url: `https://github.com/${api.config.repository}/blob/${headSha}/${frontendPath}`, timestamp },
    { id: `github:pr:${pr.id}:patch`, title: 'Actual GitHub PR patch', body: change?.patch || 'Patch unavailable', url: `${pr.html_url}/files`, timestamp },
  ]
  const sources: DemoSource[] = []
  for (const message of messages) {
    const permalink = await api.slack('chat.getPermalink', { channel: api.config.channel, message_ts: message.ts })
    sources.push({ id: `slack:${api.config.channel}:${message.ts}`, title: `Slack message · ${message.user || message.bot_id || 'unknown'}`, body: message.text || '', actorId: message.user || message.bot_id,
      timestamp: new Date(Number(message.ts) * 1000).toISOString(), url: permalink.permalink })
  }
  return analyzePagination({ mode: 'live', pr: { id: `github:pr:${pr.id}`, number: pr.number, title: pr.title, body: pr.body || '', timestamp,
    url: pr.html_url, lifecycle: pr.merged_at ? 'merged' : pr.state }, before, after, frontend, patch: change?.patch,
    complete: complete && !!change?.patch, humanDiscussion: !!humanThreadTs, code, messages: sources.sort((a,b) => a.timestamp.localeCompare(b.timestamp)) }, start, end)
}
export function samplePagination(start: Date, end: Date) {
  const stamp = (hours: number) => new Date(end.getTime() - hours * 3600000).toISOString()
  return analyzePagination({ mode: 'sample', complete: true, before: baselineBackend, after: cursorBackend, frontend: productList,
    patch: '-  return { items, totalPages: 2 };\n+  return { items, nextCursor: null };',
    pr: { id: 'sample:pr', number: 1, title: 'Replace offset pagination with cursor-based pagination', body: 'Scripted sample; no remote PR.', timestamp: stamp(24), lifecycle: 'open' },
    code: [{ id: 'sample:before', title: 'Sample backend before', body: baselineBackend, timestamp: stamp(24) }, { id: 'sample:after', title: 'Sample backend after', body: cursorBackend, timestamp: stamp(24) }, { id: 'sample:ProductList', title: 'Sample ProductList', body: productList, timestamp: stamp(24) }],
    messages: [
      { id: 'sample:proposal', title: 'Simulated Tuesday · Maya', body: 'I propose cursor-based pagination for GET /products.', timestamp: stamp(72) },
      { id: 'sample:agreement', title: 'Simulated Tuesday · Sam', body: '+1 to cursor-based pagination.', timestamp: stamp(71) },
      { id: 'sample:confirmation', title: 'Simulated Tuesday · Maya', body: 'Decision DEC-14 confirmed: remove totalPages and return nextCursor.', timestamp: stamp(70) },
    ],
  }, start, end)
}
