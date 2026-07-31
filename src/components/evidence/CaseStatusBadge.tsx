import { Loader2, CheckCircle2, AlertCircle, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { LoadStatus } from "@/types/evidence";

const STATUS_CONFIG: Record<
  LoadStatus,
  {
    label: string;
    icon: typeof Loader2;
    variant: "outline" | "warning" | "success" | "destructive";
  }
> = {
  idle: { label: "No case loaded", icon: CircleDashed, variant: "outline" },
  parsing: { label: "Parsing events", icon: Loader2, variant: "warning" },
  analyzing: { label: "Analyzing", icon: Loader2, variant: "warning" },
  ready: { label: "Case ready", icon: CheckCircle2, variant: "success" },
  error: { label: "Processing failed", icon: AlertCircle, variant: "destructive" },
};

export function CaseStatusBadge({ status }: { status: LoadStatus }) {
  const config = STATUS_CONFIG[status];
  const isSpinning = status === "parsing" || status === "analyzing";

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <config.icon className={isSpinning ? "h-3 w-3 animate-spin" : "h-3 w-3"} aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
