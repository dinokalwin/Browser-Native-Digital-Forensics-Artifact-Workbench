import * as React from "react";
import { Pencil } from "lucide-react";

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
import { Input } from "@/components/ui/input";

interface RenameCaseDialogProps {
  /** The case being renamed, or `null` when the dialog is closed — kept
   * showing its last value while the close animation plays, the same
   * convention `EventDetailsDrawer`/`MitreFindingDrawer` already use for
   * their own `selected*` props. */
  caseMetadata: CaseMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string, name: string) => void;
}

/**
 * Professional Rename dialog (Phase 5.10). Controlled, centered modal
 * (`ui/dialog.tsx`) rather than the Sheet-based drawers this app uses for
 * detail panels — a rename is a single quick action, not a workspace to
 * scroll through, so a small centered dialog is the right weight for it.
 *
 * Renaming only ever changes `CaseMetadata.name` — `id` (the stable join
 * key notes/bookmarks/reopen all resolve through) is never touched, per
 * `CaseMetadata`'s own doc comment.
 */
export function RenameCaseDialog({ caseMetadata, open, onOpenChange, onConfirm }: RenameCaseDialogProps) {
  const [name, setName] = React.useState(caseMetadata?.name ?? "");

  // Reset the draft text to the case's current name every time a
  // *different* case's rename dialog opens, rather than remembering
  // whatever the previous case's draft was — same render-time "adjust
  // state" pattern (react.dev/learn/you-might-not-need-an-effect) this
  // codebase already uses throughout (e.g. `MitreFindingDrawer.tsx`'s
  // tab reset) instead of a `useEffect` + `setState`.
  const [lastCaseId, setLastCaseId] = React.useState(caseMetadata?.id ?? null);
  if ((caseMetadata?.id ?? null) !== lastCaseId) {
    setLastCaseId(caseMetadata?.id ?? null);
    setName(caseMetadata?.name ?? "");
  }

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseMetadata || !isValid) return;
    onConfirm(caseMetadata.id, trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {caseMetadata && (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" aria-hidden="true" />
                Rename Case
              </DialogTitle>
              <DialogDescription>Choose a new display name for this case.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5 py-4">
              <label htmlFor="rename-case-input" className="text-xs font-medium text-muted-foreground">
                Case name
              </label>
              {/* No `autoFocus` here (jsx-a11y/no-autofocus) — Radix's
                  `Dialog.Content` already moves focus into the dialog on
                  open via its own focus trap, so a manual autoFocus would
                  be both redundant and the exact thing that lint rule
                  flags. */}
              <Input
                id="rename-case-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                aria-invalid={!isValid}
                aria-describedby={!isValid ? "rename-case-error" : undefined}
              />
              {!isValid && (
                <p id="rename-case-error" className="text-xs text-severity-critical">
                  Case name can&apos;t be empty.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid}>
                Save Name
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
