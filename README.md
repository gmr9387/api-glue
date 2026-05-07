# api-unity-os

**Integrate any API once. Use it everywhere — a universal runtime engine for teams who are tired of rewriting the same Stripe/OpenAI/SendGrid glue in every project.**

[![CI](https://github.com/your-handle/api-unity-os/actions/workflows/ci.yml/badge.svg)](https://github.com/your-handle/api-unity-os/actions)
[![Coverage](https://codecov.io/gh/your-handle/api-unity-os/branch/main/graph/badge.svg)](https://codecov.io/gh/your-handle/api-unity-os)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./LICENSE)

[Docs](https://your-handle.github.io/api-unity-os) · [Changelog](./CHANGELOG.md) · [Open an Issue](https://github.com/your-handle/api-unity-os/issues)

---

![Hero — the API Unity OS dashboard on first load](./docs/assets/hero.png)

---

## The Problem

Every product team ends up writing the same integration code three times: once for Stripe, once for OpenAI, once for SendGrid — each with its own auth scheme, retry quirks, error shape, and secret-handling story. Credentials leak into frontends, retries get reinvented per service, and chaining a "charge → email receipt → log to CRM" flow means writing bespoke orchestration code that nobody wants to own. The friction isn't learning any one API; it's that there's no shared runtime for executing them.

---

## Solution

API Unity OS is a single execution layer for third-party APIs. You call `api.execute("service.action", data)` from anywhere in your app and a backend proxy handles auth, retries, error normalization, and audit logging. On top of that runtime sits a workflow engine that chains API calls together, passes data between steps with `{{N.output.field}}` interpolation, retries failed steps with exponential backoff, and records every run for replay. Natural-language prompts can generate workflows directly via an AI builder.

---

## Key Capabilities

| Capability                | What It Actually Does                                                              | Status    |
| ------------------------- | ---------------------------------------------------------------------------------- | --------- |
| **Unified Executor**      | One call shape for every connector; backend proxy injects secrets, never the client | `Stable`  |
| **Workflow Engine**       | Chain steps, interpolate prior outputs, retry with backoff, resume from failure    | `Stable`  |
| **AI Workflow Builder**   | Natural-language prompt → validated JSON workflow via Lovable AI                   | `Stable`  |
| **File I/O in Workflows** | Upload files as step inputs; reference them downstream as `{{N.output.fileUrl}}`   | `Stable`  |
| **Run History**           | Paginated, filterable history with full per-step input/output capture              | `Stable`  |
| **Mock Mode**             | Returns realistic mock data when backend keys are absent — zero-config demos       | `Stable`  |
| **Connector SDK**         | Drop-in adapter contract for adding new services                                   | `Beta`    |
| **Scheduled Workflows**   | Cron-style triggers for recurring runs                                             | `Planned` |

> `Stable` = production-ready · `Beta` = functional, API may shift · `Planned` = committed, not started

---

## Demo

![Workflow demo](./docs/assets/demo.gif)

*Caption: A 3-step workflow uploads an image, sends it to OpenAI Vision, then emails the result via SendGrid — built from a single natural-language prompt.*

---

## Architecture

```
┌──────────────┐    api.execute()    ┌────────────────────┐    HTTPS    ┌──────────────┐
│  React UI    │ ──────────────────▶ │  Edge Function     │ ──────────▶ │  Stripe      │
│  (Zustand)   │                     │  (execute-api)     │             │  OpenAI      │
│              │ ◀────────────────── │  • auth injection  │ ◀────────── │  SendGrid    │
└──────────────┘    normalized resp  │  • retries         │             │  Twilio      │
       │                             │  • normalization   │             └──────────────┘
       │                             │  • audit logging   │
       │                             └─────────┬──────────┘
       │                                       │
       │                                       ▼
       │                             ┌────────────────────┐
       └────────────────────────────▶│  Postgres (Cloud)  │
              workflows / runs /     │  RLS per user_id   │
              profiles / files       │  Storage buckets   │
                                     └────────────────────┘
```

📐 [Architecture deep-dive →](./docs/architecture.md)

**Decisions worth understanding before you fork or contribute:**

| Decision                                              | Why                                                                          | What I ruled out                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| All API calls proxied through one edge function       | Frontend never sees provider secrets; one place to enforce retries & logging | Per-service edge functions (sprawl), client-side SDK calls (leak) |
| Workflow context is a flat `{ [stepIndex]: result }`  | Trivial to interpolate `{{2.output.id}}`; resumable from any step            | DAG engine (overkill for the linear flows users actually build)   |
| Private Storage buckets + 7-day signed URLs           | Files reachable by downstream APIs without becoming public                   | Public buckets (security), per-request signing (latency)          |
| Roles in a separate `user_roles` table + `has_role()` | Prevents privilege-escalation via profile updates                            | `is_admin` column on `profiles` (classic footgun)                 |

> Full decision log: [`/docs/decisions`](./docs/decisions) — read this before proposing architectural changes.

---

## Stack

| Layer          | Choice                          | Why This, Not That                                                         |
| -------------- | ------------------------------- | -------------------------------------------------------------------------- |
| **UI**         | React 18 + TypeScript + Vite    | Fast HMR, mature ecosystem, no SSR complexity needed for a console app     |
| **Styling**    | Tailwind CSS + shadcn/ui        | Semantic tokens via CSS vars; no runtime CSS-in-JS overhead                |
| **State**      | Zustand + TanStack Query        | Zustand for ephemeral UI state, TanStack for server cache — no Redux bloat |
| **Backend**    | Supabase Edge Functions (Deno)  | Per-request isolation, secrets never reach the client                      |
| **Database**   | Postgres (Lovable Cloud)        | RLS gives per-user isolation without writing a permissions layer           |
| **Auth**       | Supabase Auth (email + Google)  | OAuth + JWT refresh out of the box                                         |
| **AI**         | Lovable AI Gateway (gemini/gpt) | No API key handling; whitelist-validated workflow generation               |
| **Testing**    | Vitest + Playwright             | Vitest for unit speed, Playwright for cross-browser e2e                    |
| **CI/CD**      | GitHub Actions                  | Native to where the code lives                                             |

> The "Why This, Not That" column is the most valuable part of any stack table.

---

## Getting Started

### Prerequisites

| Tool         | Version     | Install                                          |
| ------------ | ----------- | ------------------------------------------------ |
| Node.js      | `>= 20 LTS` | [nvm](https://github.com/nvm-sh/nvm) recommended |
| npm          | `>= 10`     | Bundled with Node 20                             |
| Supabase CLI | `>= 1.x`    | `npm i -g supabase`                              |

### Local Setup

```bash
git clone https://github.com/your-handle/api-unity-os.git
cd api-unity-os

npm ci
cp .env.example .env.local

# Lovable Cloud projects already have a hosted backend; skip the next two
# lines if you don't need a fully local stack.
supabase start
supabase db reset

npm run dev
```

Open `http://localhost:5173`. Without provider secrets configured, the executor returns mock data so you can build and demo end-to-end immediately.

> If something breaks on first run, check [Common Setup Issues →](./docs/troubleshooting.md) before opening an issue.

---

## Configuration

All config is environment-variable driven. No secrets in code, ever — provider keys live in the edge function's secret store, not in `.env` files shipped to the client.

| Variable                       | Required | Default       | Description                              |
| ------------------------------ | -------- | ------------- | ---------------------------------------- |
| `VITE_SUPABASE_URL`            | ✅        | —             | Lovable Cloud project URL                |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| ✅        | —             | Public anon key (safe in client)         |
| `STRIPE_SECRET_KEY`            | ❌        | —             | Backend-only; enables real Stripe calls  |
| `OPENAI_API_KEY`               | ❌        | —             | Backend-only; enables real OpenAI calls  |
| `SENDGRID_API_KEY`             | ❌        | —             | Backend-only; enables real SendGrid      |
| `TWILIO_AUTH_TOKEN`            | ❌        | —             | Backend-only; enables real Twilio        |
| `LOVABLE_API_KEY`              | ❌        | auto-injected | Lovable AI Gateway (workflow generation) |

Any backend secret left unset triggers mock mode for that connector — useful for demos and CI.

---

## Usage

### Minimal Example

```typescript
import { executeApi } from '@/services/apiClient';

const result = await executeApi('openai.generateText', {
  prompt: 'Summarize this changelog in one tweet',
});

console.log(result.data);
```

### Common Patterns

**Chaining steps in a workflow**

```typescript
// Step 0: openai.generateText  →  { text: "..." }
// Step 1: sendgrid.sendEmail
{
  to: 'ops@example.com',
  subject: 'Daily digest',
  body: '{{0.output.text}}',   // interpolated from step 0
}
```

**Generating a workflow from a prompt**

```typescript
const { workflow } = await supabase.functions.invoke('generate-workflow', {
  body: { prompt: 'When a Stripe charge succeeds, email the customer a receipt' },
});
```

📖 [Full API reference →](https://your-handle.github.io/api-unity-os/api)

---

## Deployment

| Environment    | URL                              | Trigger               |
| -------------- | -------------------------------- | --------------------- |
| **Production** | `https://your-app.com`           | Push to `main`        |
| **Preview**    | Auto-generated per Lovable build | Any change in editor  |

### Releasing

```bash
npm version patch   # or minor / major
git push --follow-tags
```

Follows [Semantic Versioning](https://semver.org). Every release has a [CHANGELOG](./CHANGELOG.md) entry — no silent deploys.

---

## Testing

```bash
npm run test              # Unit (Vitest)
npm run test:e2e          # End-to-end (Playwright)
npm run test:coverage     # Full suite + coverage report
```

**Coverage floors** — enforced in CI:

| Scope                          | Floor |
| ------------------------------ | ----- |
| Workflow engine & interpolator | ≥ 90% |
| Edge function handlers         | ≥ 85% |
| UI components                  | ≥ 70% |

---

## Security

**Do not open a public issue for vulnerabilities.**

Report privately: **your-email@domain.com**

Acknowledged within **24 hours**, resolution timeline within **72 hours**.

- All tables protected by Row-Level Security scoped to `auth.uid()`
- Roles stored in a dedicated `user_roles` table, gated by a `SECURITY DEFINER` `has_role()` function
- Storage buckets are private; downstream APIs receive short-lived signed URLs
- Provider secrets live only in the edge function runtime — never shipped to the client

Full policy: [SECURITY.md](./SECURITY.md)

---

## Roadmap

| Version  | What                                                | Status                |
| -------- | --------------------------------------------------- | --------------------- |
| **v1.1** | Scheduled workflows (cron triggers)                 | 🟡 In progress         |
| **v1.2** | Connector SDK + community connector registry        | 🔵 Planned             |
| **v2.0** | Branching workflows (conditionals, parallel fan-out)| 🔵 Planned — RFC open  |

---

## Contributing

1. **For significant changes** — open an issue first.
2. **Branch naming:** `feat/`, `fix/`, `chore/` prefixes
3. **Commits:** [Conventional Commits](https://www.conventionalcommits.org)
4. **Tests required** for any new connector or engine behavior

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before your first PR.

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

---

## License

Apache 2.0 © [Your Name](https://your-website.com)

See [LICENSE](./LICENSE) for full terms. Apache 2.0 was chosen over MIT for its explicit patent grant.

---

Made by your-handle

---

## Operational Context

API Unity OS is designed for environments where:

- a single failed API call shouldn't kill a multi-step business process
- auditability of every external call is non-negotiable
- workflows routinely cross 3+ third-party services
- operators need to explain *why* a run produced a given outcome
- interrupted runs must be resumable without re-charging customers or re-sending emails

## System Philosophy

This project prioritizes:

- **Deterministic workflows** over opaque automation — every run is replayable from its recorded context
- **Explainability** over magic — interpolation uses readable `{{N.output.field}}` paths, not hidden bindings
- **Operational visibility** over hidden state — every step's input, output, attempts, and duration is persisted
- **Composability** over lock-in — connectors share one contract; adding a new service is a single file
