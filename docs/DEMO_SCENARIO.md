# Proposed ASN04 Demo Scenario and Data Contract

> **STATUS: PROPOSAL, NOT TEAM-APPROVED FINAL DATA.** Karthik and Sameer own the definitive scenario and fixtures. The following is a development starter to unblock the app; replace/reconcile with their delivered dataset before gallery day.

## 1. Short motivating story
Alex is implementing a **Profile Settings** frontend component. While focused elsewhere, Alex misses Slack and GitHub updates. A backend teammate opens a PR to change the user-profile response. Alex needs to know **what is actually proposed, whether Alex's task is affected, what action to take, and whether the team agreed to the change**.

## 2. Important correction from actual initial repository fixtures
The repository snapshot's PR #18 says **add** `display_name` while **retaining** `user_name`, and it is **open**. That is **not yet a shipped breaking rename**. Do not claim it broke the frontend. The proposal below intentionally reuses this more accurate state unless the data team creates a different, explicitly breaking, merged PR example.

## 3. Proposed fixture bundle
### Frontend task (one required)
```json
{
  "id": "FE-12",
  "title": "Build Profile Settings component",
  "component": "ProfileSettings",
  "backendDependencies": ["GET /users/:id"],
  "currentFieldUsage": ["user_name"],
  "status": "in_progress"
}
```

### Relevant GitHub PR
```json
{
  "id": "PR-18",
  "number": 18,
  "title": "Add display_name to profile response",
  "status": "open",
  "merged": false,
  "endpoint": "GET /users/:id",
  "before": {"id": 123, "user_name": "alex"},
  "afterProposed": {"id": 123, "user_name": "alex", "display_name": "Alex"},
  "description": "Proposed additive response field; migration/removal plan is not approved."
}
```

### Slack discussion
```json
{
  "id": "SLACK-PROFILE-1",
  "channel": "backend-api",
  "text": "Could we add display_name? Frontend still reads user_name. Let's check compatibility before deciding whether to remove the old field.",
  "decisionStatus": "unresolved"
}
```

### Distraction / irrelevant activity
A products-pagination draft PR and related Slack thread, unconnected to ProfileSettings, for testing task relevance. The initial repository already includes such fixtures.

## 4. Expected outputs, not predetermined claims of live AI
**Interaction 1 (F3):**
- Related task: `FE-12` through dependency `GET /users/:id`.
- Impact: the open PR **adds** `display_name`; existing `user_name` remains. No confirmed immediate break.
- Suggested next actions: inspect PR diff, verify intended migration with backend, review field usage, plan follow-up only if the contract changes.
- Evidence: `PR-18`, frontend dependency `FE-12`, relevant issue/review if available.
- Uncertainty: whether/when `user_name` will be removed is not settled.

**Interaction 2 (F4):**
- Candidate match: `SLACK-PROFILE-1` ↔ `PR-18`.
- Link status: **suggested/unverified** until developer confirms.
- Decision status: **unresolved/proposed**, not confirmed.
- Evidence: inspect both Slack conversation and GitHub PR; reject the link if unsupported.

**F5 controls:** `Confirm`, `Not Relevant`, and `Remind Later` on suggested review items. Confirmation of a **link** must not silently convert an unresolved **team decision** into a confirmed one.

## 5. Recommended minimal contracts (proposed, change with teammates)
```ts
type DecisionStatus = 'proposed' | 'unresolved' | 'confirmed' | 'unknown';
type ReviewStatus = 'pending' | 'confirmed' | 'not_relevant' | 'remind_later';
type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

type FrontendTask = {
  id: string;
  title: string;
  component: string;
  backendDependencies: string[];
};

type EvidenceRef = {
  id: string;
  source: 'slack' | 'github' | 'task_mapping';
  title: string;
  url?: string;
};

type ImpactSuggestion = {
  id: string;
  taskId: string;
  prId: string;
  potentialImpact: string;
  suggestedActions: string[];
  confidence: ConfidenceLevel;
  evidenceIds: string[];
  reviewStatus: ReviewStatus;
  generatedBy: 'scripted_demo' | 'llm';
};

type DecisionLinkSuggestion = {
  id: string;
  prId: string;
  slackMessageIds: string[];
  rationale: string;
  decisionStatus: DecisionStatus;
  confidence: ConfidenceLevel;
  evidenceIds: string[];
  reviewStatus: ReviewStatus;
  generatedBy: 'scripted_demo' | 'llm';
};
```

These are *suggested interfaces*, not structures required verbatim by ASN03. Review existing `Activity`/`Insight` contracts before adding duplicate models.

## 6. Data team handoff checklist
- [ ] Agree on **one** representative main story, task, endpoint, PR, Slack thread.
- [ ] Supply actual textual PR diff, not just a title, if F3 will analyze code.
- [ ] Include valid and invalid/uncertain relationships to illustrate discernment.
- [ ] Clearly specify open/merged/deployed status and proposed/confirmed decision state.
- [ ] Provide ground-truth expected impacts and **source references** for each claim.
- [ ] Supply mock source URLs or local detail panels for offline demonstration.
- [ ] Freeze a fixture version early enough for QA; record later revisions.

## 7. Repeatable gallery path
Choose task → Catch up → Inspect potential API impact and its PR diff → Check recommended action/evidence → Inspect Slack↔PR link suggestion and decision status → Confirm / Not Relevant / Remind Later → Reset for next visitor.
