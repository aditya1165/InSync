# My work and Team activity: one-time setup and repeatable demo

The primary walkthrough reuses the existing **PR #1** and human-authored **DEC-15** Slack thread. Analysis uses deterministic evidence-based rules. Real actors, source timestamps, permalinks and PR lifecycle come from readback; an open PR is not a deployed change. The offline pagination sample is explicitly simulated.

## One-time database setup

The currently configured demo project has its schema. For a **different or newly created Supabase project**, first save that project's own Session pooler `DATABASE_URL`, matching `SUPABASE_PROJECT_REF`, and Auth user UUID in `.env`. The database password is separate from the Auth user's password. Use verified TLS as shown in `.env.example`.

Run `npm run db:check` before task setup. If the schema is absent, review and apply these existing files to the intended project in order, within a transaction:

1. `supabase/migrations/20261106000000_initial_schema.sql`
2. `supabase/migrations/20261106000001_tasks_schema.sql`

The migrations create ten application tables with row level security and a profile trigger for future Auth users. If the selected demo Auth user already existed before the migrations, create only that user's missing `public.profiles` row from `auth.users` (preserving existing rows). The authorized 2026-11-09 setup did this and saved an identifier/hash-only receipt in ignored `.demo/workspace-schema-receipt.json`. The connected project and selected Auth user were checked before any schema write.

Do not run the old general `supabase/seed.sql` against the connected project: it is a separate historical fixture seed. Do not reuse another teammate's connection string when configuring your own project.

1. In the intended Supabase project, open **Authentication → Users → Add user → Create new user**. Use an email you control, set a password privately, and use Auto Confirm if offered. Copy the created User UID. This must be an actual Auth user; the setup script does not create or overwrite users.
2. Save the UUID in local ignored `.env` as `INSYNC_DEMO_USER_ID=...`. Keep the existing verified-TLS `DATABASE_URL`, GitHub/Slack credentials and demo allowlists. Do not use `VITE_` prefixes.
3. Preview the dedicated records, source targets and exact confirmation:

   ```bash
   npm run demo:setup-task
   ```

   This is a local preview without database writes. It proposes a dedicated **InSync · ProductList gallery demo** workspace, owner membership, **Build ProductList pagination** assignment, `ProductList → GET /products → totalPages`, and grants for the configured approved repository/channel. It does not inspect database collisions until apply.

4. After reviewing the exact user and source targets, apply using the confirmation printed by the preview:

   ```bash
   npm run demo:setup-task -- --apply --confirm 'EXACT_CONFIRMATION_FROM_PREVIEW'
   ```

   Applying is an explicit database mutation. Do not run it until the user approves that concrete target or runs it themselves. A transaction creates only reserved demo rows. Repeated execution reuses unchanged rows and preserves unrelated workspaces, users, tasks and preferences. Ownership, workspace, mapping or source-target collisions stop and roll back the transaction; the script does not repair or overwrite them. A source preference that opts out remains opted out.

5. Set the workspace ID printed by setup in `.env`:

   ```dotenv
   INSYNC_DEMO_WORKSPACE_ID=b7d521e0-9324-477a-9b62-075965d06001
   ```

6. Restart the API after `.env` changes. Use only one Socket Mode receiver if the optional listener is enabled. `npm run dev` starts Vite and Fastify; stop an older copy first if its ports are occupied.

The user UUID/workspace env values provide a **local single-user identity**, only for `HOST=127.0.0.1` outside production. They do not implement production authentication. Task reads join workspace membership and assignment ownership. Live scenario readback additionally checks explicit GitHub and Slack grants, including source opt-outs, before any remote API request.

## Pin the existing human discussion once

Keep the original simulator manifest in ignored `.demo/`. No new seed is needed.

```bash
npm run demo:pin
# If multiple candidate discussions exist, specify the intended human parent ID:
npm run demo:pin -- --thread-ts 'ACTUAL_PARENT_SECONDS.MICROSECONDS'
```

Pin uses read-only GitHub/Slack requests. It discovers a human pagination parent, fetches its replies and PR/code, requires confirmed DEC-15 with inspectable contract evidence, and saves only source identifiers and the **real event date range** in `.demo/<run>.replay.json` beside the manifest. Ambiguous discovery fails and requests an explicit parent ID. Human bodies, credentials and review choices are not persisted. The pinned human thread is never inserted in `manifest.messages`, so simulator cleanup cannot own it.

A fresh server reads the profile and fetches that parent directly from Slack. Socket Mode discovery and a new message are unnecessary. Each Catch me up still reads current source bodies/code/status; replay does not pretend to reconstruct every historical event. Missing/deleted parent or inaccessible code yields an error, edited/missing confirmation yields proposed/unverified status, and incomplete mapping/patch evidence yields uncertainty. A later observed edit/delete event clears relationship review; an offline listener does not turn a freshly fetched pinned thread into missing evidence. This remains a user-requested evidence snapshot, not a continuous synchronization guarantee.

```bash
npm run demo:verify
```

Verify reads the assignment, membership, mapping, effective source grants, pinned discussion, PR identity/refs and before/after/frontend/patch evidence. It checks confirmed DEC-15 and breaking contract evidence inside the pinned window. It does not seed, post, push, merge, alter tasks, or persist source bodies. Before Auth/task setup is applied, it fails with a setup error instead of claiming successful integration.

## 60–90-second presentation

1. **My work:** Select the real ProductList assignment. Keep **Saved human DEC-15 discussion + PR** and **Use saved scenario window** selected. Click **Catch me up**.
2. Inspect removed `totalPages`, returned `nextCursor`, the actual ProductList read and task mapping. Show the open/merged/closed PR lifecycle and recommended migration/checks. Deployment remains unverified.
3. Open **Why did this change?** Inspect DEC-15’s source decision status, human authors, Slack permalinks and PR reference. Explain that the relationship begins **Possible match — not verified**.
4. Confirm, reject, correct to an inspectable message, defer or reopen. Confirmation changes the relationship review only.
5. Switch to **Team activity**: the same retrieved PR/messages and review appear. Filter GitHub/Slack and open the affected task again. The feed shows events in the loaded window; earlier context is still inspectable in My work. This is the selected scenario’s evidence, not a complete workspace feed.
6. Click **Reset walkthrough** in either view. The result and all review/correction state clear, while task, source mode, window and replay settings remain ready for the next visitor. Click Catch me up again to fetch fresh records.

If a provider fails, select **Offline pagination sample · simulated** explicitly. It uses its own labeled sample ProductList assignment and relative sample dates, even when no real Auth user is configured. It does not claim to analyze an unrelated selected database task. The sample uses staged DEC-14 rather than the real human DEC-15. No remote error silently substitutes a sample response.

## Contracts and scope

- `GET /api/real-demo/replay?taskId=UUID` returns only pinned thread/decision/PR identifiers and window after task + source authorization.
- `GET /api/real-demo/catch-up?mode=live&taskId=UUID&replay=true&start=ISO&end=ISO` retrieves the same approved sources on every request. Custom windows use real timestamps, inclusive start and exclusive end. Supabase component/endpoint/used-field mapping gates the impact claim. This scenario supports ProductList’s verified consumer only; unrelated/absent mappings remain uncertain.
- Existing indexed-human and seeded-bot options remain available. Live access stays local-only and requires the same task/source authorization.
- `mode=sample` is anonymous and explicitly simulated, with an independent sample assignment; it never treats query IDs as an authenticated assignment.
- App owns the result and relationship review. Switching tabs does not reload or reset either. A new catch-up, changed task/source or Reset walkthrough clears the prior review. Late requests cannot restore a result after reset or task changes.
- No mapping discovery, mapping editor, production sign-in, task modification by analysis, reminder scheduler or LLM inference is claimed. The predefined database mapping is inspectable. General illustrative Team activity samples remain in a separate disclosure, not mixed with real scenario evidence.
