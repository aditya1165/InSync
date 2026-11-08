# InSync

InSync is a task-aware collaboration prototype built with React, TypeScript, Vite and Fastify. It includes three views and a saved Light/Dark theme:

- **Pagination demo:** Leo's ProductList → cursor-pagination change → Slack decision-to-PR review. Uses real API evidence after an approved seed, or an explicitly labeled offline pagination sample.
- **My work:** Supabase-backed assigned tasks and API mappings, plus the upstream scripted sample task walkthrough.
- **Team activity:** Labeled sample Slack/GitHub activity with time ranges. Live `/api/activity` requests still require authenticated ticket-board/source grants.

```bash
npm ci
cp -n .env.example .env
npm run dev
```

Use Node 24. Open http://localhost:5173; the API runs on port 3001. The Pagination demo is the default view. Choose **Scripted pagination sample (offline)** for a demo without credentials. No Supabase or OpenAI key is required for this flow.

For real-time **human-written Slack discussions**, follow [the Socket Mode setup and simulation guide](docs/SLACK_EVENTS_DEMO.md). This optional listener needs a server-side xapp app-level token in addition to the existing bot token.

For real API-created Slack threads, Git commits, branches and a PR, follow **[the real-data setup and walkthrough](docs/REAL_DATA_DEMO.md)**. It includes token permissions, allowlists, dry-run/apply/verify/cleanup commands, recovery, manifest details and a 60–90-second demo script. External writes require explicit target confirmation. The simulator targets a separate demo repository and never merges a PR. Its live evidence route is restricted to the local loopback demo, not production or a public bind.

```bash
npm run demo:seed       # local dry-run; configure target/allowlists first
npm run demo:validate   # read-only credential/target checks
npm run demo:verify     # re-fetch artifacts recorded by an approved seed
npm run demo:cleanup    # preview only
npm test
npm run build
```

Pagination analysis uses deterministic contract rules, labeled `evidence_rules`, with links to the actual source records. **Why did this change?** keeps the source decision status separate from human confirmation/rejection/correction of an inferred relationship. Review is session-local. Remote failures are visible; sample fallback is explicit.

For Supabase tasks, configure `DATABASE_URL` and the local-only `INSYNC_DEMO_USER_ID` / `INSYNC_DEMO_WORKSPACE_ID` with an existing Auth user, workspace membership, task and optional API mappings. Run `npm run db:check` to verify the schema. The repository includes Supabase's public root CA at `certs/supabase-root-2021.crt` for verified TLS. Local demo identity is disabled in production or when the API is not bound to `127.0.0.1`; real multi-user authentication remains necessary. Task assignments from Supabase do not yet drive live PR/Slack analysis. The upstream sample task view remains scripted and has no link-review controls; the Pagination demo supplies that review workflow.

Planned ASN03 features and current limitations are recorded in [PROJECT_SPEC](docs/PROJECT_SPEC.md) and [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md). Keep credentials in the ignored server-side `.env`; private simulator journals belong in ignored `.demo/`. Slack messages and GitHub diffs are not persisted in Supabase.
