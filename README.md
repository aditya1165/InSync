# InSync

InSync is a web app for catching up on Slack and GitHub project activity. This first increment implements the user-initiated catch-up flow with labeled demo records. It does not connect to live accounts or call an AI model yet.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use **Catch me up** after choosing one of these ranges:

- **Last 24 hours:** the rolling 24 hours before the click.
- **Last week:** the previous calendar week in the browser's locale and time zone. The app shows the exact dates before running.
- **Since last catch-up:** from the most recent successfully loaded summary in the current app session. Run a catch-up first to enable it. Reloading the app clears this timestamp until account or browser persistence is decided.

The result shows possible decisions, unresolved discussions, code changes, suggested next actions, and a complete activity list. Every highlight opens the sample records used as evidence. The sample feed includes Slack messages and threads and GitHub issues, pull requests, commits, and review comments. Source filters and the evidence panel are interactive.

All sample analysis is scripted and labeled as such in the UI. It must not be presented as a live AI conclusion or a verified team decision.

## Verify

```sh
npm test
npm run build
```

The next integrations will use the `ActivityProvider` and `CatchUpAnalyzer` interfaces in `src/lib/catchup.ts` once the test Slack workspace, demo GitHub repository, and model credentials are available. The separate Decision → PR interaction is outside this first increment.
