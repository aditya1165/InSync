# Human Slack discussions through the Events API

This adds real-time **metadata discovery** of human-written Slack threads to the existing pagination demo. Slack sends events over an authenticated outbound Socket Mode connection. No public webhook URL, tunnel or signing secret is needed for this transport. The backend does not post replies or create discussions in this mode.

Full message text is fetched fresh from Slack when you click **Catch me up**. The thread list refreshes every five seconds; analysis remains user-initiated. The seeded bot demo and offline sample remain available as separate data-source options.

## 1. Configure the same Slack app

Use the same Slack app that issued the existing `SLACK_BOT_TOKEN` (`xoxb-...`). In [your Slack app dashboard](https://api.slack.com/apps):

1. Open the app, select **Socket Mode**, and enable it.
2. Under **Basic Information → App-Level Tokens**, choose **Generate Token and Scopes**. Name it `insync-local-events`, add only **`connections:write`**, and generate the token.
3. Save the resulting **`xapp-...` App-Level Token** directly in your local `.env`. It is different from the bot token. Do not paste it into chat or add a `VITE_` prefix.
4. Open **Event Subscriptions**, enable events, and under **Subscribe to bot events** add **`message.channels`** for the public demo channel. If you deliberately use a private channel, subscribe to **`message.groups`** instead.
5. Save changes. If Slack asks you to reinstall the app, do so. Public-channel bot scopes are `channels:read` and `channels:history`; private-channel equivalents are `groups:read` and `groups:history`. Existing `chat:write` is for the separate approved seed, not for this read-only listener.
6. Make sure the bot is a member of the intended channel and that `SLACK_CHANNEL_ID` and `SLACK_DEMO_ALLOWLIST` name that channel. The receiver filters every event to that channel and the bot's authenticated workspace.

With Socket Mode enabled, you do not need to enter a public HTTP Request URL. Use only one event receiver for this Slack app during the demo; multiple Socket Mode processes can split event delivery between them.

Official references: [Socket Mode setup](https://docs.slack.dev/tools/node-slack-sdk/socket-mode/), [app-level connection scope](https://docs.slack.dev/reference/scopes/connections.write/), [message subscriptions](https://docs.slack.dev/reference/events/message/).

## 2. Save local settings and start

Add or update the existing fields in `.env`:

```dotenv
SLACK_EVENTS_ENABLED=true
SLACK_APP_TOKEN=xapp-YOUR-LOCAL-SECRET
# Keep the existing xoxb token, channel ID and allowlist values.
```

Then start or restart the existing application:

```bash
npm install
npm run dev
```

The new dependency is Slack's official `@slack/socket-mode` client. The usual frontend and Fastify ports remain 5173 and 3001. Changing `.env` requires a server restart.

Open http://localhost:5173. In **Pagination demo → Data source**, choose **Human Slack discussions (live events)**. Wait for **Slack listener: connected** before posting the simulation. An alternative metadata-only check is:

```bash
curl http://127.0.0.1:3001/api/slack-events/status
```

Expected fields include `state: "connected"`, the approved `channelId`, and an initially empty `threads` array. This endpoint never returns tokens or message bodies. `disabled` means the opt-in is off; `not_configured` means an app-level token is missing; `error` means configuration or connection failed. A connected socket does not prove message subscriptions are correct: the human-post test below verifies delivery too.

The existing GitHub demo manifest is still required to supply the actual pagination PR, commit SHAs and ProductList evidence. This feature discovers new human Slack discussions; it does not discover arbitrary GitHub projects or PRs.

## 3. Simulate a real human discussion

Use the approved Slack channel (currently `#all-acme` in the configured test workspace). Post as yourself. For a group demo, teammates can post from their own accounts. For a one-person simulation, keep the `[Human demo]` label; do not pretend to be another real user. The application shows actual Slack user IDs.

Create a **new channel message after the listener is connected**. Do not reply to the old bot-created thread for the primary demonstration.

**Parent message — proposal:**

```text
[Human demo] I propose cursor-based pagination for GET /products because offset pagination is too slow for large lists. Replace totalPages with nextCursor. Leo's ProductList still uses totalPages. Let's discuss DEC-15.
```

Use **Reply in thread** for every following message, rather than posting separate top-level messages.

**First reply — agreement:**

```text
[Human demo] +1 to cursor-based pagination. ProductList will need migration.
```

At this point you can run Catch me up: the source decision should be **proposed**, not confirmed. Agreement alone is insufficient.

**Second reply — explicit decision and implementing PR:**

```text
[Human demo] Decision DEC-15 confirmed: replace offset pagination with cursor-based pagination for GET /products; remove totalPages and return nextCursor. Implementation: https://github.com/KarthikeyanK1206/insync-pagination-demo/pull/1
```

That URL is the existing approved demo PR. If using another approved simulator run, replace it with the actual PR URL from its manifest. DEC-15 is a human-authored logical ID; Slack still assigns its own actual message/thread IDs and timestamps.

The current deterministic analyzer deliberately expects an explicit confirmation in the form `Decision DEC-N confirmed:` and the exact contract field names. It recognizes the proposal → agreement → confirmation sequence. It is not a general natural-language decision detector, and no OpenAI key is required. Questions, missing confirmation, negated removal, or missing evidence remain proposed/unverified. An exact PR URL supports the relationship but never replaces human review.

## 4. Inspect both workflows

1. Return to **Human Slack discussions** in InSync. The new thread should appear within roughly one five-second UI refresh after the event arrives.
2. Choose that collected thread. Set **Absent since** before the real post times. **Through current time** is checked by default, so newly posted replies are included even if the page was opened earlier. Uncheck it only when choosing a fixed historical end time.
3. Click **Catch me up**. The backend fetches the selected human thread and the existing PR/code through the real APIs. It verifies the GitHub evidence independently of the original seeded Slack thread.
4. Inspect ProductList's `response.totalPages` use, the backend removal and `nextCursor` addition.
5. Click **Why did this change?** Inspect the actual human authors, text, permalinks, dynamic **DEC-15**, source status, and PR reference. The relationship starts as **Possible match — not verified**.
6. Confirm, reject, defer, reopen, or select a corrected source. These controls affect the local relationship review only. They do not change the source decision, Slack posts or PR.

Bot-generated posts are excluded from human analysis, even if a human replies in the original seeded thread. New human discussion activity can fall inside the absence window even when the linked PR predates it; the PR's original timestamp is still displayed accurately.

## 5. Demonstrate updates, uncertainty and recovery

- **Remove the confirmation:** Edit its message so it is a question or says `Decision DEC-15 is not confirmed`. After an edit event, the loaded result is flagged stale and review is disabled. Run Catch me up again; the source decision should return to proposed/unverified.
- **Delete a human reply:** A deletion event advances the thread revision. Fresh analysis uses Slack's current thread contents, so deleted text cannot remain source evidence.
- **Supersede:** Add a later human reply such as `[Human demo] DEC-15 superseded: retain offset pagination while we coordinate the frontend migration.` Refresh analysis; source status becomes superseded.
- **Wrong PR reference:** Use an unrelated PR URL in a separate simulation. The analyzer must not claim an exact link to the configured pagination PR. Inspect the low-evidence rationale and reject or correct the relationship.
- **Disconnect:** Stop the backend. Restarting reconnects, but this demo's metadata index is cleared. Post a new human message/reply after reconnection to rediscover the thread. The UI does not claim complete history coverage.

The backend acknowledges event envelopes promptly before any source API requests or analysis. It deduplicates Slack retry event IDs and uses the official client's reconnect behavior. Edits and deletions update revisions; the UI warns on stale results or listener outages. Raw SDK logs are suppressed to avoid emitting payloads, credentials or connection URLs.

## Limits and safety

- Collection is opt-in, restricted to non-production with `HOST=127.0.0.1`, and scoped to the allowlisted workspace/channel. It does not bypass the upstream authenticated general team-activity route.
- Only bounded metadata is retained in memory: up to 100 recent thread records, up to 8 days of observed activity, and bounded deduplication/message-ID maps. Human message bodies are not written to disk or Supabase.
- Metadata is lost on restart and there is no historical backfill. Events can be missed during outages/rate limiting. This is a local gallery prototype, not a durable production ingestion service.
- The backend must remain running while people post. The UI polls metadata every five seconds; it does not automatically run GitHub analysis after every Slack message.
- This collector does not send Slack messages, change app scopes, modify tasks, merge PRs or push code. Manual Slack simulation posts belong to the humans who create them.
- Disable collection by setting `SLACK_EVENTS_ENABLED=false` and restarting. Remove your own simulation posts manually if desired; simulator cleanup does not delete human-authored threads.

## Verification

Run `npm test` and `npm run build`. Automated tests use mocked event envelopes, sockets and HTTP responses to cover acknowledgement, retries, channel/workspace filtering, bot exclusion, bounded metadata, edits/deletions, reconnects, fresh human-thread retrieval, dynamic decision IDs, uncertainty and local-only access.

The existing seeded API flow can still be checked with `npm run demo:verify`. A live human-event delivery check requires the user-configured xapp token, enabled Socket Mode, matching bot event subscriptions, and an actual human Slack post. Do not claim that check succeeded solely because automated tests or a socket connection passed.

Local verification for this increment: 59 automated tests passed and the production build passed. After the user configured the app-level token, collection was enabled and the backend reloaded. On 2026-11-08, live Socket Mode delivery was verified with three human-authored messages in one thread. The running Vite→Fastify catch-up returned HTTP 200, human_events source, source DEC-15 confirmed with three inspectable Slack evidence IDs, breaking ProductList impact from the real PR, and a possible/unverified relationship awaiting human review. Message content, user IDs and the private human thread permalink were not added to the repository. No bot posts or remote code changes were made for this check.
