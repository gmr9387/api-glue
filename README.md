# API Unity OS

**A universal runtime that lets you call Stripe, OpenAI, SendGrid, and Twilio through one shape — and chain them into saved, replayable workflows.**

[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

---

## Authorship

API Unity OS is a solo-developer project. Every architectural decision, data model, workflow primitive, and product call in this repo is mine. AI tooling was used as an accelerator during implementation — scaffolding, boilerplate, and pair-programming on specific files — but the system, its scope, and its direction are not generated output. This is my brainchild; the AI was a faster keyboard, not the architect.

---

## The Problem

Wiring up Stripe, OpenAI, SendGrid, and Twilio in the same app means four different auth schemes, four different error shapes, four different retry stories — and credentials sprinkled across the frontend if you're not careful. Chaining them into a "charge → email receipt → log result" flow usually means writing one-off orchestration code that nobody wants to maintain.

---

## Solution

API Unity OS exposes a single call shape — `api.execute("service.action", data)` — that routes every request through a backend edge function. The edge function injects credentials, runs the call, and returns a normalized response. On top of that runtime sits a workflow engine that chains calls, interpolates prior outputs with `{{N.output.field}}` syntax, retries failed steps with exponential backoff, and persists every run for inspection. Workflows can be hand-built or generated from a natural-language prompt.

---

## Key Capabilities

| Capability                | What It Does                                                                            | Status   |
| ------------------------- | --------------------------------------------------------------------------------------- | -------- |
| **Unified Executor**      | One call shape for all connectors; backend proxy holds the secrets                      | `Stable` |
| **Mock Mode**             | When a provider key isn't set, returns realistic mock data so the app still works       | `Stable` |
| **Workflow Engine**       | Linear step-by-step runner with `{{N.output.x}}` interpolation                          | `Stable` |
| **Retry & Resume**        | Per-step `maxRetries` + exponential backoff; resume a failed run from the failed step   | `Stable` |
| **File I/O in Workflows** | Upload a file as a step input; reference it downstream as `{{N.output.fileUrl}}`        | `Stable` |
| **Run History**           | Paginated history with status filter; full per-step input/output captured on expand     | `Stable` |
| **AI Workflow Builder**   | Natural-language prompt → JSON workflow, validated against a service/action whitelist   | `Stable` |
| **Auth & Profiles**       | Email/password + Google OAuth, editable display name and avatar                         | `Stable` |

> `Stable` = working today in this codebase. Anything not listed here isn't built.

---

## Architecture

```
┌──────────────┐    api.execute()    ┌────────────────────┐    HTTPS    ┌──────────────┐
│  React UI    │ ──────────────────▶ │  Edge Function     │ ──────────▶ │  Stripe      │
│  (Zustand)   │                     │  (execute-api)     │             │  OpenAI      │
│              │ ◀────────────────── │  • secret injection│ ◀────────── │  SendGrid    │
└──────────────┘   normalized resp   │  • mock fallback   │             │  Twilio      │
       │                             │  • normalization   │             └──────────────┘
       │                             └─────────┬──────────┘
       │                                       │ writes
       ▼                                       ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase (managed)                                │
│  • api_requests / saved_workflows / workflow_runs        │
│  • profiles / user_roles                                 │
│  • Storage: avatars, workflow-files (private + signed)   │
│  • RLS scoped to auth.uid() on every table               │
└──────────────────────────────────────────────────────────┘
```

A second edge function, `generate-workflow`, calls the a managed AI gateway to turn prompts into workflow JSON.

**Decisions worth understanding:**

| Decision                                              | Why                                                                       | What was ruled out                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| All API calls proxied through one edge function       | Frontend never sees provider secrets; one place for retries & logging     | Per-service edge functions; client-side SDK calls   |
| Workflow context is a flat `{ [stepIndex]: result }`  | Trivial `{{2.output.id}}` interpolation; resumable from any step          | DAG engine — overkill for the linear flows built    |
| Private Storage buckets + 7-day signed URLs           | Files reachable by downstream APIs without becoming public                | Public buckets; per-request signing                 |
| Roles in a separate `user_roles` table + `has_role()` | Prevents privilege escalation via profile updates                         | `is_admin` column on `profiles`                     |
| Mock mode when keys missing                           | App is fully demoable without provisioning real provider accounts         | Hard-failing on missing keys                        |

---

## Stack

| Layer        | Choice                          | Notes                                                                      |
| ------------ | ------------------------------- | -------------------------------------------------------------------------- |
| **UI**       | React 18 + TypeScript + Vite    | Console app — no SSR needed                                                |
| **Styling**  | Tailwind CSS + shadcn/ui        | Semantic HSL tokens via CSS variables                                      |
| **State**    | Zustand + TanStack React Query  | Zustand for UI/runtime state, React Query for server cache                 |
| **Backend**  | Supabase Edge Functions (Deno)  | `execute-api` and `generate-workflow`                                      |
| **Database** | Postgres (Supabase)        | RLS on every user-owned table                                              |
| **Auth**     | Supabase Auth (email + Google)  | JWT with auto-refresh                                                      |
| **AI**       | Managed AI gateway              | Used by `generate-workflow`; no API key handling required                  |
| **Testing**  | Vitest                          | Unit tests only — no e2e suite in this repo                                |

---

## Getting Started

### Prerequisites

| Tool     | Version     |
| -------- | ----------- |
| Node.js  | `>= 20 LTS` |
| npm      | `>= 10`     |

### Local Setup

```bash
git clone https://github.com/your-handle/api-unity-os.git
cd api-unity-os
npm ci
npm run dev
```

Open `http://localhost:5173`. The project is wired to a hosted Supabase backend out of the box; no local Supabase setup is required. Without provider secrets configured on the backend, the executor returns mock data so the UI is fully usable for demos.

---

## Configuration

Frontend env vars (auto-managed by Supabase, in `.env`):

| Variable                        | Purpose                          |
| ------------------------------- | -------------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon key (safe in client) |
| `VITE_SUPABASE_PROJECT_ID`      | Project identifier               |

Backend secrets (set in Supabase, **never** in client code). Any secret left unset triggers mock mode for that connector:

| Secret               | Enables                  |
| -------------------- | ------------------------ |
| `STRIPE_SECRET_KEY`  | Real Stripe calls        |
| `OPENAI_API_KEY`     | Real OpenAI calls        |
| `SENDGRID_API_KEY`   | Real SendGrid calls      |
| `TWILIO_AUTH_TOKEN`  | Real Twilio calls        |
| `LOVABLE_API_KEY`    | AI workflow generation (auto-injected) |

---

## Usage

### Direct call

```typescript
import { executeApi } from '@/services/apiClient';

const result = await executeApi('openai.generateText', {
  prompt: 'Summarize this changelog in one tweet',
});

console.log(result.data);
```

### Chaining steps in a workflow

```jsonc
// Step 0: openai.generateText  →  result.data = { text: "..." }
// Step 1: sendgrid.sendEmail
{
  "to": "ops@example.com",
  "subject": "Daily digest",
  "body": "{{0.output.text}}"
}
```

### Generating a workflow from a prompt

```typescript
import { supabase } from '@/integrations/supabase/client';

const { data } = await supabase.functions.invoke('generate-workflow', {
  body: { prompt: 'When a Stripe charge succeeds, email the customer a receipt' },
});
```

---

## Testing

```bash
npm run test        # Vitest, single run
npm run test:watch  # Vitest, watch mode
```

There is one example unit test at `src/test/example.test.ts`. No e2e or coverage gates are configured.

---

## Security

- Every user-owned table has Row-Level Security scoped to `auth.uid()`.
- Roles live in a separate `user_roles` table, gated by a `SECURITY DEFINER` `has_role()` function — never on `profiles`.
- Storage buckets (`avatars`, `workflow-files`) are private; downstream APIs receive 7-day signed URLs.
- Provider secrets only exist inside the edge function runtime; the frontend never sees them.

For vulnerabilities, please contact the maintainer privately rather than opening a public issue.

---

## What's Not Built (Yet)

To keep this README honest:

- No scheduled / cron-triggered workflows
- No branching, conditionals, or parallel fan-out in the workflow engine (linear only)
- No webhook endpoints for inbound events
- No public connector SDK — adding a new service means editing `execute-api`
- No CI pipeline, no Playwright e2e suite, no published changelog
- No rate limiting beyond what the underlying providers enforce

---

## License

Apache 2.0 — see [LICENSE](./LICENSE).

---

## Operational Context

API Unity OS is built for situations where:

- a single failed API call shouldn't kill a multi-step process
- every external call needs to be auditable after the fact
- workflows routinely cross multiple third-party services
- runs need to be inspectable and resumable, not opaque

## System Philosophy

- **Deterministic workflows** — every run is recorded with inputs, outputs, attempts, and duration
- **Explainability** — interpolation uses readable `{{N.output.field}}` paths, not hidden bindings
- **Operational visibility** — run history is first-class, not an afterthought
- **No client-side secrets** — non-negotiable
