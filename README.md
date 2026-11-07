# InSync

InSync is a local web app for catching up on project activity from Slack and GitHub. The sample mode demonstrates possible decisions, unresolved discussions, code changes, and suggested next actions with labeled fixture records. Live mode reads real source activity and links each record to its origin. AI analysis is not connected to live activity yet.

## Run locally

```sh
npm install
cp .env.example .env
npm run dev
```

Open the URL printed by Vite. The web app runs through Vite and proxies `/api` to the Fastify server at `127.0.0.1:3001`. The API binds to localhost by default. `npm run dev:api` starts only the backend; `npm run dev:web` starts only the frontend. `npm run build` builds both, and `npm run start:api` starts the compiled API.

## Connect live sources

Edit `.env` with the dedicated test workspace and repository:

- `GITHUB_REPOSITORY=owner/repo` selects the single repository in scope. `GITHUB_TOKEN` is optional for a public repository and needed for a private one. Use a token with read access to the repository's issues, pull requests, comments, and commits.
- `SLACK_BOT_TOKEN` is a token for an app installed in the test workspace. Invite that app to the channels to be included. Give it the history permissions needed for those public or private channels and their threads.
- `SLACK_CHANNELS=C123:general,C456:engineering` lists only the channels in scope. Channel IDs are required; names are display labels.

Restart the API after changing `.env`. When at least one source is configured, the **Live sources** option becomes available. Click **Catch me up** to retrieve activity. The backend is read only: it does not post to Slack or change GitHub data. Keep `.env` local; it is ignored by Git.

## Database foundation

The schema is in `supabase/migrations/20261106000000_initial_schema.sql`. It is designed for Supabase Postgres and references Supabase Auth users. It holds profiles, workspaces and memberships, approved GitHub repositories and Slack channels, explicit per-user source access, source preferences and external identities, and successful catch-up checkpoints. It does not store Slack messages, GitHub content, or API tokens.

To apply it, create a Supabase project, then use the [Supabase CLI migration workflow](https://supabase.com/docs/guides/local-development/database-migrations): initialize the local CLI config if needed, sign in, link the project, and run `supabase db push --remote` from this repository. Copy the project's Postgres connection string into `DATABASE_URL` in `.env`, including `sslmode=require` or stronger for a remote connection. Run `npm run db:check` to confirm the connection and schema. Keep the connection string server-side and out of Git.

The current catch-up endpoint remains unauthenticated and does not write to Postgres. The database access functions in `server/db/` are ready for the next login step: they read only a user's permitted sources and record a catch-up only for a workspace member. A completed run stores the end of its covered window separately from its completion time, so a later “since last catch-up” query can resume without a gap. The browser's current-session timestamp remains in use until authentication is connected.

The API exposes `GET /api/health` and `GET /api/activity?start=<ISO date>&end=<ISO date>`. GitHub activity includes issues, pull requests, commits, issue or PR comments, and pull request review comments. Slack activity includes messages and replies in configured channels, including new replies to older threads. Source failures are shown separately, so a partial result is visible. The catch-up point advances only after all configured sources load successfully.

## Catch-up ranges

- **Last 24 hours:** the rolling 24 hours before the click.
- **Last week:** the previous calendar week in the browser's locale and time zone.
- **Since last catch-up:** from the most recent successfully loaded summary in the current app session. Sample and live modes keep separate timestamps. Reloading clears both timestamps.

The source connectors scan paginated API results and stop with an error if a channel or repository is too large for the current 50-page limit. For a small test workspace, narrow `SLACK_CHANNELS` to the relevant channels. Slack source links are obtained from the Slack API, which can make a large catch-up slower. No user accounts or shared persistent state are implemented yet.

## Verify

```sh
npm test
npm run build
```

The tests use mocked GitHub and Slack responses. Live credentials and the dedicated test workspace/repository are still needed for an end-to-end source check. The separate Decision → PR interaction is planned after this catch-up flow.
