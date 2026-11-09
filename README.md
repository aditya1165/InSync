# InSync

InSync is a task-aware collaboration prototype built with React, TypeScript, Vite and Fastify. It preserves the workspace shell and saved Light/Dark appearance with two views:

- **My work:** Select a Supabase assignment → Catch me up → inspect task-specific impact and code evidence → Why did this change? → review the suggested Slack-to-PR relationship.
- **Team activity:** Inspect the same selected scenario’s PR and Slack evidence, actual source timestamps, source filters, task link and shared relationship review. Separate illustrative activity samples remain under a disclosure.

```bash
npm ci
cp -n .env.example .env
npm run dev
```

Use Node 24 or newer. Open http://localhost:5173; the API runs on port 3001. **My work** is the default. Choose **Offline pagination sample · simulated** under Scenario evidence to demonstrate both interactions without credentials or a database. All offline records and relative dates are labeled simulated.

For the real classroom walkthrough, reuse **PR #1 and the existing human DEC-15 discussion**. Every Catch me up fetches those sources again; no push, new PR, new Slack post, merge or deployment is needed. Follow **[the one-time setup and repeatable walkthrough](docs/WORKSPACE_DEMO.md)** to create an Auth user, preview/apply a dedicated ProductList assignment and source grants, and pin the thread in an ignored replay profile.

```bash
npm run demo:setup-task # dry-run; prints exact confirmation for a later apply
npm run demo:pin        # read-only remote discovery; saves local identifiers + real dates
npm run demo:verify     # read-only assignment, grants, PR, human discussion + contract checks
npm test
npm run build
```

Analysis uses **evidence-based rules**, not model inference. It validates the selected task’s component/API/field mapping against retrieved backend code, frontend consumer and PR patch. Unrelated or missing mappings remain uncertain. Source decision status stays separate from Confirm / Reject / Correct / Remind Later review. Review is shared across the two views for the current session; **Reset walkthrough** clears results and reviews while retaining task selection and replay settings. Remind Later is a deferral, not a scheduled notification.

Live evidence requires membership-scoped task ownership, approved source grants, allowlists and a loopback non-production server. Local `INSYNC_DEMO_USER_ID` and `INSYNC_DEMO_WORKSPACE_ID` supply a single demo identity; production sign-in remains unimplemented. General `/api/activity` still fails closed without a verified ticket-board scope. Supabase’s public root CA is included for verified database TLS.

The optional [Socket Mode guide](docs/SLACK_EVENTS_DEMO.md) describes discovering **new** human discussions. The saved DEC-15 replay works after restarts without another Socket Mode event. Source text is fetched on request and is not stored in Supabase or the replay profile. Private IDs/dates and simulator journals stay inside ignored `.demo/`; credentials remain in server-only `.env`.

The [original simulator runbook](docs/REAL_DATA_DEMO.md) covers the separately authorized seed and guarded cleanup. Seed and cleanup still default to dry-run; they are unnecessary for repeated presentations. Human messages are outside simulator cleanup ownership.

Scope, truthful demo boundaries and verified progress are in [PROJECT_SPEC](docs/PROJECT_SPEC.md) and [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md).
