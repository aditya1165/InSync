import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGitHubProvider } from './github.ts'

const window = { start: new Date('2026-11-05T00:00:00Z'), end: new Date('2026-11-06T00:00:00Z') }

function githubFetcher(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input))
  const base = 'https://api.github.com/repos/acme/demo'
  const items: Record<string, unknown[]> = {
    [`${base}/issues`]: [
      { id: 1, number: 1, title: 'Issue', body: 'Details', state: 'open', updated_at: '2026-11-05T13:00:00Z', html_url: 'https://github.com/acme/demo/issues/1', user: { login: 'alice' } },
      { id: 2, number: 2, title: 'PR from issues', body: '', state: 'open', updated_at: '2026-11-05T14:00:00Z', html_url: 'https://github.com/acme/demo/pull/2', pull_request: {} },
    ],
    [`${base}/pulls`]: [{ id: 2, number: 2, title: 'PR', body: 'Changes', state: 'open', updated_at: '2026-11-05T14:00:00Z', html_url: 'https://github.com/acme/demo/pull/2', user: { login: 'bob' } }],
    [`${base}/commits`]: [{ sha: 'abc', html_url: 'https://github.com/acme/demo/commit/abc', commit: { message: 'Fix bug', author: { name: 'Cara', date: '2026-11-05T15:00:00Z' } } }],
    [`${base}/issues/comments`]: [{ id: 3, body: 'Question', created_at: '2026-11-05T16:00:00Z', html_url: 'https://github.com/acme/demo/issues/1#issuecomment-3', issue_url: `${base}/issues/1` }],
    [`${base}/pulls/comments`]: [{ id: 4, body: 'Please change', created_at: '2026-11-05T17:00:00Z', html_url: 'https://github.com/acme/demo/pull/2#discussion_r4', pull_request_url: `${base}/pulls/2`, path: 'src/a.ts' }],
  }
  return Promise.resolve(new Response(JSON.stringify(items[url.origin + url.pathname] || []), { status: 200 }))
}

test('GitHub provider normalizes issue, PR, commit, and both comment types without duplicate PRs', async () => {
  const provider = createGitHubProvider({ repository: 'acme/demo', token: null, apiVersion: '2022-11-28' }, githubFetcher as typeof fetch)
  const activities = await provider.list(window)
  assert.deepEqual(new Set(activities.map((a) => a.kind)), new Set(['github_issue', 'github_pull_request', 'github_commit', 'github_issue_comment', 'github_review_comment']))
  assert.equal(activities.length, 5)
  assert.ok(activities.every((a) => a.sourceUrl?.startsWith('https://github.com/acme/demo/')))
})
