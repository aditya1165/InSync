# InSync Agent Instructions

Read this file before modifying the repository. This is a collaborative USC CSCI 599 Intelligent User Interactions (IUI) class project. **Do not treat the current demo application as the full product specification.**

## Reading order
1. `docs/PROJECT_SPEC.md`: source-derived ASN03 product specification and scope.
2. `docs/ASN04_REQUIREMENTS.md`: instructor's ASN04 assessment and demo requirements.
3. `docs/DEMO_SCENARIO.md`: proposed demonstration dataset and its assumptions, subject to team confirmation.
4. `docs/IMPLEMENTATION_PLAN.md`: repository snapshot, gaps, ownership, work plan, and acceptance tests.
5. Existing `README.md`, `package.json`, `src/lib/*`, `src/App.tsx`, tests, and git history.

## Core mission
Build an **interactive, task-aware** collaborative awareness assistant for student frontend developers working with backend teammates. The ASN04 minimum viable set is **F1–F5**, and it must clearly demonstrate **two intelligent interactions**:
1. Task-aware GitHub code-change impact explanation (F3).
2. AI-suggested Slack decision-to-GitHub PR connection (F4).
F1 task selection, F2 dependency mapping, and F5 evidence/user controls support those interactions.

## Engineering rules
- **Inspect before editing.** Check `git status`, active branch, dependencies, current behavior, and tests. Do not overwrite others' work. Ask before touching uncertain shared interfaces.
- **Work in a feature branch.** Prefer small changes and PRs. Agree on shared contracts before parallel implementation.
- **Preserve working code and design.** Extend the existing React/TypeScript/Vite app, do not rewrite it to a new framework without agreement.
- **Demo truthfulness is non-negotiable.** Label scripted data/outputs as sample or simulated. Never represent a prompt template, fixture, heuristic, or hard-coded insight as live AI. Do not label a proposed or unmerged change as deployed, nor an unresolved conversation as a confirmed decision.
- **Evidence first.** Every generated claim about a PR, task impact, or decision link should refer to inspectable source IDs. Missing evidence must yield uncertainty rather than invented certainty.
- **Human in control.** Do not automatically edit project code/tasks. Support Confirm, Not Relevant, Remind Later, and appropriate recovery/undo if implemented.
- **Secrets and privacy.** Never expose OpenAI, GitHub, or Slack tokens in client-side code, committed files, screenshots, or logs. Use server-side env vars. For live integrations, restrict access to approved demo repositories/channels and minimize transmitted content.
- **Make a reliable gallery demo first.** Provide a fallback with labeled fixtures if network or model calls fail. Avoid adding F6–F9 until both core interactions work end-to-end.
- **Test as you go.** Run `npm test` and `npm run build` (when the existing scripts remain valid), test both interaction flows manually, and document any known limitations.
- **Do not silently change the brief.** If the prototype deviates from ASN03, record the reason in `docs/IMPLEMENTATION_PLAN.md` and disclose it during the demonstration.
- **Do not invent results.** UX evaluations are proposed in ASN03 but are not separate mandatory ASN04 checklist items; do not claim they were performed without evidence.

## Team roles (agreed for ASN04)
- **Prototype Development:** Aditya and Jimin. Implement and integrate F1–F5 and both interactions.
- **Demo Scenario & Data:** Karthik and Sameer. Provide realistic, internally consistent task/PR/API/Slack fixtures and expected AI results.
- **Demo Presentation & QA:** Kelly and Astrid. Prepare motivating scenario, problem framing, short presentation, hands-on demo flow, and QA.
- **Everyone:** Visit and review the other four demo stations, submit individual peer-review scores/comments as instructed.

**Individual development responsibilities: TBD.** Aditya and Jimin share Prototype Development. Ownership of F1–F5, both intelligent interactions, and integration remains open until they agree on the division of work.

## Start-of-session checklist for a coding agent
1. Read the four docs listed above and repository code.
2. Summarize current state vs F1–F5 and actual vs simulated behavior.
3. Identify the smallest next independently testable milestone; list affected files and dependencies.
4. Agree on or document shared API/data contracts together.
5. Implement only the scoped change, test, and update `docs/IMPLEMENTATION_PLAN.md` with verified progress.

## Reference priority
For the assignment: ASN04 instructor PDF > our interpretations. For the promised product scope: submitted ASN03 PDF > proposed examples in these notes. For current implementation: actual repository code > this dated snapshot.
