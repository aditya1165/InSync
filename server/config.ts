export interface SlackChannel {
  id: string
  name: string
}

export interface ServerConfig {
  host: string
  port: number
  github: {
    repository: string | null
    token: string | null
    apiVersion: string
  }
  slack: {
    token: string | null
    channels: SlackChannel[]
  }
}

export function parseSlackChannels(value: string | undefined): SlackChannel[] {
  if (!value?.trim()) return []

  return value.split(',').map((entry) => {
    const [id, ...nameParts] = entry.trim().split(':')
    if (!id || !/^[A-Z0-9]+$/.test(id)) {
      throw new Error('SLACK_CHANNELS must contain channel IDs, optionally followed by :name.')
    }
    return { id, name: nameParts.join(':').trim() || id }
  })
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const repository = env.GITHUB_REPOSITORY?.trim() || (env.GITHUB_OWNER && env.GITHUB_REPO ? `${env.GITHUB_OWNER}/${env.GITHUB_REPO}` : null)
  if (repository && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY must be in owner/repo format.')
  }

  const port = Number(env.PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.')
  }

  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port,
    github: {
      repository,
      token: env.GITHUB_TOKEN?.trim() || null,
      apiVersion: env.GITHUB_API_VERSION?.trim() || '2022-11-28',
    },
    slack: {
      token: env.SLACK_BOT_TOKEN?.trim() || null,
      channels: parseSlackChannels(env.SLACK_CHANNELS || (env.SLACK_CHANNEL_ID ? `${env.SLACK_CHANNEL_ID}:demo-pagination` : '')),
    },
  }
}
