# Implementation Plan: Implement ASN-04 Demo Fixtures, Supabase Seeding, and F3/F4 API Handlers

**Track:** `asn04-demo-fixtures`  
**Target Milestone:** ASN-04 Demo Ready  
**Branch:** `codex/asn04-demo-fixtures`  
**Dependencies:** Fastify 5.x, Node.js Test Runner, PGlite, TypeScript 7.x  
**Status:** DRAFT (Awaiting User Approval)

---

## 1. Work Breakdown Structure

### Phase 1: Database Migration & Supabase Seeding (Feature F2)
- [ ] **Step 1.1: Database Migration (`supabase/migrations/20261106000001_tasks_schema.sql`)**
  - Add tables `public.tasks` and `public.task_api_dependencies`.
  - Add foreign key constraints to `public.workspaces` and `auth.users`.
  - Enable Row-Level Security (RLS) on both tables and revoke direct anon/authenticated access.
  - Verify zero external message/diff storage tables are created.
- [ ] **Step 1.2: Supabase Seed Script (`supabase/seed.sql`)**
  - Insert user "Sameer" (ID: `00000000-0000-4000-8000-000000000001`) with profile `display_name = 'Sameer'`.
  - Insert demo workspace "InSync Demo Workspace" and owner membership for Sameer.
  - Insert task "Build profile settings component" (`component: 'ProfileSettings'`, `status: 'in_progress'`) for user Sameer.
  - Insert API dependency mapping linking this task to `GET /users/id` with `used_fields: ['user_name']`.
- [ ] **Step 1.3: Database Seed Test (`server/db/seed.test.ts`)**
  - Use in-memory PGlite to execute `20261106000000_initial_schema.sql`, `20261106000001_tasks_schema.sql`, and `supabase/seed.sql`.
  - Validate query for Sameer's task and mapped endpoint.
  - Confirm table constraints and RLS flags.

### Phase 2: Deterministic Backend Fixtures
- [ ] **Step 2.1: Implement Source Data Fixtures (`server/fixtures/demoScenario.ts`)**
  - Export `demoPullRequest`: PR #18 "Update user profile API response" (open), diff removing `user_name` and adding `display_name`.
  - Export `demoSlackTruth`: Confirmed decision in `#backend-api` deprecating `user_name`.
  - Export `demoSlackTrap`: Unresolved proposal in `#backend-api` suggesting `email_verified` boolean.
  - Export typed helper queries for demo task and PR mappings.

### Phase 3: Fastify API Route Handlers (F3 & F4)
- [ ] **Step 3.1: Implement Demo Route Module (`server/routes/demo.ts`)**
  - Route `GET /api/demo/impact`:
    - Validates query param `taskId`. If missing or blank -> returns HTTP 400 with `"Limited task context: Please select an assigned task."`.
    - If `taskId` matches seeded task (e.g. `d0000000-0000-4000-8000-000000000001` or `"FE-12"` or `"task-sameer-profile"`) -> returns mock AI explanation and 3 recommended actions.
    - If `taskId` does not match -> returns HTTP 200 with `"impactUncertain": true` and empty recommended actions `[]`.
  - Route `GET /api/demo/decisions`:
    - Returns high-confidence confirmed link (Slack Truth ↔ GitHub PR).
    - Returns low-confidence trap link (Slack Trap ↔ GitHub PR, status `"Not a verified fact / Impact uncertain"`).
- [ ] **Step 3.2: Register Routes in `server/app.ts`**
  - Mount `/api/demo/impact` and `/api/demo/decisions`.
  - Keep route handlers modular and clean.

### Phase 4: Unit Testing & Verification
- [ ] **Step 4.1: API Integration Tests (`server/demo.test.ts`)**
  - Test missing `taskId` -> HTTP 400 with expected error string.
  - Test valid `taskId` -> HTTP 200 with explanation and 3 actions.
  - Test unknown `taskId` -> HTTP 200 with impact uncertain flag and empty actions array.
  - Test `GET /api/demo/decisions` -> returns both links with exact status and trap flag.
- [ ] **Step 4.2: Full Test Suite and TypeScript Build**
  - Run `npm test` across all server and frontend test suites.
  - Run `npm run build` to ensure zero compilation or type errors.

---

## 2. File Change Map

| Action | Path | Purpose |
|---|---|---|
| **Create** | `supabase/migrations/20261106000001_tasks_schema.sql` | Schema for tasks and task API dependencies |
| **Create** | `supabase/seed.sql` | Seed script for user Sameer, task, and API mapping |
| **Create** | `server/fixtures/demoScenario.ts` | Ground truth PR, Slack Truth, Slack Trap fixtures |
| **Create** | `server/routes/demo.ts` | Fastify route handlers for `/api/demo/impact` and `/api/demo/decisions` |
| **Modify** | `server/app.ts` | Register demo routes |
| **Create** | `server/demo.test.ts` | Test suite covering all edge cases and responses |
| **Create** | `server/db/seed.test.ts` | PGlite in-memory test for migration and seed script |
| **Modify** | `docs/IMPLEMENTATION_PLAN.md` | Log completed milestones and progress |

---

## 3. Reviewer Checklist & Acceptance Criteria

- [ ] User Sameer is seeded as default user with assigned task "Build profile settings component".
- [ ] Dependency mapping links task to endpoint `GET /users/id`.
- [ ] Zero database tables store external Slack messages or GitHub diffs.
- [ ] `GET /api/demo/impact` without `taskId` returns 400 `"Limited task context: Please select an assigned task."`.
- [ ] `GET /api/demo/impact?taskId=<valid>` returns the exact mock AI explanation and recommended actions.
- [ ] `GET /api/demo/impact?taskId=unknown` returns `impactUncertain: true` and empty recommended actions.
- [ ] `GET /api/demo/decisions` returns the confirmed truth link and the planted evaluation trap.
- [ ] All unit tests pass cleanly via `npm test`.
- [ ] TypeScript build passes cleanly via `npm run build`.
