import { filterActivities, type Activity, type ActivityProvider } from '../../src/lib/catchup.ts'
import type { TimeWindow } from '../../src/lib/time.ts'

interface GitHubConfig {
  repository: string
  token: string | null
  apiVersion: string
}

interface GitHubUser { login?: string }
interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: string
  updated_at: string
  html_url: string
  user?: GitHubUser | null
  pull_request?: unknown
}
interface GitHubPullRequest extends GitHubIssue {
  draft?: boolean
  merged_at?: string | null
}
interface GitHubCommit {
  sha: string
  html_url: string
  author?: GitHubUser | null
  commit: {
    message: string
    author?: { name?: string; date?: string } | null
    committer?: { date?: string } | null
  }
}
interface GitHubComment {
  id: number
  body: string
  created_at: string
  updated_at?: string
  html_url: string
  user?: GitHubUser | null
  path?: string
  issue_url?: string
  pull_request_url?: string
}

function firstLine(value: string, fallback: string): string {
  return value.split('\n')[0]?.trim() || fallback
}

function actor(user?: GitHubUser | null): string {
  return user?.login || 'Unknown GitHub user'
}

function issueNumberFromUrl(url?: string): string {
  return url?.split('/').at(-1) || '?'
}

export function createGitHubProvider(config: GitHubConfig, fetcher: typeof fetch = fetch): ActivityProvider {
  const repositoryPath = config.repository.split('/').map(encodeURIComponent).join('/')
  const base = `https://api.github.com/repos/${repositoryPath}`

  async function paged<T>(
    path: string,
    params: Record<string, string>,
    stopWhen?: (items: T[]) => boolean,
  ): Promise<T[]> {
    const all: T[] = []
    for (let page = 1; page <= 50; page += 1) {
      const url = new URL(`${base}${path}`)
      Object.entries({ ...params, per_page: '100', page: String(page) }).forEach(([key, value]) => {
        url.searchParams.set(key, value)
      })
      const response = await fetcher(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'InSync-catch-up',
          'X-GitHub-Api-Version': config.apiVersion,
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        throw new Error(`GitHub ${path} request failed (HTTP ${response.status}).`)
      }
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error(`GitHub ${path} returned an invalid list.`)
      const items = data as T[]
      all.push(...items)
      if (stopWhen?.(items) || !/rel="next"/.test(response.headers.get('link') || '')) return all
    }
    throw new Error(`GitHub ${path} has too many pages for one catch-up; narrow the range.`)
  }

  return {
    async list(window: TimeWindow): Promise<Activity[]> {
      const since = new Date(window.start.getTime() - 1000).toISOString()
      const until = window.end.toISOString()
      const [issues, pullRequests, commits, issueComments, reviewComments] = await Promise.all([
        paged<GitHubIssue>('/issues', { state: 'all', since }),
        paged<GitHubPullRequest>(
          '/pulls',
          { state: 'all', sort: 'updated', direction: 'desc' },
          (items) => items.some((item) => Date.parse(item.updated_at) < window.start.getTime()),
        ),
        paged<GitHubCommit>('/commits', { since, until }),
        paged<GitHubComment>('/issues/comments', { since }),
        paged<GitHubComment>('/pulls/comments', { since }),
      ])

      const activities: Activity[] = [
        ...issues.filter((issue) => !issue.pull_request).map((issue) => ({
          id: `github:issue:${issue.id}`,
          source: 'github' as const,
          kind: 'github_issue' as const,
          occurredAt: issue.updated_at,
          actor: actor(issue.user),
          title: `Issue #${issue.number} · ${issue.title}`,
          body: `${issue.state === 'closed' ? 'Closed' : 'Open'} issue. ${issue.body || 'No description provided.'}`,
          location: `${config.repository} / issues`,
          sourceUrl: issue.html_url,
        })),
        ...pullRequests.map((pull) => {
          const state = pull.merged_at ? 'Merged' : pull.draft ? 'Draft' : pull.state === 'closed' ? 'Closed' : 'Open'
          return {
            id: `github:pull:${pull.id}`,
            source: 'github' as const,
            kind: 'github_pull_request' as const,
            occurredAt: pull.updated_at,
            actor: actor(pull.user),
            title: `PR #${pull.number} · ${pull.title}`,
            body: `${state} pull request. ${pull.body || 'No description provided.'}`,
            location: `${config.repository} / pull requests`,
            sourceUrl: pull.html_url,
          }
        }),
        ...commits.map((commit) => ({
          id: `github:commit:${commit.sha}`,
          source: 'github' as const,
          kind: 'github_commit' as const,
          occurredAt: commit.commit.committer?.date || commit.commit.author?.date || '',
          actor: commit.author?.login || commit.commit.author?.name || 'Unknown GitHub user',
          title: `Commit · ${firstLine(commit.commit.message, commit.sha.slice(0, 7))}`,
          body: commit.commit.message,
          location: `${config.repository} / commits`,
          sourceUrl: commit.html_url,
        })),
        ...issueComments.map((comment) => ({
          id: `github:issue-comment:${comment.id}`,
          source: 'github' as const,
          kind: 'github_issue_comment' as const,
          occurredAt: comment.updated_at || comment.created_at,
          actor: actor(comment.user),
          title: `Comment on issue or PR #${issueNumberFromUrl(comment.issue_url)}`,
          body: comment.body,
          location: `${config.repository} / comments`,
          sourceUrl: comment.html_url,
        })),
        ...reviewComments.map((comment) => ({
          id: `github:review-comment:${comment.id}`,
          source: 'github' as const,
          kind: 'github_review_comment' as const,
          occurredAt: comment.updated_at || comment.created_at,
          actor: actor(comment.user),
          title: `Review comment on PR #${issueNumberFromUrl(comment.pull_request_url)}`,
          body: comment.path ? `${comment.path}: ${comment.body}` : comment.body,
          location: `${config.repository} / pull request review`,
          sourceUrl: comment.html_url,
        })),
      ]

      return filterActivities(activities, window)
    },
  }
}
