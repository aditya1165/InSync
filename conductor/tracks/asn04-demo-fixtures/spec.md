# Specification: Implement ASN-04 Demo Fixtures, Supabase Seeding, and F3/F4 API Handlers

**Track:** `asn04-demo-fixtures`  
**Target Milestone:** ASN-04 Live Station Demo & Peer Critique  
**Author / Data Owner:** Sameer Bharambe  
**Collaborators:** Karthik, Aditya, Jimin, Kelly, Astrid  
**Status:** DRAFT (Awaiting User Approval)

---

## 1. Executive Summary & Context

The **InSync** system is a collaborative awareness and coordination assistant tailored for frontend developers collaborating with backend teammates on full-stack projects. Frontend developers often miss asynchronous Slack discussions and GitHub PR changes, leading to broken component integrations or confusion between open proposals and settled team decisions.

For the **ASN-04 Design Gallery & Live Demo**, we are establishing a stable, deterministic, fixture-based backend that bypasses live external GitHub/Slack APIs and live OpenAI SDK calls. This eliminates external network latency, rate limits, and non-deterministic model hallucinations during live station evaluations.

### Key Constraints & Architecture Rules
1. **Default Authenticated User:** The default user for the demo environment is **"Sameer"**. All frontend task contexts, dependency mappings, and review queue defaults bind to this user identity.
2. **Strict Ephemeral Data Privacy Rule:** In accordance with the InSync architecture specification (ASN-03), **external message content (Slack messages, threads, GitHub diffs, PR bodies) is never stored persistently in Postgres**. Supabase stores only user profiles, workspaces, task mappings, and catch-up checkpoint metadata.
3. **Deterministic Planted Traps:** To support usability testing and cognitive walkthrough evaluations (evaluating whether reviewers notice unverified proposals masquerading as facts), the fixtures deliberately stage both a **ground-truth confirmed breaking change** and an **unresolved proposal trap**.

---

## 2. Feature Specifications

### 2.1 Feature F2: Task Dependency Mapping & Supabase Seeding

#### 2.1.1 Database Schema Additions (`public.tasks`, `public.task_api_dependencies`)
If missing from the current Postgres schema, create basic normalized tables strictly scoped to task-to-endpoint mappings:

```sql
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 255),
  component text not null check (length(trim(component)) between 1 and 120),
  status text not null check (status in ('todo', 'in_progress', 'done')) default 'in_progress',
  created_at timestamptz not null default now()
);

create table if not exists public.task_api_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  endpoint text not null check (length(trim(endpoint)) between 1 and 255),
  used_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
```

Security & Access Control:
- Enable Row-Level Security (RLS) on both tables.
- Revoke direct `anon` and `authenticated` access (Fastify server handles authorization via workspace membership check).

#### 2.1.2 Seed Dataset
- **User:** Seed user "Sameer" (with stable demo UUID `00000000-0000-4000-8000-000000000001` in `auth.users` and `public.profiles` with `display_name = 'Sameer'`).
- **Workspace:** Ensure demo workspace `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` ("InSync Demo Workspace") with Sameer as `owner`.
- **Task:** 
  - Task ID: `d0000000-0000-4000-8000-000000000001` (aliasable by `"FE-12"` or `"task-sameer-profile"`).
  - Title: `"Build profile settings component"`
  - Component: `"ProfileSettings"`
  - Status: `'in_progress'`
- **API Dependency Mapping:**
  - Endpoint: `"GET /users/id"` (and alias `"GET /users/:id"`)
  - Used Fields: `['user_name']`

*Constraint Verification:* No tables for Slack messages, Slack threads, GitHub diffs, or PR comments exist in Supabase.

---

### 2.2 Hardcoded Backend Fixtures (`server/fixtures/demoScenario.ts`)

A standalone Node.js fixture module encapsulating the demo scenario source entities:

#### 2.2.1 GitHub Pull Request (The Code Change)
- **ID:** `demo:github:pr:18`
- **Number:** `18`
- **Title:** `"Update user profile API response"`
- **Status / Lifecycle:** `"open"`
- **Endpoint:** `"GET /users/id"`
- **Diff:**
  ```diff
  @@ -1,4 +1,4 @@
   {
     "id": "123",
  -  "user_name": "string",
  +  "display_name": "string"
   }
  ```
- **Context:** An open PR proposing a breaking field rename (`user_name` -> `display_name`) on endpoint `GET /users/id`.

#### 2.2.2 Slack Thread 1: The Confirmed Decision (The Ground Truth)
- **ID:** `demo:slack:thread:truth`
- **Channel:** `"#backend-api"`
- **Decision Status:** `"confirmed"`
- **Author:** `"Backend Lead"`
- **Message:** `"Decision: We are officially deprecating user_name. Use display_name in the profile API response moving forward."`
- **Link Confidence:** `"high"`
- **Relationship:** Direct, verified confirmation of the rationale behind PR #18.

#### 2.2.3 Slack Thread 2: The Evaluation Trap (Unresolved Proposal)
- **ID:** `demo:slack:thread:trap`
- **Channel:** `"#backend-api"`
- **Decision Status:** `"unresolved"` (or `"proposal"`)
- **Author:** `"Product Teammate"`
- **Message:** `"Should we consider adding an email_verified boolean to the profile response next week?"`
- **Link Confidence:** `"low"`
- **Status Label:** `"Not a verified fact / Impact uncertain"`
- **Planted Evaluation Trap:** Designed to test if the developer or reviewer notices that an undecided Slack question is not an approved change or PR-backed decision.

---

### 2.3 Fastify API Routes

#### 2.3.1 Route `GET /api/demo/impact` (Feature F3: Task-Aware AI Impact Explanation)

- **Query Parameters:**
  - `taskId` (string, required)

- **Response Scenarios:**
  1. **Success (Known Task ID matching seeded Sameer task):**
     - HTTP Status: `200 OK`
     - Response Body:
       ```json
       {
         "taskId": "d0000000-0000-4000-8000-000000000001",
         "taskTitle": "Build profile settings component",
         "component": "ProfileSettings",
         "status": "impact_detected",
         "uncertainty": false,
         "explanation": "The response field user_name is replaced by display_name. This may affect the profile component data mapping.",
         "recommendedActions": [
           "Update API call mapping",
           "Check response fields",
           "Run integration check"
         ],
         "pr": {
           "id": "demo:github:pr:18",
           "number": 18,
           "title": "Update user profile API response",
           "status": "open",
           "endpoint": "GET /users/id",
           "diff": "@@ -1,4 +1,4 @@\n {\n   \"id\": \"123\",\n-  \"user_name\": \"string\",\n+  \"display_name\": \"string\"\n }"
         },
         "evidenceIds": [
           "demo:mapping:profile-settings",
           "demo:github:pr:18"
         ],
         "generatedBy": "scripted_demo"
       }
       ```

  2. **Error: Missing `taskId`:**
     - Condition: Query param `taskId` is missing, empty, or whitespace.
     - HTTP Status: `400 Bad Request`
     - Response Body:
       ```json
       {
         "error": "Limited task context: Please select an assigned task."
       }
       ```

  3. **Fallback: Unknown / Unmapped `taskId`:**
     - Condition: `taskId` provided does not match seeded tasks.
     - HTTP Status: `200 OK`
     - Response Body:
       ```json
       {
         "taskId": "unknown-task-id",
         "status": "uncertain",
         "impactUncertain": true,
         "uncertainty": true,
         "explanation": "Impact uncertain: No known API dependency mapping found for this task.",
         "recommendedActions": [],
         "evidenceIds": [],
         "generatedBy": "scripted_demo"
       }
       ```

#### 2.3.2 Route `GET /api/demo/decisions` (Feature F4: Decision-to-PR Connection)

- **Query Parameters:** None required (supports optional `taskId` or `prId` filter).
- **HTTP Status:** `200 OK`
- **Response Body:**
  ```json
  {
    "generatedBy": "scripted_demo",
    "decisions": [
      {
        "id": "dec-link-1",
        "decisionId": "demo:slack:thread:truth",
        "prId": "demo:github:pr:18",
        "channel": "#backend-api",
        "slackMessage": "Decision: We are officially deprecating user_name. Use display_name in the profile API response moving forward.",
        "prTitle": "Update user profile API response",
        "confidence": "high",
        "decisionStatus": "confirmed",
        "linkStatus": "confirmed",
        "statusLabel": "Confirmed",
        "matchRationale": "The Slack decision explicitly states deprecation of user_name and adoption of display_name, matching the breaking diff in PR #18.",
        "evidenceIds": [
          "demo:github:pr:18",
          "demo:slack:thread:truth"
        ],
        "isTrap": false
      },
      {
        "id": "dec-link-2",
        "decisionId": "demo:slack:thread:trap",
        "prId": "demo:github:pr:18",
        "channel": "#backend-api",
        "slackMessage": "Should we consider adding an email_verified boolean to the profile response next week?",
        "prTitle": "Update user profile API response",
        "confidence": "low",
        "decisionStatus": "unresolved",
        "linkStatus": "uncertain",
        "statusLabel": "Not a verified fact / Impact uncertain",
        "matchRationale": "Unresolved proposal regarding email_verified boolean; not verified against the current profile PR diff.",
        "evidenceIds": [
          "demo:github:pr:18",
          "demo:slack:thread:trap"
        ],
        "isTrap": true
      }
    ]
  }
  ```

---

## 3. Edge Cases & Fallback Handling Matrix

| Scenario / Edge Case | Condition | Expected System Behavior |
|---|---|---|
| **Missing `taskId` in F3** | `GET /api/demo/impact` without `?taskId=` | Returns HTTP `400` with message `"Limited task context: Please select an assigned task."` |
| **Unknown `taskId` in F3** | `GET /api/demo/impact?taskId=invalid-id` | Returns HTTP `200` with `impactUncertain: true` and empty `recommendedActions: []`. |
| **Evaluation Trap in F4** | Reviewing `dec-link-2` | Returns status `"Not a verified fact / Impact uncertain"`, `confidence: "low"`, preventing unverified proposal from posing as confirmed decision. |
| **Data Privacy Enforced** | Database Inspection | Verify 0 tables store external Slack or GitHub bodies; only foreign IDs and metadata exist. |
| **Data Truncation Simulation** | Large or partial diff payloads | The fixture provides clean chunked JSON diff payloads conforming to React component schema requirements. |

---

## 4. Verification & Testing Strategy

1. **Automated Unit Tests with Node Test Runner (`node:test`):**
   - Fastify route tests (`server/demo.test.ts`):
     - Assert 400 when `taskId` is missing.
     - Assert 200 with mock explanation and 3 actions when `taskId` matches Sameer's profile task.
     - Assert 200 with `impactUncertain: true` and empty actions when `taskId` is unknown.
     - Assert 200 on `GET /api/demo/decisions` returning confirmed match and low-confidence trap match.
2. **Database Schema & Seed Verification (`server/db/seed.test.ts`):**
   - Run PGlite in-memory Postgres to execute migrations and seed script.
   - Verify task for Sameer exists with `"Build profile settings component"` and dependency to `"GET /users/id"`.
   - Verify that no tables exist storing raw Slack or GitHub content.
3. **Build and Type Check:**
   - Execute `npm test` and `npm run build` to confirm strict TypeScript compliance.
