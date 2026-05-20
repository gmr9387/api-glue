# Deployment Guide

## Environments
API Glue uses `deployment_profiles` (development | staging | production) per
tenant. Each profile owns a set of `environment_configs` (key/value pairs and
optional secret references).

## Validation
`platform-control:validate_deployment` runs the following checks against live
runtime state and stores the result in `deployment_validations`:

| Check | Source |
|---|---|
| connectors.configured | `connector_installations` (enabled) |
| webhooks.registered   | `webhook_endpoints` (active) |
| workflows.defined     | `workflow_definitions` |
| breakers.healthy      | `connector_circuit_breakers.state != open` |
| workers.active        | `worker_registry.health_state = active` |

A validation is `passed`, `passed_with_warnings`, or `failed` based on per-check
severity. Failed checks block production rollouts at the operator's discretion;
the runtime does not auto-block.

## Audit
Every validation run appends an entry to `runtime_audit_log` with the actor,
profile, and aggregate result so deployment activity remains traceable.
