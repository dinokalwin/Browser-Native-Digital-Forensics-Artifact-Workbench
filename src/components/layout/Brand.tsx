import { Link } from "react-router-dom";
import { ShieldHalf } from "lucide-react";

import { cn } from "@/lib/utils";

interface BrandProps {
  compact?: boolean;
  className?: string;
}

export function Brand({ compact = false, className }: BrandProps) {
  return (
    <Link
      to="/"
      className={cn(
        "flex items-center gap-2 font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <ShieldHalf className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-sm">DFIR Workbench</span>
          <span className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground">
            Artifact Analysis
          </span>
        </span>
      )}
    </Link>
  );
}
