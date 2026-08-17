import { AlertTriangle, Trash2 } from "lucide-react";

import type { CaseMetadata } from "@/lib/cases/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteCaseDialogProps {
  caseMetadata: CaseMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
}

/**
 * Professional Delete confirmation (Phase 5.10) — a real "are you sure"
 * step (not an immediate delete-on-click from the card's dropdown) that
 * names the exact case being removed and is explicit about scope: this
 * only removes the Case Library *metadata* record. `lib/cases/storage.ts#deleteCase`
 * deliberately never touches that case's notes/bookmarks
 * (`lib/notes.ts`/`lib/bookmarks.ts` keep their own separate `localStorage`
 * keys), so the dialog says so rather than implying a full data wipe.
 */
export function DeleteCaseDialog({ caseMetadata, open, onOpenChange, onConfirm }: DeleteCaseDialogProps) {
  const handleConfirm = () => {
    if (!caseMetadata) return;
    onConfirm(caseMetadata.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {caseMetadata && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-severity-critical/10 text-severity-critical">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                </span>
                Delete Case
              </DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>

            <p className="text-sm text-foreground">
              Remove <span className="font-medium">&ldquo;{caseMetadata.name}&rdquo;</span> from your Case
              Library? This deletes its saved metadata only — investigator notes and bookmarks for this case are
              not affected.
            </p>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" className="gap-1.5" onClick={handleConfirm}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete Case
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
