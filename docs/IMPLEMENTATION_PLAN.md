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
