# InSync architecture

This describes the current implementation after integrating upstream commit `99ad059` with the real pagination demo. The simulator creates staged records on GitHub and Slack; the application retrieves and analyzes those real records. The explicit offline mode uses labeled samples.

## System diagram

```mermaid
flowchart TB
    USER["Developer / Leo"]

    subgraph UI["Frontend — React + TypeScript · Vite :5173"]
        APP["Application shell<br/>Pagination demo · My work · Team activity"]
        REVIEW["Human review<br/>Confirm · Reject · Correct · Reopen"]
        LOCAL["Local sample activity"]
    end

    subgraph SERVER["Backend — Node.js + Fastify :3001"]
        API["API routes"]
        PAG["Pagination catch-up service<br/>Absence window + source verification"]
        RULES["Evidence-based analysis<br/>API contract mismatch + decision provenance"]
        TASKS["Assigned-task service<br/>User/workspace membership checks"]
        SAMPLES["Legacy sample task routes"]
    end

    subgraph EXTERNAL["External services"]
        GH["GitHub API<br/>PRs · commits · diffs · source files"]
        SL["Slack API<br/>Proposal · agreement · confirmation"]
        DB[("Supabase / PostgreSQL<br/>Tasks · API mappings · memberships")]
    end

    subgraph SETUP["Demo setup — separate from normal app use"]
        CLI["Simulator CLI<br/>Dry-run → approved apply → verify"]
        MANIFEST[("Private local manifest<br/>Object IDs · URLs · timestamps")]
        ENV["Server-side .env<br/>Credentials + target allowlists"]
    end

    USER --> APP
    APP -->|"Requests through Vite /api proxy"| API
    APP --> REVIEW
    APP --> LOCAL

    API -->|"/api/real-demo/catch-up"| PAG
    API -->|"/api/tasks"| TASKS
    API -->|"/api/demo/*"| SAMPLES

    PAG <-->|"Read real evidence"| GH
    PAG <-->|"Read real thread"| SL
    PAG -->|"Resolve recorded objects"| MANIFEST
    PAG --> RULES
    RULES -->|"Impact, actions, sources and relationship"| APP

    TASKS <-->|"Scoped queries"| DB

    ENV --> PAG
    ENV --> CLI
    CLI -->|"Create branches, commits and PR"| GH
    CLI -->|"Post staged discussion"| SL
    CLI -->|"Checkpoint and recovery"| MANIFEST
```

## Connected workflows

Both interactions use the evidence returned by the catch-up request. “Why did this change?” expands the already-loaded provenance rather than issuing another model call.

```mermaid
flowchart LR
    A["Catch me up"] --> B["Retrieve PR, code and Slack thread"]
    B --> C["Detect totalPages removal"]
    C --> D["Identify ProductList as affected"]
    D --> E["Impact explanation + action plan"]
    E --> F["Why did this change?"]
    F --> G["Slack proposal → agreement → DEC-14 → PR"]
    G --> H["Human confirms, rejects or corrects the link"]
```

## Implementation boundaries

- Pagination analysis uses inspectable evidence rules, source links and uncertainty. It does not call OpenAI. The optional model engine in the legacy sample routes is separate.
- Source decision status and human link review are independent. DEC-14 can be confirmed while its relationship to a PR remains a possible match awaiting review.
- Supabase supplies assigned tasks and mappings in My work. Those assignments are not yet connected to the pagination analyzer, which uses the predefined Leo/ProductList mapping.
- Human review applies to the loaded result in browser state. It does not edit Slack, GitHub, source decision status or project tasks. Remind Later records a local deferral rather than scheduling a notification.
- Team activity currently displays samples. The separate human-thread mode uses an optional Socket Mode listener for approved-channel metadata discovery. Its general live endpoint requires authenticated ticket-board/source grants; the current server startup does not provide that resolver.
- The live pagination endpoint is restricted to non-production, loopback-bound demo use. Credentials stay on the server. Private simulator journals stay in the ignored `.demo/` directory.
- The simulator creates genuine remote objects with visibly staged content and simulated weekday labels. Platform IDs and timestamps remain real. It does not merge the PR or deploy the changed API.

## Code map

| Component | Files |
| --- | --- |
| App shell, navigation and themes | [src/App.tsx](../src/App.tsx), [src/palette.css](../src/palette.css) |
| Pagination interaction and human review | [src/PaginationDemo.tsx](../src/PaginationDemo.tsx), [src/lib/real-demo.ts](../src/lib/real-demo.ts) |
| Frontend API proxy | [vite.config.ts](../vite.config.ts) |
| Backend startup and routes | [server/index.ts](../server/index.ts), [server/app.ts](../server/app.ts), [server/real-demo/routes.ts](../server/real-demo/routes.ts) |
| Real source retrieval and analysis | [server/real-demo/api.ts](../server/real-demo/api.ts), [server/real-demo/analysis.ts](../server/real-demo/analysis.ts) |
| Simulator and recovery journal | [server/real-demo/cli.ts](../server/real-demo/cli.ts), [server/real-demo/simulator.ts](../server/real-demo/simulator.ts), [server/real-demo/manifest.ts](../server/real-demo/manifest.ts) |
| Supabase assigned tasks | [server/db/tasks.ts](../server/db/tasks.ts), [src/lib/tasks.ts](../src/lib/tasks.ts) |
| Setup and live walkthrough | [REAL_DATA_DEMO.md](REAL_DATA_DEMO.md) |

## Optional live human-thread collection

```mermaid
flowchart LR
    HUMAN["Human posts in approved channel"] --> SLACK["Slack Events API"]
    SLACK -->|"Socket Mode / xapp token"| LISTENER["Official Socket Mode client"]
    LISTENER -->|"acknowledge + scope + deduplicate"| INDEX["Bounded in-memory thread metadata"]
    INDEX -->|"metadata polling"| SELECTOR["Human thread selector"]
    SELECTOR -->|"Catch me up"| LOADER["Fetch full thread + known GitHub PR"]
    LOADER --> RULES["Evidence rules + independent human review"]
```

Source text is fetched on demand with the existing bot token. No human message bodies are persisted. The index clears on restart, does not backfill historical events, and is limited to the local demo. Setup and a step-by-step simulation are in [SLACK_EVENTS_DEMO.md](SLACK_EVENTS_DEMO.md).

Live verification: the Socket Mode path received three human messages in one thread on 2026-11-08. The running catch-up route resolved DEC-15 and ProductList impact while preserving the separate unverified relationship review.
