// Runtime Health panel — surfaces the runtime-validate report in the operator
// console. Pure read-only; no mutations.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, AlertTriangle, AlertOctagon } from "lucide-react";

type Severity = "info" | "warn" | "error";
interface Check {
  id: string;
  severity: Severity;
  ok: boolean;
  count: number;
  message: string;
  sample?: unknown;
}
interface Report {
  checks: Check[];
  summary: { ok: number; info: number; warn: number; error: number };
}

const sevIcon = (s: Severity, ok: boolean) =>
  ok ? <ShieldCheck className="h-4 w-4 text-emerald-500" />
    : s === "error" ? <AlertOctagon className="h-4 w-4 text-red-500" />
    : <AlertTriangle className="h-4 w-4 text-amber-500" />;

export function RuntimeHealth() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("runtime-validate");
      if (!error && data) setReport(data as Report);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
    const iv = setInterval(fetchReport, 30_000);
    return () => clearInterval(iv);
  }, [fetchReport]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Runtime Health</CardTitle>
          {report && (
            <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-emerald-600 border-emerald-500/30">
                {report.summary.ok} ok
              </Badge>
              {report.summary.warn > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                  {report.summary.warn} warn
                </Badge>
              )}
              {report.summary.error > 0 && (
                <Badge variant="outline" className="text-red-600 border-red-500/30">
                  {report.summary.error} error
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={fetchReport} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {!report && <p className="text-xs text-muted-foreground">Loading runtime checks…</p>}
        {report?.checks.map((c) => (
          <div key={c.id} className="flex items-start gap-2 rounded-md border p-2 text-xs">
            {sevIcon(c.severity, c.ok)}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono">{c.id}</span>
                <span className="text-muted-foreground">{c.count >= 0 ? `${c.count} hit${c.count === 1 ? "" : "s"}` : "check failed"}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{c.message}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
