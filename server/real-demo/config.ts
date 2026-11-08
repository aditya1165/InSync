export interface DemoConfig {
  repository: string; owner: string; repo: string; githubToken: string; slackToken: string
  channel: string; runId: string; manifestPath: string
}
export function demoConfig(env: NodeJS.ProcessEnv = process.env): DemoConfig {
  const repository = env.GITHUB_OWNER && env.GITHUB_REPO
    ? `${env.GITHUB_OWNER}/${env.GITHUB_REPO}` : env.GITHUB_REPOSITORY || ''
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Configure GITHUB_OWNER and GITHUB_REPO (or GITHUB_REPOSITORY).')
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== repository) throw new Error('GitHub target settings disagree.')
  const channel = env.SLACK_CHANNEL_ID || ''
  if (!/^[CG][A-Z0-9]+$/.test(channel)) throw new Error('Configure SLACK_CHANNEL_ID for one dedicated demo channel.')
  const allowed = (v?: string) => (v || '').split(',').map((s) => s.trim())
  if (!allowed(env.GITHUB_DEMO_ALLOWLIST).includes(repository) || !allowed(env.SLACK_DEMO_ALLOWLIST).includes(channel)) {
    throw new Error('Target must appear in GITHUB_DEMO_ALLOWLIST and SLACK_DEMO_ALLOWLIST.')
  }
  const runId = env.DEMO_RUN_ID || 'pagination-v1'
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(runId)) throw new Error('DEMO_RUN_ID must be a short lowercase slug.')
  const [owner, repo] = repository.split('/')
  return { repository, owner: owner!, repo: repo!, channel, runId,
    githubToken: env.GITHUB_TOKEN || '', slackToken: env.SLACK_BOT_TOKEN || '',
    manifestPath: env.DEMO_MANIFEST_PATH || `.demo/${runId}.json` }
}
export function requireCredentials(config: DemoConfig) {
  if (!config.githubToken || !config.slackToken) throw new Error('Set GITHUB_TOKEN and SLACK_BOT_TOKEN locally; do not paste secrets into chat.')
}
export const confirmation = (c: DemoConfig) => `${c.repository}:${c.channel}:${c.runId}`
