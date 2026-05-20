# Workflow Templates

## Model
- `workflow_templates` — identity, category, tags, install count.
- `template_versions` — immutable DAG snapshots (draft|published|archived).
- `template_installs` — per-tenant clones tied to the source version.

## Lifecycle
1. A template version is authored as `draft`, then promoted to `published`.
2. Installing a published version creates a `template_installs` row and a
   tenant-owned workflow definition seeded from the template graph.
3. Subsequent template versions do not mutate existing installs — operators
   upgrade explicitly, preserving replay safety for in-flight runs.

## Safety guarantees
- Published versions are immutable (enforced by the same `protect_published_version` trigger pattern used in `workflow_versions`).
- Installs preserve governance policies declared in the template version.
- Replay continues to use the version the run was pinned to, not the latest install.

## Categories
Payments · Customer Support · AI Governance · Logistics · Notifications ·
Onboarding · Incident Response · Scheduling.
