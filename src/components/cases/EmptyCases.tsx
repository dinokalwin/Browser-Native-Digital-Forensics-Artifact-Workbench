import { Link } from "react-router-dom";
import { FolderSearch, Shield, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Case Library empty state (Phase 5.10) — "Professional illustration" per
 * the ticket, built from this project's existing icon-in-circle visual
 * language (`EmptyState.tsx`, `MitreEmptyState.tsx`) rather than a new
 * image asset: a layered badge (a large `FolderSearch` behind a small
 * `Shield` accent badge, echoing this app's own DFIR/investigation
 * branding) instead of one bare centered icon, so the Case Library's
 * empty state reads as more deliberately designed than a generic
 * placeholder while staying dependency-free (no SVG illustration file to
 * ship or maintain).
 */
export function EmptyCases() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <div className="relative mb-5">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FolderSearch className="h-9 w-9" aria-hidden="true" />
        </span>
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <h2 className="text-lg font-medium text-foreground">Your investigations will appear here.</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Every case you analyze is saved to your local Case Library automatically — upload an EVTX file to start
        your first investigation.
      </p>
      <Button asChild className="mt-6 gap-1.5">
        <Link to="/">
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          Upload a case file
        </Link>
      </Button>
    </div>
  );
}
