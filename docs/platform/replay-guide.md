# Replay Guide

## Determinism contract
Every run is pinned to a `workflow_version_id`. Replay uses that version's
graph, not the latest published version. Connector adapters are invoked with
the original step inputs from `workflow_step_runs.payload`, and outputs are
compared against the recorded `connector_response` where available.

## Replay-safe operations across Phase 18
- **Template installs** create new workflow definitions; they never modify the
  graph of an existing run.
- **Pack imports** create new versions; in-flight runs continue against their
  pinned version.
- **Connector upgrades** require an explicit installation update; existing runs
  reference the connector version captured at execution time via the trace
  span attributes.

## Operator UX
- Replay console reads from `workflow_checkpoints` and `workflow_step_runs`.
- Bookmarks (`operator_bookmarks` with `kind = 'replay'`) let operators save
  investigation entry points per tenant.

## Limitations
- External API side effects are not rolled back by replay; replay validates
  determinism and surfaces drift, it does not undo writes.
- Connector mocks (used when secrets are absent) produce deterministic outputs
  so replay remains meaningful in dev environments.
