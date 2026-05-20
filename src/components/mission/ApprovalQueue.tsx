import { useEffect } from "react";
import { useApprovals } from "@/store/useApprovals";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Clock, XCircle, CheckCircle2 } from "lucide-react";

export function ApprovalQueue() {
  const { approvals, hydrate, subscribe, decide } = useApprovals();

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  const pending = approvals.filter((a) => a.state === "pending");
  const recent = approvals.filter((a) => a.state !== "pending").slice(0, 6);

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Approval Queue</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {pending.length} pending
        </Badge>
      </div>

      {pending.length === 0 && recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">No approvals required.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono truncate">{a.dag_node_id ?? "step"}</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  run {a.run_id.slice(0, 8)} · expires {a.expires_at ? new Date(a.expires_at).toLocaleTimeString() : "—"}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => decide(a.id, "approve")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => decide(a.id, "reject", "operator reject")}>
                  Reject
                </Button>
              </div>
            </div>
          ))}

          {recent.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-md px-3 py-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 truncate">
                {a.state === "approved" && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                {a.state === "rejected" && <XCircle className="h-3 w-3 text-destructive" />}
                {a.state === "expired" && <Clock className="h-3 w-3 text-amber-500" />}
                <span className="font-mono truncate">{a.dag_node_id}</span>
              </div>
              <span className="text-[10px]">{a.decided_by ?? "system"} · {a.state}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
