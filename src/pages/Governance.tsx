import { PageHeader } from "@/components/ui/page-header";
import { GovernancePanel } from "@/components/mission/GovernancePanel";

export default function Governance() {
  return (
    <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="AI Governance"
        description="Policy thresholds, escalation rules, model routing log and human override actions for every AI decision."
      />
      <GovernancePanel />
    </div>
  );
}
