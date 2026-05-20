# Governance Guide

API Glue governance combines:

- **Operator identity** (`tenant_members`, `operator_role`) — every operator-facing edge function validates the JWT via `_shared/auth.ts:requireUser`.
- **Tenant isolation** (`has_tenant_access`, `has_operator_role`) — RLS policies on every tenant-scoped table enforce membership and role.
- **Governance policies** (`governance_policies`, `ai_decision_trace`) — confidence thresholds and auto-reject bounds for AI-driven steps.
- **SLA enforcement** (`sla_policies`, `sla_breaches`) — runtime sweeper writes breaches; operators see them in the SLA panel.
- **Approvals** (`workflow_approvals`) — human-in-the-loop gates with escalation.
- **Audit** (`runtime_audit_log`, `security_events`) — every operator action records actor, subject, and detail.

## Phase 18 additions
- Template installs and connector installs append `runtime_audit_log` entries.
- Deployment validations record actor + result for auditability.
- Onboarding completion is operator-attributed.

Governance integrity is preserved across template installation and pack import —
imported workflows carry their declared governance policies forward.
