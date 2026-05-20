# Onboarding

API Glue tracks workspace readiness through the `onboarding_steps` and
`onboarding_progress` tables. Each tenant has one row per step; completion is
recorded via `platform-control:complete_onboarding_step` with operator
authentication.

## Steps
1. **create_workspace** — tenant + operator membership exists.
2. **install_first_connector** — at least one row in `connector_installations`.
3. **install_first_template** — at least one row in `template_installs`.
4. **configure_webhook** — at least one active `webhook_endpoints` row.
5. **publish_first_version** — at least one `workflow_versions.state = published`.
6. **execute_first_run** — at least one `workflow_runs` row.
7. **inspect_replay** — open a completed run in the replay console.
8. **validate_deployment** — successful `deployment_validations` for the workspace.

## Behavior
- Steps are inferred from real runtime state, not self-reported claims.
- Completing a step is an operator action; the `runtime_audit_log` records it.
- Onboarding never blocks runtime execution; it only surfaces readiness.
