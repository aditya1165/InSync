# InSync ASN04 Implementation Plan and Progress Log

**Audit baseline (2026-11-06):** Local checkout at Aditya’s catch-up increment, `273f7fdec407ac178973f616b38128528c6df771`. The working tree already contained a modified lockfile and untracked context files. This audit updates the plan only.

**Authority:** [Submitted ASN03](<ASN - 03.pdf>) §§2–3 defines F1–F5 and both intelligent interactions, §4 describes the proposed architecture, §6 records the team’s formative evaluation plan, and appendix pp. 7–9 illustrates the UI. [Instructor ASN04](<ASN04_Design_Gallery X Update.pdf>) pp. 1–2 defines grading and station expectations. [Demo scenario](DEMO_SCENARIO.md) is a proposed fixture, pending data-team confirmation.

## 1. Observed implementation

Aditya’s React/TypeScript/Vite increment provides user-initiated, time-windowed catch-up, categorized highlights, an all-source feed with Slack/GitHub filters, and an inspectable sample record dialog. Preserve this shell, source browsing, and the existing loading, error, and empty states. The ASN03 appendix adds a task selector, mapping controls, an impact view, a decision-link verification view, and an evidence review queue. Reuse the existing UI patterns to deliver those behaviors.

`App.tsx` calls `createCatchUp` with `createDemoProvider` and `demoAnalyzer`. In `src/lib/catchup.ts`, the provider receives a time window, the analyzer receives activities, and the result mode is always `demo`. The analyzer selects prewritten highlights whose evidence IDs resolve within the selected window. This gives the app real filtering and evidence navigation over local samples. The sample copy is scripted. GitHub and Slack retrieval, PR-diff analysis, and model inference are absent.

## 2. Gaps against ASN03

| Feature | Observed | Required next behavior |
|---|---|---|
| F1 Task-Based Catch-Up | **Partial.** Range selection and source filtering work over fixtures. Profile and Pagination highlights reflect their timestamps. | Select an assigned task and use its component/API mapping alongside the time window to prioritize relevant updates. Keep the full feed for manual inspection. Show limited task context or uncertain relevance when appropriate. |
| F2 Task Dependency Mapping | **Missing.** Endpoint names appear in fixture prose. No structured component-to-API mapping drives filtering or analysis. | Seed a predefined mapping for the first slice, as ASN03 permits. Make the mapping inspectable. Track add/edit/remove and an explicit unverified state for missing or stale mappings, as specified in §3. |
| F3 AI Impact Explanation | **Missing as an interaction.** Scripted Profile cards summarize an open PR and suggest checking field usage. | Let a developer request an explanation for a selected task and relevant PR. Use the task, mapping, PR state and diff to explain possible component impact and provide a verifiable next action. Surface insufficient evidence. |
| F4 Decision-to-PR Connection | **Missing as an interaction.** The Pagination card cites Slack and a draft PR in one scripted highlight. The Profile decision card cites Slack alone. | Have the system propose a relationship for user verification, with evidence from both sources and separate decision and link-review states. Include a confirmed-decision candidate and an unresolved or weak match. |
| F5 Evidence and User Controls | **Partial.** Evidence IDs resolve to local sample detail. Some cards display Unverified or Suggestion. Unsupported highlights are dropped and sample records have no original source URLs. | Queue uncertain suggestions and show source availability and uncertainty. Provide Confirm, Not Relevant, Remind Later, and undo or reopen as appropriate. Keep unavailable-evidence items visibly unresolved. Review changes only local review state. |

**Interaction 1 gap.** The current click path ends at a time-based highlight and sample detail. The target path is task selection → mapped API → relevant PR → developer requests impact → evidence, uncertainty and next action → review. For the proposed Profile example, PR #18 is open and adds `display_name` while retaining `user_name`. Keep merge and deployment status distinct and report migration timing as unresolved. Add a separate removal or incompatible-change case to test the distinction.

**Interaction 2 gap.** The current click path opens evidence on generic decision highlights. The target path is system-suggested Slack ↔ PR link → inspect both sources and the decision status → verify, reject, or defer. ASN03’s primary case links a confirmed Slack decision with a relevant PR, subject to human verification. The proposed Profile discussion can exercise the unresolved path with “Possible match - not verified.” Ask the data team for a clearly settled decision with inspectable supporting evidence for the primary path. Confirming a relationship must leave the underlying decision status and PR status unchanged.

## 3. Ownership
**Agreed ASN04 allocation:**
- Prototype Development: **Aditya and Jimin**
- Scenario/data: **Karthik, Sameer**
- Presentation/QA: **Kelly, Astrid**

**Individual development responsibilities: TBD.** Aditya and Jimin share Prototype Development. Ownership of F1–F5, both intelligent interactions, and integration remains open until they discuss and agree on the division of work.

## 4. Implementation milestones and exit criteria
### M0. Repository safety and source agreement
- [x] Inspect local history and working tree, read both source PDFs, and compare current UI code with ASN03 appendix mockups (pp. 7–9).
- [x] Run `npm test` and `npm run build` with existing dependencies on Node 26.12.0. All six tests and the build passed. Default Node 20.20.2 cannot load the TypeScript test files directly.
- [ ] Check upstream changes and open PRs before starting implementation. Run the browser baseline and preserve the existing time-range and evidence paths.
- [ ] Agree on demo scope and fixtures with Karthik/Sameer.
- [ ] Agree shared TypeScript contracts, response states, evidence IDs, API boundaries jointly.

### M1. Task-aware foundation (F1 + F2)

**Next independently testable slice.** Add one assigned Profile task with one predefined component/API mapping. In a test window that contains both Profile and Pagination records, selecting Profile should surface the Profile PR and exclude Pagination from task highlights. The all-source feed should still show both. Exercise an unmapped task and verify that the UI exposes uncertainty and the manual feed.

**Likely files and dependencies.** Extend the catch-up controls and results in `src/App.tsx`, task relevance at the orchestration boundary in `src/lib/catchup.ts`, and labeled fixtures in `src/lib/demo.ts`. Cover the mixed-window and unmapped cases in `src/lib/catchup.test.ts`. Current Profile and Pagination records occupy different time windows, so a test of time filtering alone cannot establish task relevance. Use the existing stack and local fixtures for this slice. Before editing shared interfaces, Aditya and Jimin should agree on task/component/endpoint IDs, evidence references, and whether task context extends the existing analyzer contract or travels through a separate path. The proposal in `DEMO_SCENARIO.md` is a discussion starting point.
- [ ] User chooses an assigned frontend task.
- [ ] Task has associated component and backend API(s).
- [ ] Unrelated GitHub/Slack activity is not promoted as task-relevant.
- [ ] Unknown mapping is explicitly labeled and can be inspected/edited or handled through fallback.

### M2. Interaction 1 (F3 + F5)
- [ ] User requests an impact explanation for a task and relevant PR.
- [ ] Analyzer considers PR diff/metadata and known task dependency.
- [ ] Structured result includes **potential** impact, next actions, evidence, uncertainty, generation mode.
- [ ] Verify an open additive PR and a separate incompatible-change case. Track change type, PR lifecycle, and deployment independently.
- [ ] Reviewer can inspect evidence and confirm/reject/postpone a suggestion.

### M3. Interaction 2 (F4 + F5)
- [ ] System initiates a Slack ↔ GitHub PR suggestion. Demonstrate a confirmed-decision candidate and an unresolved or weak candidate.
- [ ] UI shows source evidence and proposal/unresolved/confirmed decision status.
- [ ] No AI-only result is represented as human-verified decision.
- [ ] Reviewer can confirm, mark Not Relevant, or Remind Later. Verify undo or reopen and that link review preserves decision status. Test missing evidence and keep the item unresolved.

### M4. Robust interactive gallery demo
- [ ] Both interaction flows independently demonstrable, ideally one linked narrative.
- [ ] Two or more realistic test cases, including an irrelevant/uncertain case.
- [ ] Stable fixtures and honest `scripted_demo` vs `llm` labeling.
- [ ] Loading/error/empty states and graceful fallback.
- [ ] Reset for repeated peer visits; no exposed tokens.
- [ ] Demo runbook shows what's working for **both** interactions and what remains mocked.
- [ ] QA rehearses the five instructor criteria, each worth two points per reviewer: motivating scenario, problem/goal, both prototype flows, actual progress on both flows, and hands-on interaction with Q&A. Keep the walkthrough to a few minutes.
- [ ] Each student visits the other four stations and submits a PDF with scores, two specific strengths, two weaknesses, thoughts on the interactions, and constructive suggestions for each project.

**Assignment boundary.** ASN03 defines the F1–F5 MVS, including the intended OpenAI reasoning and GitHub/Slack integration. ASN04 grades the station and explicitly allows showing partial progress. A fixture-only run can show clickable flow and current progress if labeled. Track it as a deviation from live integration and AI reasoning, and disclose it at the station. The cognitive walkthrough, heuristic evaluation, and five-person think-aloud are proposed in ASN03 §6. ASN04 has no separate scoring line for those studies. Their completion is unverified.

## 5. Architectural guidance
A practical design is to retain the existing activity feed and extend it with task context and two typed suggestion results. Avoid coupling model responses to JSX components. For live AI calls, add a **server-side** endpoint or service with validated JSON outputs and evidence IDs matching retrieved records. Keep fixtures available as an explicit offline mode. Source URLs should come only from actual retrieved records or labeled simulated details.

**Avoid overbuilding:** multiple OAuth providers, auto-discovery, notifications, advanced databases, generalized agent frameworks, and auto-code-repair are unnecessary for this specific gallery milestone unless the basic two-flow demo is already stable.

## 6. First joint developer meeting agenda
1. Run the repo, verify baseline tests, check latest commit and README.
2. Read ASN03 and ASN04 descriptions side by side with current screens.
3. Decide how to adapt time-based catch-up into **task-based catch-up** without discarding working UI.
4. Align with Karthik/Sameer on one PR/Slack/task fixture and expected outputs.
5. Freeze common `Task`, `PR`, `Evidence`, `ImpactSuggestion`, `DecisionLinkSuggestion`, `ReviewStatus` contracts (or map to existing types).
6. Agree role split and feature branches; assign integration owner.
7. Implement a vertical slice: task → impact → evidence → review, then Slack↔PR link → evidence → review.

## 7. Commands (assuming unchanged package scripts)
```bash
npm install
npm test
npm run build
npm run dev
```

Recommended collaboration:
```bash
git fetch origin
git status
git switch -c codex/<scoped-feature>
# work, test, commit, push, PR
```
Do not overwrite or force-push teammates' branches.

## F3/F4 sample demo and module handoff

The feature branch builds on `6f36a35`, which adds Fastify, read-only Slack/GitHub providers, and a Supabase database foundation. The baseline above records the earlier catch-up prototype. **My work** now defaults to a Supabase-backed task list; choose **Sample demo** for the scripted analysis flow. Select one of the labeled example Jira-style assignments and click **Catch me up**. The Profile task then displays open sample PR #18 and local sample draft PR #21. Select a proposal to inspect its file-by-file diff, one suggested next step, and source evidence. PR #21 is a local fixture added to demonstrate multiple proposed changes and files; it is not retrieved from GitHub. Slack context for PR #18 shows its sample channel and separates a team decision from an open question. The Catalog task returns an uncertain result rather than an invented change. **Team activity** retains the separate time-range sample feed.

**ASN04 prototype adjustment.** The visible task flow now begins with selection and an explicit catch-up action. The Jira assignments are local examples, not a live Jira integration. The profile impact and Slack decision outputs are scripted samples. The second PR is a local UI fixture. Review buttons were removed because they changed only transient page state; a meaningful F5 review workflow with persistence or clear recovery remains incomplete. These deviations must be disclosed in the gallery demo.

```ts
import { explainImpact, suggestDecisionLink } from './server/analysis/service.ts'
import { demoEngine, profileTask, profilePr, profileDiscussion } from './server/analysis/demo.ts'

const input = { task: profileTask, pr: profilePr }
const impact = await explainImpact(input, demoEngine)
const link = await suggestDecisionLink({ ...input, decision: profileDiscussion }, demoEngine)
```

`npm test` includes `server/analysis.test.ts`. To integrate, adapt existing provider records to the module inputs after resolving authenticated user assignments, API mappings, and authorized sources. Supply a complete relevant PR patch and the Slack parent and relevant replies. Resolve returned evidence IDs against those inputs for display. Derive Slack decision status from verified source evidence and track the user's link review separately. Connect an approved server-side model engine after agreeing on source access and redaction with Aditya. Live provider and model calls for F3/F4 and the F5 review workflow remain integration work.

## 8. Progress log
| Date | Owner | Verified change | Tests | Remaining issue / PR |
|---|---|---|---|---|
| 2026-11-06 | Documentation audit | Read both original PDFs and all repository planning docs. Audited Aditya’s local baseline and recorded F1–F5 gaps and demo criteria. | Node 26.12.0: 6 tests passed and build passed. Browser walkthrough pending. | Confirm shared contracts and fixtures, then implement M1. |
| 2026-11-06 | F3/F4 module | Added offline Profile impact and Slack decision-link samples with evidence validation and uncertainty handling. | Node 26.12.0. All 17 tests and the build passed. Ran both sample calls directly. | Connect the module to the existing Fastify routes, authorized providers, model engine, and review UI. |
| 2026-11-06 | Sample UI | Wired Profile task selection, PR impact, both Slack link cases, evidence, and session review to Fastify sample routes. | All 18 tests and build passed. Chrome verified both interactions, all review actions, undo, reset, and existing catch-up. | Connect live authorized evidence and model analysis. |
| 2026-11-06 | Sameer (Data & Scenario) | Implemented ASN-04 Demo Fixtures, Supabase F2 Task Mapping schema/seed (`20261106000001_tasks_schema.sql`, `seed.sql`), Fastify F3/F4 routes (`/api/demo/impact` with 400 missing-task error & unknown-task fallback, `/api/demo/decisions` with confirmed truth & planted trap), and Dark Obsidian / Navy / Electric Cyan HCI UI. | All 23 tests passed + Vite client/server build passed. Verified in-memory Postgres via PGlite. | Ready for live gallery station walkthrough and peer evaluation. |
| 2026-11-07 | UI refinement | Pulled `main` (already current), restored Light default and saved Dark switch, removed mouse-driven card rotation, replaced task dropdown with two selectable example task cards, and removed the visible dependency chip and temporary Add Task/Reset controls. Slack cards now identify the channel and summarize the status without displaying a conversation quote or “Link Rationale”; both source records remain inspectable. | Tests and build pass; local browser capture was unavailable in this session. | The visible page no longer edits F2 mappings; add an approachable editing path if required for the final ASN04 demo. Review choices still live only in the page session. The demo analysis is scripted. |
| 2026-11-07 | Simplified task flow | Made task catch-up user-initiated, added a two-proposal/file diff view with one next step per change, and reduced Slack context to channel, status, short summary, and source links. Removed temporary review buttons. PR #21 is an explicitly labeled local fixture. | 25 tests and build pass; `git diff --check` clean. Browser capture unavailable in this session. | Jira and PR #21 are not live integrations. F5 review workflow remains incomplete; rehearse both click paths in a browser before the gallery. |
| 2026-11-07 | Workspace navigation and activity scope | Added separate **My work** and **Team activity** sidebar views. Moved the full sample Slack/GitHub browser to Team activity. Live `/api/activity` now fails closed unless a server resolver supplies a verified ticket-board scope and allowed source providers; production has no resolver yet. | 26 tests and build pass; anonymous/missing-board access tests return 403. | Connect real sign-in, ticket-board membership, and per-user source grants before re-enabling live Team activity. The sample feed is illustrative and is not Jira-board data. |
| 2026-11-07 | Supabase task read | Restored verified TLS with the public Supabase root CA, applied the existing task/dependency migration to the connected project without seeding rows, added a membership-scoped read endpoint, and made **My work** show database assignments separately from the sample walkthrough. | `npm run db:check` passes; the read query returns zero tasks, consistent with zero Auth users and zero task rows. 28 tests and build pass. | Configure an existing Auth user/workspace for the local demo, then add real assignments. Production sign-in and Jira/Slack/GitHub linking are not implemented. |

Only mark implemented features after code review and preferably runnable validation. Do not claim work is done based solely on intent.

## Real pagination integration increment (2026-11-07)

**User-authorized scope:** Replace the active ProfileSettings storyline with Leo/ProductList, Maya/Sam, cursor pagination and DEC-14. Preserve React/Vite/Fastify, source browsing, Supabase foundations and legacy routes. Do not push the InSync feature branch without separate user approval. Do not apply remote simulator writes without explicit approval of the demo target and command.

**Repository audit:** Live providers normalize GitHub activity and Slack messages, while the old F3/F4 routes use independent hard-coded ProfileSettings records. The default UI previously called those fixtures. Credentials were blank; dependencies were initially missing. No live integration success was verified. The database stores scoped task/source/checkpoint metadata, but this demo has no authenticated user routing; adding a new database schema would be unnecessary for the isolated simulator.

**Incremental plan / actual files and contracts:**
1. `server/real-demo/config.ts`, `api.ts`, `scenario.ts`, `manifest.ts`, `simulator.ts`, `cli.ts`: allowlisted API transport, actual Git object/ref/PR creation and Slack thread posting, checkpointed manifest/recovery/cleanup. First independently testable milestone: no-write plan and repeatable seed under mocked HTTP.
2. `src/lib/real-demo.ts`: shared `PaginationCatchUp`, `DemoSource`, `LinkReview` contracts; source decision and human relationship-review status are independent. `analysis.ts` reads immutable base/head files plus PR patch and actual thread; evidence-pattern rules expose uncertainty.
3. `server/real-demo/routes.ts` registered by `server/app.ts`: read-only catch-up with explicit live/sample mode and validated absence window. Existing provider contracts/endpoints remain intact. `server/config.ts` supports new target aliases for the legacy activity browser.
4. `src/PaginationDemo.tsx`, `src/App.tsx`, `src/styles.css`: same app shell, primary Catch me up → impact → Why did this change? → inspect/review/correct flow. Legacy `src/lib/demo.ts` activity fixtures now also use pagination.
5. `server/real-demo.test.ts`, `.env.example`, `.gitignore`, scripts, README and `docs/REAL_DATA_DEMO.md`: mocked integration, safety, idempotency, recovery, contract and regression verification plus operator guide.

**F1–F5:** F1 uses a configurable absence interval; F2 is a predefined, inspectable Leo/ProductList→GET /products mapping; F3 compares retrieved code/patch for the removed consumed field; F4 traces an ordered staged proposal/agreement/confirmation and actual PR reference; F5 exposes source links and independent confirm/reject/defer/correct/reopen controls. Mapping discovery and production task assignment remain out of scope. Review applies to the loaded result only; Remind Later is a local status, not a scheduled alert.

**Disclosed ASN03 deviation:** This increment uses deterministic, narrowly scoped evidence rules instead of an LLM and labels them accurately. The source records are real only after an explicitly approved seed and readback. Sample fallback uses the same pagination story and is separately labeled. Bot-created characters and weekdays are explicitly staged; remote timestamps/PR numbers are never fabricated. The baseline and breaking commits are published through GitHub's Git Database API on separate demo branches rather than modifying/deploying product code. ProductList is a minimal executable frontend consumer/view model. The PR stays open and deployment remains unverified.

**Validation:** Automated mocked-HTTP integration, rerun/recovery, provenance, human correction, guarded cleanup and executable baseline/head contract checks are included. `npm test` and `npm run build` passed during this increment; final counts and browser QA are reported in the completion message. Live remote seed/readback is pending credentials and explicit apply approval; no remote verification is claimed. No user evaluation was performed.

**Final local check:** 38 tests passed, production build passed, and `git diff --check` passed. Local Vite/Fastify servers started successfully. Visual browser QA could not run: no connected browser surface was available and Comet computer-use access was denied, including on retry after the user requested reconnection. No external seed/apply, cleanup, Git push, or model request was executed.

**Live preflight follow-up (2026-11-08):** Repository metadata and Slack channel/history reads succeeded, but GitHub default-ref access returned 403 (`contents=read` required). Strengthened credential validation to catch scoped PAT Contents access before any Slack post. No remote writes executed.

## Approved live pagination seed and verification (2026-11-08)

The user explicitly approved the configured isolated demo repository/channel and simulator apply command, while requiring separate approval before pushing to the InSync application repository. The simulator created two real Git commits/refs, one open unmerged PR and five clearly staged bot messages. A live Slack behavior caused initial verification to stop: the parent permalink gained thread query parameters after replies. Verification now compares the same origin/message path and preserves the current raw API permalink; cross-reference text uses a stable message URL. The stateful HTTP fake and regression test cover this transition. Recovery reused all existing resources.

Verified using real API readback and the running Vite→Fastify catch-up endpoint: complete backend before/after/patch and ProductList evidence, breaking totalPages mismatch, ordered proposal/agreement/DEC-14 confirmation, and an independent possible/unverified link. A seed rerun with a transport that refuses all writes completed with zero attempted writes; there remains one matching PR and five staged messages. Contract tests fetched from the actual GitHub commit SHAs pass on the baseline and fail on the head with ProductList requires totalPages. The default branch SHA still equals the baseline commit parent. Actual private IDs/permalinks are retained only in the ignored .demo manifest.

Validation: 41 tests passed, build passed. Chrome loaded the primary UI; screen capture then failed during button interaction, leaving full manual browser review pending. Cleanup was not applied (its dry-run and mocked ownership/recovery tests are available); the approved demo remains available for presentation. No InSync app push, remote merge, task mutation, or model inference was performed.

## Upstream integration (2026-11-08)

Fetched `origin/main` and fast-forwarded the active feature branch from `884886e` to `99ad059` (task/team views and Supabase-backed tasks). Preserved the full local pagination implementation in a recovery stash before the update, then restored it and resolved README, Fastify import, and App shell conflicts. The recovery stash is retained. `.env` and the private simulator manifest remained excluded throughout.

The merged shell retains upstream My work, Team activity, Supabase task loading, saved Light/Dark themes, and authenticated activity/task boundaries. Pagination demo is a separate default sidebar view, and its styles use the upstream palette variables. No upstream shared task/provider contract was removed. The live pagination endpoint is explicitly local-only (non-production and loopback HOST) so it cannot bypass production source grants. The offline pagination path remains available.

Verification: 47 tests passed, production build passed, no unresolved conflicts, and `git diff --check` passed. The live pagination route still returns the actual breaking ProductList impact, confirmed source DEC-14, and possible/unverified relationship. Anonymous general activity remains 403 and tasks remain 401 without identity. No remote records were modified during this update and no InSync push was performed.

## Human Slack Events API increment (2026-11-08)

User requested real-time human conversation collection and Slack simulation instructions. Existing F1/F2/F3 code remains: a predefined Leo/ProductList mapping, real demo PR/code, scoped absence window, evidence-rule impact. F4 previously read a manifest-recorded bot discussion; the new opt-in path discovers human thread IDs via Events API over Socket Mode and fetches their current source text on Catch me up. F5 keeps source decision/link review separate and invalidates review after observed updates. No new model or project/task writes are introduced.

Smallest independent milestone: `server/slack-events/collector.ts` validates workspace/channel, filters bots, deduplicates and stores bounded metadata without source bodies. `runtime.ts` uses the official @slack/socket-mode client, acknowledges envelopes immediately, sanitizes errors and manages lifecycle. Startup/close hooks are in `server/index.ts`; `AppProviders.slackEvents` injects the runtime without altering upstream task/activity authorization contracts. The local-only status route exposes metadata to `PaginationDemo` for its new human-thread selector.

`Simulator.verifyGitHub` separates real PR verification from seeded Slack ownership checks. `loadPagination` optionally reads an indexed human thread, excludes bot posts, and retrieves its code/PR independently. `PaginationCatchUp` adds optional source/thread/revision metadata; decisions use IDs extracted from explicit source text rather than forcing DEC-14. Evidence rules require an ordered proposal/agreement/confirmation and preserve uncertainty; a human source can introduce DEC-15. The known demo PR remains the GitHub target, and general PR/dependency discovery is not claimed.

New files: `server/slack-events/{collector,runtime}.ts`, `server/slack-events.test.ts`, and `docs/SLACK_EVENTS_DEMO.md`. Updated source analysis/routes/UI/shared contracts, official SDK dependency/lockfile, `.env.example`, README and architecture/runbook. Private xapp credentials are server-only; `.env` fields were added blank with collection disabled by default. Socket Mode requires the user to enable it, add message bot events and configure the app-level connections:write token. Live delivery has not been verified without that setup. No new Slack posts, app-setting writes, PR changes or InSync push were performed during implementation.

Disclosed limits: metadata is in memory, bounded and cleared at restart, with no pre-start backfill or complete delivery guarantee. No human source bodies are persisted to disk/Supabase. Analysis is user-initiated and deterministic, not model-generated. Detailed setup, real human post/reply text, expected decision states, edit/delete/supersede checks and troubleshooting are documented in SLACK_EVENTS_DEMO.md.

**Events increment validation:** 59 tests passed, build passed, and the running status endpoint correctly reports disabled without xapp configuration. Added a default Through current time control so fresh human posts are included without a stale page-load end timestamp. A real Socket Mode connection/human-post delivery test remains pending user setup.

## Live human-event verification (2026-11-08)

After the user saved the app-level token and requested testing, enabled the existing local event opt-in and triggered the API watcher reload. Socket Mode reported connected to the approved channel. The user manually posted the proposal and two replies from a real Slack account. The collector received all three events and indexed one thread at revision 3. The actual Vite→Fastify→GitHub/Slack catch-up returned HTTP 200 with human_events source, source decision DEC-15 confirmed, three inspectable Slack evidence references, breaking ProductList impact, and a separate possible/unverified link to the existing real pagination PR. Assertions for these live results passed. Human source text and identifiers remain outside versioned repository records. No Slack messages were sent by the agent, no PR was modified, and no InSync push was performed.

## Workspace-integrated pagination walkthrough (2026-11-09)

**Scope / repository audit.** Continued on `karthik/slack-events-integration` from `7aa1738` with a clean working tree. Read the four required docs, current routes/providers/task schema, UI and tests. The prior F1/F2 Supabase list was disconnected from analysis; F3/F4 used real readback but a fixed ProductList mapping on a separate Pagination demo page; F5 was owned by that page. General Team activity remained a separate sample feed. Live human DEC-15 had previously been verified, but event metadata was lost on restart. No production identity resolver exists.

**Milestone and contracts.** Connect the existing catch-up route to a member-owned task and effective source grants, then share its result/review across My work and Team activity. Affected boundaries: `server/real-demo/{access,routes,analysis,replay,task-setup,setup-cli,cli,api}.ts`, `server/{app,index}.ts`, `src/{App,TaskAnalysisDemo,PaginationDemo,ScenarioActivity,useWalkthrough}`, `src/lib/{real-demo,walkthrough}`, setup docs and tests. Existing task/provider/database schemas remain compatible; `taskStore.listUserSources` is optional for existing task-only consumers but mandatory for live scenario access. `/api/tasks` stays membership-scoped. No parallel shared-interface work was performed.

**Implemented behavior.** Removed the separate Pagination demo navigation and made My work the default while preserving the React/Vite shell and Light/Dark themes. My work selects a Supabase task, exposes its actual component/API/field mapping, and runs Catch me up → impact/code/evidence/actions → Why did this change? → relationship review. App owns selected task, retrieved result, source settings and review, so switching to Team activity preserves the same snapshot and outcome. Team activity shows the selected scenario’s evidence with actual actor IDs, timestamps, source links, GitHub/Slack filters and a return-to-task button. Separate legacy activity samples remain under an explicitly illustrative disclosure. Reset clears results, review and correction while retaining selection, replay and window settings; late fetch results are ignored after reset/task/source changes.

**Task-aware access and evidence.** Live catch-up requires `taskId`, a server-resolved local identity, member-owned assignment and explicit effective grants for both allowlisted sources before any provider read. Component `ProductList`, endpoint `GET /products`, and consumed field `totalPages` must match retrieved frontend/backend/patch evidence for a breaking impact claim. Missing or unrelated mappings return relevance uncertainty and the actual selected component. Task mapping and code have inspectable evidence IDs. Source decision status and user relationship review remain independent. Live remains disabled in production or on a public bind; this is not production authentication.

**Replay and one-time setup.** `demo:pin` performs read-only discovery/readback and saves identifiers and actual source event dates beside the private manifest as `.demo/<run>.replay.json`. The saved human parent can be fetched after a restart without any Socket Mode event. Human messages never enter simulator ownership or cleanup. `demo:setup-task` defaults to a no-write preview; an explicit exact target confirmation is required to apply a dedicated workspace, owner membership, ProductList assignment, predefined mapping and two source grants for a dashboard-created Auth user. Its transaction reuses unchanged demo rows, preserves unrelated data/preferences and rolls back ownership/content/target collisions. No Auth user is invented. `demo:verify` now reads task/membership/mapping/grants, channel/repository permissions, pinned human discussion, PR refs/lifecycle and contract evidence without remote writes. See `docs/WORKSPACE_DEMO.md` for setup and the classroom cycle.

**Truthfulness and limits.** F3/F4 continue to use labeled evidence-based rules, not an LLM. The pinned remote PR/human discussion are real platform records describing a staged scenario; the offline sample has its own explicitly simulated ProductList assignment and dates. A sample never silently replaces a failed live call or claims ownership of a selected real task. Source readback is a snapshot, and the feed’s real date filter is inclusive start/exclusive end; earlier discussion can be inspected as context in My work. Observed changes reset review, but missed events are not claimed to be synchronized. Review remains session-local, and Remind Later does not schedule alerts. Mapping editing, discovery and production sign-in remain unfinished. No code/tasks are automatically changed by analysis; no evaluation results are claimed.

**Validation in progress.** 68 automated tests passed after integration, including scoped access, task mappings, fresh-runtime pinned replay, date boundaries, missing/edited parent/confirmation, provider failures, repeatable transactional setup, collisions/rollback, correction/undo/reset and shared result logic. The production build passed. Read-only live pinning succeeded against the existing PR #1 and human DEC-15; the profile contains no human bodies. `demo:setup-task` preview succeeded. The connected database still had zero Auth users/tasks when checked; the user is completing Auth setup, so no database apply or fully assigned live verification is claimed yet. Browser navigation confirmed the two-view shell and expected missing-identity state; full interaction/theme QA is being completed where the available browser surface permits it. No InSync push, new PR/Slack post, merge, seed or cleanup was performed.

**Browser QA follow-up:** Chrome completed the explicit offline flow in both views. Verified the breaking impact, Why did this change?, Confirm, Reject, correction to an inspectable source, Undo/Reopen, Remind Later, Slack-only filtering, shared outcomes after switching views, and reset retaining the sample source/window. Light and Dark layouts were visually inspected at a narrow viewport. The expected live missing-identity state was visible. Full real-assignment UI verification remains dependent on the Auth/task setup described above; the UUID saved during this session did not exist in the configured database when checked.

**Final local verification for this increment:** 69 tests passed, production build passed and `git diff --check` passed. Setup also refuses an existing reserved workspace with no proven owner membership, rather than adopting it by name. No remote mutation was performed. Live pinning reused the existing human DEC-15/PR #1; the current database check still returns zero Auth users and the configured demo UUID does not exist there. Consequently the dedicated task/grants apply and the assigned live `demo:verify` remain pending the correct dashboard-created Auth user and explicit setup confirmation. Offline/manual UI QA above is complete; a fully assigned live browser walkthrough is not claimed.

## Authorized personal Supabase setup and completed live walkthrough (2026-11-09)

The user clarified that the earlier connection belonged to a teammate and configured a separate personal Supabase project. Read-only checks verified the project reference against its Session pooler connection, verified TLS, and found the selected existing Auth user in an otherwise empty application database. After a concrete preview, the user explicitly approved applying the two schema migrations and dedicated ProductList demo setup.

Applied the existing migrations in one transaction after rechecking the exact approved project/user and requiring an empty public schema. All ten application tables have row level security enabled. Created only the selected existing user's missing profile because that Auth user predates the new-user trigger. No Auth credentials or unrelated users were changed; the historical fixture `supabase/seed.sql` was not run. An ignored local receipt records migration filenames/hashes and the target project without source message bodies or credentials.

Applied `demo:setup-task` with its exact target confirmation and saved the dedicated workspace ID in local `.env`. Live readback confirms one member-owned ProductList task, `GET /products` consuming `totalPages`, and effective grants for the already approved GitHub repository and Slack channel. An additional live setup execution left every existing demo row unchanged and created no duplicates. The teammate's database was not changed.

`npm run db:check` and the full read-only `npm run demo:verify` both pass. The running Vite → Fastify → Supabase → GitHub/Slack path returns the actual assignment, PR #1 (open), human DEC-15 (source confirmed), breaking contract impact supported by mapping/code/patch IDs, three human messages with real actors/timestamps/permalinks, and a separate possible/unverified relationship. All referenced evidence IDs resolve. An unassigned task is rejected with 404, and a window outside the real events returns `inWindow: false`. The newly started listener had an empty discovery index, confirming that pinned replay does not need another human event after restart.

Chrome verified real task selection, live catch-up, inspectable code/API evidence, Why did this change?, source DEC-15, human relationship confirmation, Team activity sharing that confirmation, live Slack-only filtering, rejection and correction without changing source decision status. The earlier offline two-view/theme/reset walkthrough remains validated. Native browser automation occasionally returned stale snapshots or unavailable scroll frames; no application runtime error was present in the console. Final review/reset readiness and source settings are checked before handoff.

Validation: all 69 tests and the production build pass. GitHub/Slack remained read-only throughout this authorized database setup; no new messages, PRs, branches, push, merge, deployment or cleanup occurred. Analysis remains explicitly evidence-based rules, review is session-local, and production sign-in/mapping discovery/reminder scheduling remain outside this gallery increment.

**Final handoff checks:** Live relationship Undo/Reopen returned to pending while DEC-15 remained confirmed. Final database counts are one Auth user, one task, one dependency mapping and two source grants; the local demo workspace is configured. The private `.env`, replay profile and schema receipt are ignored, and the tracked diff contains no recognizable Slack/GitHub token patterns. Browser automation then failed with ScreenCaptureKit error `-3811` during the final live reset/readiness check. Live catch-up, both views, confirm/reject/correct/reopen and source filtering were observed; the inline reset and both appearances had already passed the earlier offline manual walkthrough and shared-state automated tests. No further live reset screenshot is claimed. The app remains running at `http://localhost:5173`; click Catch me up for a fresh visitor session. No push was made.
