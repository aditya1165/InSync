import type { DemoConfig } from './config.ts'
export class ApiError extends Error {
  service: string; status: number; code: string
  constructor(service: string, status: number, code = '') {
    super(`${service} request failed (${status}${code ? `, ${code}` : ''}). Check credentials, permissions, and demo scope.`)
    this.service = service; this.status = status; this.code = code
  }
}
// Never include response bodies, headers, tokens, or request URLs in error logs.
export class DemoApi {
  config: DemoConfig; private fetcher: typeof fetch; private sleep: (ms: number) => Promise<void>
  constructor(config: DemoConfig, fetcher: typeof fetch = fetch,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))) {
    this.config = config; this.fetcher = fetcher; this.sleep = sleep
  }
  async request<T>(service: 'GitHub' | 'Slack', path: string, method = 'GET', body?: unknown): Promise<T> {
    const github = service === 'GitHub'
    const url = github ? `https://api.github.com/repos/${this.config.repository}${path}` : `https://slack.com/api/${path}`
    const headers: Record<string, string> = github ? { Authorization: `Bearer ${this.config.githubToken}`, Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${this.config.slackToken}`, 'Content-Type': 'application/json; charset=utf-8' }
    // Only retry reads and explicit rate-limit rejections. A write timeout is ambiguous;
    // stop and reconcile against the journal before attempting another write.
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response
      try {
        response = await this.fetcher(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) })
      } catch { throw new Error(`${service} network failure; a write may have succeeded. Rerun to reconcile, never blindly retry.`) }
      const limited = response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
      if ((limited || (method === 'GET' && response.status >= 500)) && attempt < 3) {
        const delay = Math.max(Number(response.headers.get('retry-after') || 0) * 1000,
          limited && response.headers.get('x-ratelimit-reset') ? Number(response.headers.get('x-ratelimit-reset')) * 1000 - Date.now() : 0,
          1000 * 2 ** attempt)
        if (delay > 30000) throw new ApiError(service, response.status, 'rate_limited; retry later')
        await this.sleep(delay); continue
      }
      if (!response.ok) throw new ApiError(service, response.status)
      if (response.status === 204) return undefined as T
      let data: any
      try { data = await response.json() } catch { throw new ApiError(service, response.status, 'invalid_json') }
      if (!github && !data.ok) throw new ApiError(service, 200, /^[a-z_]+$/.test(data.error || '') ? data.error : 'api_error')
      return data as T
    }
    throw new ApiError(service, 429)
  }
  gh<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> { return this.request<T>('GitHub', path, method, body) }
  slack<T = any>(method: string, params: Record<string, unknown> = {}, write = false): Promise<T> {
    if (write) return this.request<T>('Slack', method, 'POST', params)
    return this.request<T>('Slack', `${method}?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}`)
  }
  async thread(ts: string) {
    const messages: any[] = []; let cursor = ''
    do {
      const data = await this.slack('conversations.replies', { channel: this.config.channel, ts, limit: 100, ...(cursor ? { cursor } : {}) })
      if (!Array.isArray(data.messages)) throw new Error('Slack returned incomplete message evidence.')
      messages.push(...data.messages); cursor = data.response_metadata?.next_cursor || ''
      if (data.has_more && !cursor) throw new Error('Slack pagination was incomplete; refusing unsafe recovery.')
      if (messages.length > 500) throw new Error('Demo thread exceeds safe read limit.')
    } while (cursor)
    return messages
  }
  async history() {
    const messages: any[] = []; let cursor = ''
    do {
      const data = await this.slack('conversations.history', { channel: this.config.channel, limit: 100, ...(cursor ? { cursor } : {}) })
      if (!Array.isArray(data.messages)) throw new Error('Slack returned incomplete message evidence.')
      messages.push(...data.messages); cursor = data.response_metadata?.next_cursor || ''
      if (data.has_more && !cursor) throw new Error('Slack pagination was incomplete; refusing unsafe recovery.')
      if (messages.length > 1000) throw new Error('Demo channel exceeds safe recovery scan limit; use a dedicated channel.')
    } while (cursor)
    return messages
  }
  async validate() {
    const repo = await this.gh('')
    if (repo.full_name.toLowerCase() !== this.config.repository.toLowerCase() || !repo.permissions?.push) throw new Error('GitHub target does not grant push access.')
    // Repository push rights describe the account, not the PAT's scoped access.
    // Read a Git ref too so missing Contents permission is caught before posting.
    try { await this.gh(`/git/ref/heads/${repo.default_branch}`) }
    catch (e) {
      if (e instanceof ApiError && e.status === 403) throw new Error('GitHub token cannot read repository contents. Grant Contents: read/write and Pull requests: read/write for the demo repository.')
      if (e instanceof ApiError && e.status === 409) throw new Error('GitHub demo repository is empty. Add a README and commit it to the default branch before seeding.')
      if (e instanceof ApiError && e.status === 404) throw new Error('GitHub default branch is unavailable. Initialize the demo repository with a README and grant the token Contents: read/write access.')
      throw e
    }
    const auth = await this.slack('auth.test')
    if (!auth.bot_id) throw new Error('SLACK_BOT_TOKEN must identify a bot; character messages are staged.')
    const { channel } = await this.slack('conversations.info', { channel: this.config.channel })
    if (channel.id !== this.config.channel || !channel.is_member || channel.is_archived) throw new Error('Bot must belong to the configured, active demo channel.')
    return { repo, auth, channel }
  }
  /** Check read access only; classroom replay requires no write permission. */
  async validateReads(teamId?: string) {
    const [repo, auth, info] = await Promise.all([this.gh(''), this.slack('auth.test'), this.slack('conversations.info', { channel: this.config.channel })])
    if (repo.full_name?.toLowerCase() !== this.config.repository.toLowerCase()) throw new Error('GitHub read target mismatch.')
    if (!auth.bot_id || !auth.team_id || (teamId && auth.team_id !== teamId)) throw new Error('Slack reader belongs to another workspace.')
    if (info.channel?.id !== this.config.channel || !info.channel.is_member || info.channel.is_archived) throw new Error('Slack reader needs membership in the active approved channel.')
  }
}
