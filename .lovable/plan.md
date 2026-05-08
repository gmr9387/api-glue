## Goal

Lift API Unity OS from "indie dark dashboard" to enterprise-grade product feel. Four pillars: design system, information architecture, page chrome, and an auth-ready shell (auth stays disabled).

## 1. Design system rebuild (tokens + themes)

Rewrite `src/index.css` and `tailwind.config.ts` around an enterprise neutral palette with full light + dark support.

- New semantic tokens: `--surface`, `--surface-2`, `--surface-3`, `--border-subtle`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`, plus status tokens (`--success`, `--warning`, `--danger`, `--info`).
- Primary shifts from neon green to a calmer enterprise blue (`221 83% 53%` light / `217 91% 60%` dark) — Linear/Vercel/Datadog register, not "hacker terminal".
- Add `:root.dark` variant; add a `ThemeProvider` (`src/components/theme-provider.tsx`) that reads `localStorage` + `prefers-color-scheme`, toggles `.dark` on `<html>`. Mount in `src/main.tsx`.
- Replace ad-hoc `glass-panel` with a real `Card`/`Panel` pattern using tokens; keep the class as a thin alias mapped to new tokens so existing pages don't break visually mid-migration.
- Typography: keep Space Grotesk for display, switch body to Inter (already common), tighten leading. Reserve JetBrains Mono for code/IDs only.
- Density: standardize on `text-sm` body / `text-xs` meta / `text-[11px]` chips. Standard paddings: page `px-8 py-6`, card `p-5`, table cells `px-4 py-2.5`.

## 2. Information architecture

New app shell in `src/components/shell/` with these primitives:

- `AppShell` — wraps sidebar + topbar + content; handles theme + cmd-k.
- `AppSidebar` (rewrite) — grouped sections:
  - **Build**: Dashboard, Connectors, Playground
  - **Automate**: Workflows, AI Builder, Runs (new placeholder route showing run history list pulled from `api_request_logs`)
  - **Account**: Profile, Settings (new placeholder)
  Collapsible groups, active branch stays open, mini-icon collapse mode preserved.
- `Topbar` (rewrite) — left: `SidebarTrigger` + `Breadcrumbs` (derived from route). Right: global search input (opens command palette), theme toggle, status indicator (connected APIs / success rate), `UserMenu`.
- `CommandPalette` (`cmdk` via shadcn `command.tsx`) — ⌘K opens; lists nav items, connectors, recent workflows, theme toggle, sign-in. Wired to react-router.
- `Breadcrumbs` — derives from `useLocation`; pages can override via a small `usePageMeta({ title, breadcrumbs })` hook.
- `UserMenu` — built around `useAuth()`; if `user` is null shows "Sign in" (link to `/auth`) + a faux "Local workspace" badge; if signed in shows avatar, email, role chip (reads from a `user_roles` view later), org switcher (single static "Personal" entry for now), Settings, Sign out. Auth stays disabled — the chrome is just ready.

## 3. Page chrome and shared components

Add `src/components/ui/` patterns used across pages:

- `PageHeader` — title, description slot, actions slot, optional tabs row.
- `StatCard` — icon, label, value, delta, trend; consistent across Dashboard + Hero.
- `StatusBadge` — semantic variants (success/warning/danger/info/neutral) replacing the ad-hoc colored pills.
- `EmptyState`, `LoadingState`, `ErrorState` — consistent zero/loading/error UX.
- `DataTable` wrapper around shadcn `Table` with sticky header, zebra rows, sort affordance, and a pagination footer — reused by Workflows runs, future Runs page, Activity log.

## 4. Page-by-page refresh (presentation only — no business logic changes)

- **Dashboard**: replace bespoke layout with `PageHeader` + 4 polished `StatCard`s (with tiny sparkline placeholder), Active Services as a real card with `StatusBadge`s, Recent Activity as `DataTable` with `EmptyState`.
- **Connectors**: `PageHeader` with "Connect API" CTA, grid of refined `ConnectorCard`s using new tokens; connected/disconnected use `StatusBadge`.
- **Playground**: split layout; left request builder card, right response viewer card; sticky header with method+endpoint summary.
- **Workflows**: `PageHeader` + tabs ("Editor" / "Runs"); runs panel uses new `DataTable` with the existing pagination already wired; chips for status; row click opens a side `Sheet` with full run detail.
- **AI Builder**: `PageHeader` + cleaner prompt card + generated workflow preview using consistent panels.
- **Profile**: card-based layout with sections (Account, Theme, Sessions); shows local-mode notice when unauthenticated.
- **NotFound**: centered enterprise empty state with link back to Dashboard.

## 5. Hero

Drop the `/` hero block (it duplicates the Dashboard). Hero stays as a component but is no longer rendered — Dashboard becomes the root surface.

## What stays untouched

- All Zustand store logic, edge functions, Supabase calls, RLS, retry/recovery code, workflow engine, executor proxy. This is purely shell + presentation.
- `AuthProvider` stays mounted; `/auth` route stays reachable; no protected routes added.
- No new tables, no new RLS, no migrations.

## Technical details

- New files: `src/components/theme-provider.tsx`, `src/components/shell/{AppShell,Topbar,Breadcrumbs,UserMenu,CommandPalette,ThemeToggle}.tsx`, `src/components/ui/{page-header,stat-card,status-badge,empty-state,data-table}.tsx`, `src/hooks/usePageMeta.ts`.
- Rewritten: `src/index.css`, `tailwind.config.ts`, `src/components/AppSidebar.tsx`, `src/components/Topbar.tsx`, `src/App.tsx` (mount ThemeProvider + CommandPalette), every page file (presentation only).
- Routes added: `/runs` (placeholder list), `/settings` (placeholder). Both render under the same shell.
- Verification: build runs clean, dark + light themes both render, ⌘K opens palette, sidebar collapses, breadcrumbs reflect route, no console errors at `/`, `/connectors`, `/workflows`, `/playground`, `/ai-builder`, `/profile`.

```text
┌─────────────────────────────────────────────────┐
│ Sidebar │ Topbar: ⌘ Breadcrumbs   ⌕  ☼  👤 ▾    │
│  Build  ├─────────────────────────────────────── │
│  Auto.  │ PageHeader: Title · Desc · [Actions]  │
│  Accnt. │ ─────────────────────────────────     │
│         │  Cards / Tables / Panels              │
└─────────────────────────────────────────────────┘
```

Approve and I'll execute end to end.