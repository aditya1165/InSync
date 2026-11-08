# Real GitHub + Slack pagination demo

## Current implementation and boundaries

This extends the existing React/TypeScript/Vite + Fastify application. The default **Pagination demo** sidebar view contains **Back on Track · Leo’s ProductList** (`src/PaginationDemo.tsx`). Upstream **My work**, **Team activity**, and Light/Dark themes remain available. Its **Catch me up** button calls `GET /api/real-demo/catch-up?mode=live&start=...&end=...`. **Why did this change?** opens the retrieved Slack discussion, DEC-14, PR, code evidence and human link controls.

Live mode reads remote records on every catch-up; it never quietly substitutes fixtures. The explicit **Scripted pagination sample (offline)** choice supports both interactions without credentials. The **Team activity** view retains the upstream time-range browser and uses pagination samples. Its general live activity endpoint still requires authenticated ticket-board/source grants. The **My work** view retains Supabase tasks and the separate upstream sample walkthrough. The old ProfileSettings endpoints/components remain as legacy compatibility code and regression coverage; the primary demo does not call them.

The new analysis is labeled **evidence_rules**, not live AI. It inspects the real PR patch, base/head backend contents and ProductList consumer; no model key is needed. It requires a removed `totalPages` response field, added `nextCursor`, and `response.totalPages` consumer before reporting the potential mismatch. Missing/incomplete evidence produces uncertainty. These are scoped source-pattern rules, not a general AST analyzer or automatic dependency discovery system.

The PR stays open. Its existence does not mean the API is deployed. DEC-14 is a staged logical decision ID, not a Slack-assigned ID. Slack message timestamps and the GitHub PR number/IDs are platform-assigned. Tuesday, Thursday and Monday are explicitly simulated story labels. No historical platform dates or unread counts are fabricated.

## Local setup

Use Node 24 (the test command uses native TypeScript stripping) and npm:

```bash
npm ci
cp -n .env.example .env
npm test
npm run build
npm run dev
```

Open http://localhost:5173. Fastify listens at 127.0.0.1:3001. The Vite proxy expects port 3001. The pagination workflow does not require Supabase or OpenAI. Its live evidence route is enabled only outside production with API HOST=127.0.0.1; it does not bypass production source-access requirements. Do not run the nonexistent historical `seed:sameer` command from older notes.

Edit `.env` locally. Do not paste tokens into chat, commit them, or add a `VITE_` prefix. Example values below are placeholders:

```dotenv
GITHUB_TOKEN=
GITHUB_OWNER=YOUR_ACCOUNT
GITHUB_REPO=YOUR_ISOLATED_DEMO_REPO
GITHUB_DEMO_ALLOWLIST=YOUR_ACCOUNT/YOUR_ISOLATED_DEMO_REPO
SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=C0123456789
SLACK_DEMO_ALLOWLIST=C0123456789
DEMO_RUN_ID=pagination-v1
```

Use an existing, initialized demo repository that you own or have permission to modify, with at least one commit and a default branch. Create the repository and Slack channel yourself; the simulator does not create or choose them. **Do not target the InSync application repository.** If `GITHUB_REPOSITORY` is also set, it must equal `GITHUB_OWNER/GITHUB_REPO`. The legacy `SLACK_CHANNELS` setting is only for the optional broad activity browser; leave it blank to use `SLACK_CHANNEL_ID`.

Use a dedicated Slack app in a test workspace and invite it only to the approved demo channel. The local allowlists constrain the simulator's requests; Slack scopes themselves are not single-channel permission grants. Slack app membership should be restricted too.

## Permissions and validation

Use a fine-grained GitHub PAT limited to this one repository: **Contents: read/write**, **Pull requests: read/write**, and the automatically included metadata access. No administration, repository deletion, workflow modification or merge permission is needed. The optional legacy activity browser also fetches issues and may need **Issues: read**. GitHub documents [commit permissions](https://docs.github.com/en/rest/git/commits), [reference creation/deletion](https://docs.github.com/en/rest/git/refs) and [pull requests](https://docs.github.com/en/rest/pulls/pulls).

Slack bot scopes for a public demo channel: `chat:write`, `channels:read`, `channels:history`. For a private channel, use the corresponding `groups:read` and `groups:history`. Reinstall the app after adding scopes and invite the bot to the channel. No `chat:write.customize`, `chat:write.public`, user impersonation, or channel-management scopes are used. All character messages come from the same identifiable bot and explicitly say **staged demo**, with fictional character names in their text. See [posting messages](https://docs.slack.dev/reference/methods/chat.postMessage/), [reading threads](https://docs.slack.dev/reference/methods/conversations.replies/) and [deleting bot messages](https://docs.slack.dev/reference/methods/chat.delete/).

```bash
npm run demo:validate
```

This makes read-only API calls to check GitHub repository identity/account push access, default-branch Contents read access, and Slack bot identity/channel membership. It does not guarantee every write scope or branch policy will allow the later seed; actual failures stop the run and retain its journal. Permission failures include a sanitized service/status/error code, never response bodies or tokens.

## Preview and explicit apply

Dry-run is the default and makes **no network requests or remote changes**. It works without tokens after target and allowlist fields are configured:

```bash
npm run demo:seed
# equivalent:
npm run demo:seed -- --dry-run
```

Review the printed repository, channel, branches, files, messages, PR title and `confirmation` string. Only after explicit approval of that target and command, substitute the exact printed confirmation string:

```bash
npm run demo:seed -- --apply --confirm 'YOUR_ACCOUNT/YOUR_ISOLATED_DEMO_REPO:C0123456789:pagination-v1'
```

The seed performs these steps, checkpointing each one:

1. Validate both allowlists and remote identities.
2. Post one Slack parent and three replies: Maya's proposal, Sam's +1, Maya's DEC-14 confirmation, and a release/migration caveat. All are visibly staged. Timestamps are assigned by Slack.
3. Create baseline branch `insync-demo/pagination-v1-base` from the repository's default head. Add only the small `insync-pagination-demo/` example: offset API, ProductList consumer and executable contract test.
4. Create head branch `insync-demo/pagination-v1-head` with the cursor API, removing `totalPages` while leaving ProductList unchanged.
5. Open **Replace offset pagination with cursor-based pagination** against the dedicated baseline branch. Record GitHub's actual number, URL, ID and created timestamp. Its description links the actual Slack proposal and confirmation.
6. Post one thread reply with the actual PR URL, DEC-14 and the migration warning. Total: five bot messages, not hundreds.
7. Re-fetch the PR, refs, thread and permalinks to verify remote provenance.

Git trees, commits and branch references are published through GitHub's Git Database API, rather than shelling out to `git push`. These are genuine Git objects visible in ordinary clones. The repository's default branch is never updated. The simulator has no automatic merge path.

## Manifest, recovery and verification

The seed creates `.demo/pagination-v1.json` (gitignored, mode 0600) and an exclusive local lock. The manifest includes run/target identities, branch commit SHAs/URLs/platform commit dates, the assigned PR identity, Slack channel/thread/message timestamps and permalinks, DEC-14 → PR → ProductList relationship, and verification time. It includes staged message text for ownership checks, never tokens or fetched private code. Keep it private and retain it for recovery and cleanup. A custom `DEMO_MANIFEST_PATH` must remain inside `.demo/`.

```bash
npm run demo:verify
```

Verification re-fetches actual GitHub and Slack resources, checks PR/repository/branch ownership, recorded message text/bot identity (allowing Slack's automatic URL/entity formatting), and permalink message identities. Slack may add thread-context query parameters after replies; raw returned links are preserved in the manifest while stable message paths are used in cross-references. A missing or edited source fails verification; no result is claimed as verified. The application performs equivalent readback before analyzing live evidence.

Rerun the same approved apply command with the same run ID and journal to resume a partial run. It reuses existing recorded branches, messages and the PR. Write timeouts are ambiguous, so the client stops rather than blindly retrying. Recovery searches exact bot/run/step markers or the dedicated head/base PR pair. Unexpected collisions, edits or extra commits stop the process. Reads and explicit rate-limit rejections have bounded retries; long waits stop with a retry-later error. Never change targets under an existing journal. For a new presentation, reuse the existing run and adjust the absence dates; a rerun does not fabricate fresh events.

If a process is killed, its `.demo/<run>.lock` may remain. Confirm no seed/cleanup process is running before removing only that lock. Do not delete the journal. Run from the same checkout with the original manifest; concurrent runs across different machines are unsupported.

## Reproduce the backend/frontend incompatibility

The seeded backend implements `GET /products` as a small executable function. ProductList is a minimal frontend consumer/view model that derives page buttons from `response.totalPages`; it intentionally remains incompatible on the PR head. No production deployment is needed.

Clone the demo repository into a temporary directory using your existing Git credential setup (never put tokens in the URL):

```bash
demo_checkout="$(mktemp -d)"
git clone https://github.com/YOUR_ACCOUNT/YOUR_ISOLATED_DEMO_REPO.git "$demo_checkout"
git -C "$demo_checkout" switch --detach origin/insync-demo/pagination-v1-base
(cd "$demo_checkout" && node --test insync-pagination-demo/contract.test.mjs)
# Expected: pass

git -C "$demo_checkout" switch --detach origin/insync-demo/pagination-v1-head
(cd "$demo_checkout" && node --test insync-pagination-demo/contract.test.mjs)
# Expected: fail with "ProductList requires totalPages"
```

The automated local tests run this same contrast in a temporary directory without touching the app checkout or contacting GitHub.

## Application and human review

Restart `npm run dev` after configuration changes. In **Back on Track · Leo’s ProductList**, select **Real API records**, use an absence interval covering the real PR creation or latest update, and click **Catch me up**. The current PR code/status is displayed; this does not reconstruct historical snapshots of all events. Older Slack messages remain available as explanatory context.

Inspect before/after backend contents, ProductList and the actual patch. Each has an inspectable ID, immutable Git SHA/path link, or platform permalink. **Why did this change?** shows the ordered Slack proposal/agreement/confirmation, source decision state (`proposed`, `confirmed`, `superseded`, `unverified`) and an independent inferred-link state. Even an exact PR URL reference remains **Possible match — not verified** until the user reviews it.

Use **Confirm link**, **Not Relevant / Reject**, **Remind Later**, **Undo / Reopen**, or choose an inspectable replacement Slack source and **Use selected source**. Review belongs to the currently loaded result; it is intentionally session-local and resets on a new catch-up. It does not edit GitHub, Slack, project tasks or the source decision status. Remind Later marks a deferral; it does not schedule a notification. No new database migration is required.

An API failure is visible. Explicitly select **Scripted pagination sample (offline)** to demonstrate the same story without remote claims. Sample IDs start with `sample:` and have no fabricated remote links.

## Selective cleanup

Preview first. No remote objects are deleted by these commands:

```bash
npm run demo:cleanup
npm run demo:cleanup -- --only slack
npm run demo:cleanup -- --only github
```

After reviewing and approving, run the exact target confirmation:

```bash
npm run demo:cleanup -- --apply --only all --confirm 'YOUR_ACCOUNT/YOUR_ISOLATED_DEMO_REPO:C0123456789:pagination-v1'
```

Cleanup closes the recorded unmerged PR, deletes only its two unchanged dedicated branch refs, and deletes only recorded, unedited messages belonging to the same bot/run. It refuses changed branch SHAs, merged/retargeted PRs and edited messages. It never deletes a repository/channel, unrelated branches/messages, real teammates' replies, or the default branch. If real replies exist, their staged parent is preserved too and remains recorded. GitHub retains the closed PR and Git objects according to platform behavior; cleanup is not a history purge. A failed cleanup can be rerun with its journal. A cleaned run cannot be seeded again; choose a new run ID.

## 60–90-second walkthrough

- **0–15 seconds:** Explain: Leo owns ProductList and returns after a week. State that content and weekdays are staged, while displayed GitHub/Slack records and timestamps are real. Select a window containing the real seed time and click **Catch me up**.
- **15–35 seconds:** Show the actual PR number/open status, removed `totalPages`, added `nextCursor`, and ProductList's read of `response.totalPages`. Explain the failing contract and recommended migration/checks.
- **35–60 seconds:** Click **Why did this change?** Open the actual Slack proposal, Sam's +1, Maya's DEC-14 confirmation, and the PR URL reply. Show source decision status separately from **Possible match — not verified**.
- **60–80 seconds:** Reject the link, reopen it, select a corrected source, then confirm after inspecting evidence. Point out that no code or remote decision was modified. Show the offline sample option if a network failure occurs.

## Validation status

`server/real-demo.test.ts` covers mocked HTTP GitHub/Slack calls, idempotency, ambiguous post/ref/PR failures, provenance, removal/consumer detection, absence windows, incomplete evidence, decision states, correction/rejection, rate limits, cleanup ownership, CLI dry-run/confirmation guards, and executable baseline/head contract tests. Existing app/provider/database tests remain included by `npm test`.

On 2026-11-08, the user approved the configured demo target and apply command. The real seed and remote verification completed: two dedicated branches/commits, one open PR, and five staged Slack messages. The live catch-up route was checked through both Fastify injection and the running Vite-to-Fastify proxy: ProductList impact was breaking, source DEC-14 was confirmed, and the relationship remained possible/unverified. A read-only instrumented seed rerun attempted zero remote writes and confirmed one matching PR and five staged messages. The contract test fetched from each real commit passed on the baseline and failed as expected on the PR head; the default branch matched the baseline parent. Actual IDs/URLs/timestamps are in the ignored manifest. All 41 automated tests and the production build passed. Chrome loaded the app, but computer-use screen capture failed during button interaction, so full manual browser review remains pending. InSync changes remain local; no push to the application repository was performed.

After integrating upstream commit `99ad059`, all 47 tests and the build passed. The sidebar now preserves My work, Team activity, and Light/Dark themes alongside the default Pagination demo. Live pagination readback remains verified; general activity/task authentication checks remain enforced. The pagination route itself is unavailable in production or with a public API bind.

## Human discussion collection

The separate **Human Slack discussions (live events)** option discovers human threads through Slack Events API / Socket Mode. See [SLACK_EVENTS_DEMO.md](SLACK_EVENTS_DEMO.md) for the additional xapp token, event subscriptions and copyable human simulation. The existing seeded bot mode remains unchanged. Human event metadata is in memory only; full thread text is fetched on Catch me up, and arbitrary GitHub PR discovery remains outside this slice.
