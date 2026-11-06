# InSync: Project Specification (ASN03 Source of Truth)

**Project:** Collaborative Awareness & Coordination Assistant (current repository name: InSync)

**Class:** USC CSCI 599, Intelligent User Interactions, Fall 2026

**Source:** Team submission `ASN - 03.pdf`, pages 1–9.

**Status:** This document describes the **planned design**, not a claim that the code already implements it.

## 1. Users, context, problem
Target users are student frontend developers on small full-stack teams where different teammates build backend APIs. Collaboration happens through Slack and GitHub. Due to parallel work and missed activity, frontend developers may overlook backend changes, struggle to determine whether their current component is affected, or mistake an open proposal for a final decision.

ASN03 narrows the design space to **task-specific API changes**, rather than generic team-wide summaries. The assistant should connect evidence to a developer's assigned task, describe possible effects, and suggest **verifiable** actions.

## 2. Prioritized user needs
- **N1:** Concise, personalized catch-up on missed activity.
- **N2:** Distinguish confirmed decisions from proposals and unresolved discussions.
- **N3:** Connect discussions and code/project changes to personal responsibilities and next actions.

## 3. Mandatory ASN04 minimum viable set
| ID | Feature | Planned behavior | User need | Priority |
|---|---|---|---|---|
| F1 | Task-Based Catch-Up | Select an assigned frontend task, retrieve relevant recent changes, avoid unrelated activity. | N1, N3 | Must |
| F2 | Task Dependency Mapping | Maintain basic, editable frontend-component ↔ backend-API mappings. Predefined mapping is acceptable for initial prototype. | N3 | Must |
| F3 | AI Impact Explanation | Analyze a relevant GitHub PR/diff to explain possible effect on selected component and suggest a next action. | N1, N3 | Must |
| F4 | Decision-to-PR Connection | Suggest links between confirmed Slack decisions and relevant GitHub PRs, showing decision status and evidence. Label unresolved or weak candidates as unverified. | N2, N3 | Must |
| F5 | Evidence and User Controls | Inspect source evidence and uncertainty, Confirm / Not Relevant / Remind Later AI suggestions; user retains final decision. | N2, N3 | Must |

**Beyond ASN04 MVS:** F6 proactive PR impact notification (Should), F7 automatic dependency discovery (Should), F8 extra tools including Docs/transcripts (Could). **F9 automatic code repair without approval (Won't).** Do not expand scope by default.

## 4. Exactly two centerpiece intelligent interactions
### Interaction 1: Task-aware code-change impact explanation
1. Developer selects assigned frontend task (F1).
2. System checks component ↔ API mapping (F2).
3. System finds a potentially relevant GitHub PR and examines its content/diff.
4. AI **suggests** a potential impact on this particular component and next actions (F3).
5. Developer reviews evidence/uncertainty and responds (F5).

**Expected behavior:** Distinguish additive changes from breaking/removal changes; distinguish open PR from merged/deployed change; if linkage/impact is uncertain, show uncertainty and original source instead of declaring a break.

### Interaction 2: AI-suggested decision-to-PR linking
1. System displays a Slack discussion/decision possibly related to a PR.
2. AI suggests a relationship and provides evidence from both sources (F4).
3. System distinguishes proposal, unresolved, and verified/confirmed states; an AI suggestion is not itself confirmation.
4. Developer reviews sources, then confirms, rejects as irrelevant, or postpones (F5).

**Expected behavior:** Do not turn an undecided Slack proposal into a settled team decision. If insufficient evidence, show "Possible match – not verified."

## 5. Detailed failure and fallback behavior from ASN03
| Feature | Uncertainty/fallback |
|---|---|
| F1 | "Limited task context" / "Relevance uncertain"; allow manual inspection of updates or another task. |
| F2 | "Dependency not verified"; allow editing or removing mapping. |
| F3 | Mark AI explanation as suggestion; "Impact uncertain" when evidence lacking; link original PR; no automatic code modification. |
| F4 | "Possible match – not verified"; unresolved discussions must not appear final; user can reject and inspect Slack/PR. |
| F5 | Unavailable sources remain unresolved; undo/reopen/remind-later where supported; review does not automatically change code or project tasks. |

## 6. Proposed architecture from ASN03
- **UI:** React frontend based on existing high-fidelity mockups (ASN03 appendix, pp. 7–9).
- **Reasoning:** OpenAI API for PR comprehension and Slack/PR relevance; a rule-based component/API relationship filter for known dependencies.
- **Backend:** Node.js or Python orchestration layer. Restrict prompts to relevant diff and Slack thread to control latency and inference cost.
- **Data:** GitHub REST API for PR diffs/metadata; Slack Web API for channel conversations. For live access, scoped read-only access to approved sources, sensitive text redaction, and no persistent storage of private source content were proposed in ASN03.
- **Demo:** A representative backend API change affecting an assigned frontend component; more advanced integrations are outside the essential MVS.

The submitted plan describes intended architecture, not verified implementation. Any OAuth design, retention promise, and redaction claim needs actual code before being presented as achieved.

## 7. Risks to address in the interface
- **Hallucination:** AI may invent impact or link the wrong PR. Show sources, uncertainty, and user verification.
- **Latency:** PR, Slack, and model calls may be slow. Limit context, provide explicit status, cache where appropriate, and graceful fallback.
- **Insufficient data:** Vague PR, inaccessible Slack message, truncated diff. Mark relevance uncertain.
- **Automation bias:** Don't preselect acceptance or let suggestions automatically mutate code/tasks.
- **Sensitive data:** Never leak private code, credentials, or Slack conversations to unapproved services.
- **Decision-status confusion:** Human verification is required before treating suggested connections as validated.

## 8. ASN03's evaluation proposal vs ASN04 obligation
ASN03 Section 6 proposed cognitive walkthrough, heuristic evaluation, and think-aloud usability sessions with five student frontend developers. Those are **team-proposed formative checks**, potentially useful later, **not separately enumerated as required items in the ASN04 official peer-scoring checklist**. Do not fabricate evaluation outcomes.

## 9. Non-goals and success definition
The goal is not a generic Slack digest or a production-scale ingestion system. A successful ASN04 prototype makes both specified interactions clear and hands-on, shows actual progress, and communicates what is simulated versus implemented. Preserve task relevance, evidence, decision status, and explicit user control.
