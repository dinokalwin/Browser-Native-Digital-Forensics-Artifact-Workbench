import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import type { EventLevel } from "@/types/evidence";

const LEVEL_VARIANT: Record<EventLevel, NonNullable<BadgeProps["variant"]>> = {
  Critical: "critical",
  Error: "critical",
  Warning: "warning",
  Information: "secondary",
  Verbose: "outline",
};

export function LevelBadge({ level }: { level: EventLevel }) {
  return (
    <Badge variant={LEVEL_VARIANT[level]} className="whitespace-nowrap">
      {level}
    </Badge>
  );
}
