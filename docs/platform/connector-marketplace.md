# Connector Marketplace

## Model
- `connector_catalog` — discoverable connectors with category and auth model.
- `connector_versions` — versioned releases with release notes.
- `connector_capabilities` — typed trigger/action surface with input/output schemas and rate limits.
- `connector_installations` — per-tenant, enabled/disabled, with config jsonb.

## Behavior
- Catalog rows are readable by any authenticated user; installations are tenant-scoped.
- Installing a connector is an operator action and is audited in `runtime_audit_log`.
- Connector adapters remain the runtime contract (see `connector-adapters.md`); the marketplace is the discovery and configuration layer.

## Upgrades
- Versions are auditable; an installation pin to a specific `connector_version_id` makes upgrades explicit and reversible.
