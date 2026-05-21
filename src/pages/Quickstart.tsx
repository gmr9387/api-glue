import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Plug, Workflow, History, Activity, Layers, BookOpen, Rocket, ChevronRight } from "lucide-react";

type Counts = { connectors: number; definitions: number; runs: number; replays: number; incidents: number };

export default function Quickstart() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ connectors: 0, definitions: 0, runs: 0, replays: 0, incidents: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [c, d, r, rp, i] = await Promise.all([
        supabase.from("connector_installations").select("*", { count: "exact", head: true }),
        supabase.from("workflow_definitions").select("*", { count: "exact", head: true }),
        supabase.from("workflow_runs").select("*", { count: "exact", head: true }),
        supabase.from("workflow_events").select("*", { count: "exact", head: true }).eq("type", "replay.started"),
        supabase.from("workflow_runs").select("*", { count: "exact", head: true }).eq("status", "failed"),
      ]);
      if (!cancelled) {
        setCounts({
          connectors: c.count ?? 0, definitions: d.count ?? 0, runs: r.count ?? 0,
          replays: rp.count ?? 0, incidents: i.count ?? 0,
        });
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const steps = [
    { key: "connector", title: "Install a connector", desc: "Add a managed adapter (Stripe, OpenAI, SendGrid…) so workflows can call external APIs.", icon: Plug, link: "/platform", linkLabel: "Open marketplace", done: counts.connectors > 0 },
    { key: "workflow", title: "Author your first workflow", desc: "Open the Studio, drop in a connector node, wire dependencies, and publish v1.", icon: Workflow, link: "/studio", linkLabel: "Open Studio", done: counts.definitions > 0 },
    { key: "run", title: "Execute a run", desc: "Trigger your workflow from the Dashboard or via webhook ingress.", icon: Activity, link: "/", linkLabel: "Trigger from dashboard", done: counts.runs > 0 },
    { key: "inspect", title: "Inspect an execution", desc: "Open the Runtime Inspector to see step timing, retries, and checkpoints.", icon: History, link: "/inspector", linkLabel: "Open inspector", done: counts.runs > 0 },
    { key: "replay", title: "Replay from checkpoint", desc: "Re-run a terminal execution from any captured checkpoint to validate determinism.", icon: Layers, link: "/inspector", linkLabel: "Open inspector", done: counts.replays > 0 },
    { key: "incident", title: "Triage a failure", desc: "Use the Root cause tab to trace the first failing step and related events.", icon: Rocket, link: "/inspector", linkLabel: "Inspect incidents", done: counts.incidents > 0 },
  ];
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Quickstart"
        description="Six steps to take Valtaris Glue from cold-start to a verifiable, observable workflow execution."
        actions={<Button asChild variant="outline" size="sm"><Link to="/docs"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Platform docs</Link></Button>}
      />

      <Card>
        <CardHeader className="py-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" /> Onboarding progress
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">{completed}/{steps.length} · {pct}%</Badge>
        </CardHeader>
        <CardContent>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {steps.map((s, i) => (
          <Card key={s.key} className={s.done ? "border-success/40" : ""}>
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {s.done
                    ? <CheckCircle2 className="h-6 w-6 text-success" />
                    : <Circle className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">step {i + 1}</span>
                    <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="font-medium text-sm">{s.title}</h3>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-1">{s.desc}</p>
                </div>
                <Button asChild variant={s.done ? "outline" : "default"} size="sm">
                  <Link to={s.link}>{s.linkLabel}<ChevronRight className="h-3 w-3 ml-1" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && <div className="text-xs text-muted-foreground text-center">Reading workspace state…</div>}
    </div>
  );
}
