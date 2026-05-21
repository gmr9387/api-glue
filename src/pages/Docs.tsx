import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { BookOpen, GitBranch, Layers, Network, RotateCcw, ShieldCheck, Workflow, Activity } from "lucide-react";

type Section = {
  key: string; title: string; icon: React.ComponentType<{ className?: string }>;
  group: "Runtime" | "Execution" | "Governance";
  body: { heading: string; text: string; code?: string }[];
};

const SECTIONS: Section[] = [
  {
    key: "architecture", title: "Runtime architecture", icon: Network, group: "Runtime",
    body: [
      { heading: "Tenancy boundary", text: "Every artifact — workflow definitions, runs, checkpoints, events, connector installations — is scoped by tenant_id with Postgres RLS. Operator identity is resolved per request from the authenticated session and authorized against tenant_members." },
      { heading: "Control vs data plane", text: "The control plane (Studio, platform-control, workflow-publish) mutates definitions, versions, deployments. The data plane (run-worker, webhook-ingress, scheduler-tick, event-trigger-router) executes pinned versions and emits events. The two never share mutation pathways." },
      { heading: "Pinned execution", text: "Runs carry workflow_version_id. Workers must read graph topology from the pinned version, never from the latest draft. This guarantees in-flight runs survive new publishes." },
    ],
  },
  {
    key: "lifecycle", title: "Workflow lifecycle", icon: Workflow, group: "Runtime",
    body: [
      { heading: "States", text: "draft → published → archived | deprecated. Only draft is mutable; published versions are protected by trigger and immutable for graph changes." },
      { heading: "Publish gate", text: "validate_workflow_version performs cycle detection, orphan/unreachable analysis, connector schema validation, and approver presence on gate nodes. A version with errors cannot be published." },
      { heading: "Rollback", text: "Rollback re-points workflow_published_versions at any prior version. The old DAG snapshot is fetched from workflow_versions — no schema replay is required." },
    ],
  },
  {
    key: "execution", title: "Execution engine", icon: Activity, group: "Execution",
    body: [
      { heading: "Queueing", text: "Jobs are enqueued per dag_node_id with idempotency keys (run_id:node_id). Workers lease jobs with renew_job_lease; orphaned leases auto-expire so another worker can pick them up." },
      { heading: "Retries", text: "Each connector node carries a retry policy (max, backoff_ms). Failures feed record_connector_result, which feeds the circuit breaker state machine (closed → open → half_open)." },
      { heading: "Parallel + branch", text: "Parallel nodes fan out into N child jobs joined on completion. Branch nodes evaluate conditions and dispatch only the selected outbound edges." },
    ],
  },
  {
    key: "replay", title: "Replay semantics", icon: RotateCcw, group: "Execution",
    body: [
      { heading: "Checkpoints", text: "Workers persist workflow_checkpoints at structural boundaries (after each step, before approvals, before destructive connectors). Each checkpoint captures step_index, decision context, and connector ack ids." },
      { heading: "Replay dispatch", text: "replay-workflow takes a source_run_id and optional from_checkpoint. It clones the source's pinned workflow_version_id so the replay graph is identical to the original — even if a newer version is now live." },
      { heading: "Forensic guarantees", text: "Replays emit replay.started / replay.completed events linked to the source run. Side-effects on flagged connectors run in shadow mode unless explicitly authorized." },
    ],
  },
  {
    key: "checkpoint", title: "Checkpoint model", icon: Layers, group: "Execution",
    body: [
      { heading: "What's stored", text: "Step index, deterministic input hash, decision context (branch conditions, approval state), connector idempotency keys, and a structural snapshot of in-flight job state." },
      { heading: "What's NOT stored", text: "External system state. Checkpoints are not transactional across third-party APIs — replays assume connectors are idempotent or explicitly compensated by a rollback node." },
    ],
  },
  {
    key: "queue", title: "Queue model", icon: GitBranch, group: "Execution",
    body: [
      { heading: "Pressure signals", text: "capture_queue_pressure computes (queued + 1.5*running + 0.5*dead_letter) / max(fleet, 1) per minute. Scores above 5 emit scale_up recommendations; below 1.2 emit scale_down." },
      { heading: "Aging", text: "Jobs older than their workflow's SLA budget surface in IncidentFeed and trigger SLA breach events for the run." },
      { heading: "Dead letter", text: "Permanent failures (retries exhausted, breaker open) move to dead_letter with the originating event and the last error frame, available for manual replay." },
    ],
  },
  {
    key: "governance", title: "Governance + approvals", icon: ShieldCheck, group: "Governance",
    body: [
      { heading: "Approval gates", text: "Approval nodes pause the run and create a tenant-scoped approval request. Decisions are signed by an authenticated operator; approval-decision validates the operator's role via has_role before resuming." },
      { heading: "Audit", text: "All control-plane mutations and approval decisions are recorded in security_events with the operator identity, the original payload, and the resulting state transition." },
      { heading: "Replay safety", text: "Approval gates re-trigger on replay unless the original decision is reused via decision_id — preventing silent privilege escalation through replay." },
    ],
  },
];

const ICONS_BY_GROUP = {
  Runtime: Network,
  Execution: Activity,
  Governance: ShieldCheck,
} as const;

export default function Docs() {
  const [active, setActive] = useState<string>(SECTIONS[0].key);
  const current = SECTIONS.find((s) => s.key === active) ?? SECTIONS[0];

  return (
    <div className="px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-5">
      <PageHeader
        title="Platform documentation"
        description="Runtime semantics, execution model, and governance behavior — written against the deployed implementation, not marketing material."
      />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-3">
          <CardHeader className="py-3">
            <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Contents
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {(["Runtime", "Execution", "Governance"] as const).map((group) => {
              const GroupIcon = ICONS_BY_GROUP[group];
              return (
                <div key={group} className="mb-3">
                  <div className="flex items-center gap-1.5 px-2 mb-1">
                    <GroupIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{group}</span>
                  </div>
                  {SECTIONS.filter((s) => s.group === group).map((s) => {
                    const sel = s.key === active;
                    return (
                      <button key={s.key} onClick={() => setActive(s.key)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 ${sel ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent/50 text-foreground/80"}`}>
                        <s.icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.title}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="col-span-9">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <current.icon className="h-4 w-4 text-primary" />
                {current.title}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">{current.group}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[640px] pr-3">
              <div className="space-y-5">
                {current.body.map((b, i) => (
                  <section key={i} className="space-y-1.5">
                    <h3 className="text-[13px] font-semibold text-foreground">{b.heading}</h3>
                    <p className="text-[12px] text-foreground/80 leading-relaxed">{b.text}</p>
                    {b.code && (
                      <pre className="text-[11px] font-mono bg-muted/40 border border-border/50 rounded p-2 overflow-auto">{b.code}</pre>
                    )}
                  </section>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
