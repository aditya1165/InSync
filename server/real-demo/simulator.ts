import { DemoApi, ApiError } from './api.ts'
import { confirmation, type DemoConfig } from './config.ts'
import { assertManifest, branchName, marker, type Manifest } from './manifest.ts'
import { baselineFiles, backendPath, cursorBackend, decisionId, prTitle, stagedMessages } from './scenario.ts'
// Slack normalizes plain URLs into <url> (or <url|label>) on retrieval.
export const slackText = (text: string) => text.replace(/<(https?:\/\/[^>|]+)(?:\|[^>]+)?>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
// Thread context query parameters can appear after a parent receives replies.
export function slackMessageUrl(value: string): string {
  const url = new URL(value)
  return url.origin + url.pathname
}
export type Checkpoint = (manifest: Manifest) => Promise<void>
export function plan(c: DemoConfig) {
  return { target: c.repository, channel: c.channel, runId: c.runId, defaultBranch: 'unchanged',
    branches: [branchName(c, 'base'), branchName(c, 'head')],
    files: Object.keys(baselineFiles), pr: { title: prTitle, merge: false },
    messages: [...stagedMessages(c.runId), '[Simulated Thursday] Actual PR URL + discussion permalink cross-reference'],
    confirmation: confirmation(c), note: 'All weekdays are simulated. Platform timestamps are preserved. No writes without --apply and --confirm.' }
}
async function optional<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try { return await fn() } catch (e) { if (e instanceof ApiError && e.status === 404) return undefined; throw e }
}
export class Simulator {
  api: DemoApi; manifest: Manifest; private checkpoint: Checkpoint
  constructor(api: DemoApi, manifest: Manifest, checkpoint: Checkpoint) {
    assertManifest(manifest, api.config); this.api = api; this.manifest = manifest; this.checkpoint = checkpoint
  }
  get c() { return this.api.config }
  async pending(step?: string) { this.manifest.pending = step; await this.checkpoint(this.manifest) }
  async validate() {
    const { repo, auth } = await this.api.validate()
    const m = this.manifest
    if ((m.repoId && m.repoId !== repo.id) || (m.teamId && m.teamId !== auth.team_id) || (m.botId && m.botId !== auth.bot_id)) throw new Error('Remote identity differs from the recorded run.')
    m.repoId = repo.id; m.teamId = auth.team_id; m.botId = auth.bot_id
    await this.checkpoint(m)
    return repo
  }
  async message(key: string, text: string, threadTs?: string) {
    const m = this.manifest
    const expected = `${text} ${marker(this.c)} [step:${key}]`
    if (!m.messages[key]) {
      // Write intent is durable before the API call. Exact markers let an ambiguous
      // POST timeout recover by reading, instead of issuing a second POST.
      await this.pending(`message:${key}`)
      const existing = threadTs ? await this.api.thread(threadTs) : await this.api.history()
      const candidates = existing.filter((x) => x.bot_id === m.botId && x.text?.includes(marker(this.c)) && x.text?.includes(`[step:${key}]`))
      if (candidates.some((x) => slackText(x.text) !== slackText(expected))) throw new Error('Recovery found an edited simulator message; inspect before continuing.')
      const matches = candidates
      if (matches.length > 1) throw new Error('Duplicate simulator messages detected; inspect before continuing.')
      const found = matches[0] || await this.api.slack('chat.postMessage', {
        channel: this.c.channel, text: expected, ...(threadTs ? { thread_ts: threadTs } : {}),
        unfurl_links: false, unfurl_media: false,
      }, true)
      m.messages[key] = { ts: found.ts, threadTs: threadTs || found.ts, text: found.message?.text || found.text || expected }
      await this.checkpoint(m)
    }
    const saved = m.messages[key]!
    if (slackText(saved.text) !== slackText(expected) || saved.threadTs !== (threadTs || saved.ts)) throw new Error('Message checkpoint differs from this scenario version.')
    const link = await this.api.slack('chat.getPermalink', { channel: this.c.channel, message_ts: saved.ts })
    saved.url = link.permalink
    await this.pending()
    return saved
  }
  async branch(kind: 'base' | 'head', parent: string, files: Record<string, string>) {
    const name = branchName(this.c, kind)
    const existing = await optional(() => this.api.gh(`/git/ref/heads/${name}`))
    const saved = this.manifest.branches[kind]
    if (saved) {
      if (!existing || existing.object.sha !== saved.sha) throw new Error('Recorded demo branch changed or disappeared; refusing overwrite.')
      return saved
    }
    if (existing) {
      // Recover only a reference whose creation intent was journaled locally.
      if (!this.manifest.intents?.includes(`branch:${kind}`)) throw new Error(`Branch ${name} already exists and is not owned by this run.`)
      const commit = await this.api.gh(`/git/commits/${existing.object.sha}`)
      if (commit.message !== `${marker(this.c)} ${kind}`) throw new Error('Branch ownership marker mismatch.')
      for (const [path, content] of Object.entries(files)) {
        const f = await this.api.gh(`/contents/${path}?ref=${existing.object.sha}`)
        if (Buffer.from(f.content, 'base64').toString() !== content) throw new Error('Recovered branch content mismatch.')
      }
      this.manifest.branches[kind] = { name, sha: existing.object.sha, url: `https://github.com/${this.c.repository}/commit/${existing.object.sha}`, committedAt: commit.committer?.date }
    } else {
      this.manifest.intents = [...new Set([...(this.manifest.intents || []), `branch:${kind}`])]
      await this.pending(`branch:${kind}`)
      const commit = await this.api.gh(`/git/commits/${parent}`)
      const tree = await this.api.gh('/git/trees', 'POST', { base_tree: commit.tree.sha,
        tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })) })
      const created = await this.api.gh('/git/commits', 'POST', { message: `${marker(this.c)} ${kind}`, tree: tree.sha, parents: [parent] })
      await this.api.gh('/git/refs', 'POST', { ref: `refs/heads/${name}`, sha: created.sha })
      this.manifest.branches[kind] = { name, sha: created.sha, url: `https://github.com/${this.c.repository}/commit/${created.sha}`, committedAt: created.committer?.date }
    }
    await this.pending()
    return this.manifest.branches[kind]!
  }
  async seed() {
    if (this.manifest.cleaned) throw new Error('This run was cleaned; choose a new DEMO_RUN_ID.')
    const repo = await this.validate()
    const [proposal, agreement, decision, migration] = stagedMessages(this.c.runId)
    const root = await this.message('proposal', proposal!)
    const rootUrl = slackMessageUrl(root.url!)
    await this.message('agreement', agreement!, root.ts)
    await this.message('decision', decision!, root.ts)
    await this.message('migration', migration!, root.ts)
    const main = await this.api.gh(`/git/ref/heads/${repo.default_branch}`)
    const base = await this.branch('base', main.object.sha, baselineFiles)
    const head = await this.branch('head', base.sha, { [backendPath]: cursorBackend })
    if (!this.manifest.pr) {
      await this.pending('pr')
      const prs = await this.api.gh(`/pulls?state=all&head=${encodeURIComponent(`${this.c.owner}:${head.name}`)}&base=${encodeURIComponent(base.name)}&per_page=100`)
      if (prs.length > 1) throw new Error('Multiple PRs for this run; inspect before continuing.')
      if (prs[0] && !prs[0].body?.includes(marker(this.c))) throw new Error('Existing PR is not owned by this simulator.')
      if (prs[0] && (prs[0].state !== 'open' || prs[0].merged_at)) throw new Error('Existing demo PR is closed or merged; choose a new run ID after cleanup.')
      const pr = prs[0] || await this.api.gh('/pulls', 'POST', {
        title: prTitle, head: head.name, base: base.name,
        body: `${marker(this.c)}\n\nStaged InSync demo. Simulated Thursday (actual platform timestamps apply).\n\nImplements ${decisionId}: replace offset pagination with cursors; remove totalPages and return nextCursor.\n\nDiscussion: ${rootUrl}\nConfirmed decision: ${this.manifest.messages.decision!.url}\n\nLeo's ProductList still reads totalPages. This is an OPEN proposal, not deployed.\n\nReproduce: node --test insync-pagination-demo/contract.test.mjs\nBaseline passes; head intentionally fails until the frontend migration.\n\nNo merge is authorized.`,
      })
      this.manifest.pr = { id: pr.id, number: pr.number, url: pr.html_url, createdAt: pr.created_at }
      await this.pending()
    }
    await this.message('pr-link', `[InSync staged demo ${this.c.runId}] [Simulated Thursday — Maya, fictional backend developer] PR implements ${decisionId}: ${this.manifest.pr.url}. ProductList still expects totalPages. Discussion: ${rootUrl}. Not merged or deployed.`, root.ts)
    this.manifest.relationship = { decisionId, proposalTs: root.ts, confirmationTs: this.manifest.messages.decision!.ts, prNumber: this.manifest.pr.number, component: 'ProductList', review: 'pending' }
    await this.verify()
    return this.manifest
  }
  async verifyGitHub() {
    assertManifest(this.manifest, this.c)
    const m = this.manifest
    if (!m.pr || !m.branches.head || !m.branches.base) throw new Error('Run is incomplete; rerun seed to recover.')
    const pr = await this.api.gh(`/pulls/${m.pr.number}`)
    if (pr.head.sha !== m.branches.head.sha || pr.base.sha !== m.branches.base.sha || pr.id !== m.pr.id || !pr.body?.includes(marker(this.c)) || pr.head.ref !== m.branches.head.name || pr.base.ref !== m.branches.base.name || pr.head.repo?.full_name?.toLowerCase() !== this.c.repository.toLowerCase()) throw new Error('PR identity/provenance mismatch.')
    for (const branch of Object.values(m.branches)) {
      const ref = await this.api.gh(`/git/ref/heads/${branch.name}`)
      if (ref.object.sha !== branch.sha) throw new Error('Demo branch changed; refusing to verify stale evidence.')
    }
    return pr
  }
  async verify() {
    const pr = await this.verifyGitHub()
    const m = this.manifest
    if (!m.messages.proposal) throw new Error('Slack proposal checkpoint is missing.')
    const messages = await this.api.thread(m.messages.proposal.ts)
    for (const entry of Object.values(m.messages)) {
      if (!messages.some((x) => x.ts === entry.ts && slackText(x.text) === slackText(entry.text) && x.bot_id === m.botId && (x.thread_ts || x.ts) === entry.threadTs)) throw new Error('Slack evidence missing, edited, or not owned by simulator.')
      const link = await this.api.slack('chat.getPermalink', { channel: this.c.channel, message_ts: entry.ts })
      if (entry.url && slackMessageUrl(entry.url) !== slackMessageUrl(link.permalink)) throw new Error('Slack permalink changed.')
      entry.url = link.permalink
    }
    m.verifiedAt = new Date().toISOString()
    await this.checkpoint(m)
    return { pr, messages }
  }
  async cleanup(only: 'all' | 'github' | 'slack' = 'all') {
    await this.validate()
    const m = this.manifest
    if (only !== 'slack') {
      // Preflight all GitHub ownership checks before any GitHub deletion.
      if (m.pr) {
        const pr = await this.api.gh(`/pulls/${m.pr.number}`)
        if (pr.id !== m.pr.id || !pr.body?.includes(marker(this.c)) || pr.merged_at || pr.head.ref !== branchName(this.c, 'head') || pr.base.ref !== branchName(this.c, 'base')) throw new Error('Refusing cleanup of changed, merged, or unowned PR.')
      }
      for (const b of Object.values(m.branches)) {
        const ref = await optional(() => this.api.gh(`/git/ref/heads/${b.name}`))
        if (ref && ref.object.sha !== b.sha) throw new Error('Refusing cleanup: demo branch has new commits.')
      }
      if (m.pr) await this.api.gh(`/pulls/${m.pr.number}`, 'PATCH', { state: 'closed' })
      for (const key of ['head', 'base']) {
        const b = m.branches[key]
        if (b) {
          const ref = await optional(() => this.api.gh(`/git/ref/heads/${b.name}`))
          if (ref && ref.object.sha !== b.sha) throw new Error('Branch changed during cleanup; refusing deletion.')
          if (ref) await this.api.gh(`/git/refs/heads/${b.name}`, 'DELETE')
        }
      }
    }
    if (only !== 'github' && m.messages.proposal) {
      // Delete only recorded bot messages. Never remove real teammates' replies.
      let thread: any[]
      try { thread = await this.api.thread(m.messages.proposal.ts) }
      catch (e) {
        if (e instanceof ApiError && e.code === 'thread_not_found' && Object.keys(m.messages).length === 1) thread = []
        else throw e
      }
      for (const entry of Object.values(m.messages)) {
        const found = thread.find((x) => x.ts === entry.ts)
        if (found && (slackText(found.text) !== slackText(entry.text) || found.bot_id !== m.botId || !found.text.includes(marker(this.c)))) throw new Error('Refusing cleanup of edited or unowned Slack message.')
      }
      const owned = new Set(Object.values(m.messages).map((x) => x.ts))
      const realReplies = thread.some((x) => !owned.has(x.ts))
      for (const [key, entry] of Object.entries(m.messages).reverse()) {
        if (key === 'proposal' && realReplies) continue // Preserve the parent of real replies.

        if (thread.some((x) => x.ts === entry.ts)) await this.api.slack('chat.delete', { channel: this.c.channel, ts: entry.ts }, true)
        delete m.messages[key]; await this.checkpoint(m)
      }
    }
    m.cleaned = true
    await this.checkpoint(m)
  }
}
