import * as React from "react";
import { NotebookPen, Trash2 } from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCaseNote, useNotesStore, useEnsureCaseNotesLoaded } from "@/store/notesStore";

export interface CaseNotesPanelProps {
  /** Uploaded file name — the key notes are namespaced under (see lib/notes.ts). */
  caseId: string | null;
}

const AUTO_SAVE_DEBOUNCE_MS = 500;

/**
 * Investigation-wide notes, separate from any single event (see
 * EventNoteSection.tsx for per-event notes, rendered inside the Event
 * Details Drawer instead). Auto-saves to localStorage as the investigator
 * types — deliberately no explicit Save button here, per this sprint's
 * spec, unlike EventNoteSection's explicit Save/Edit/Delete actions.
 */
export function CaseNotesPanel({ caseId }: CaseNotesPanelProps) {
  useEnsureCaseNotesLoaded(caseId);

  const storedNote = useCaseNote(caseId);
  const setCaseNote = useNotesStore((s) => s.setCaseNote);
  const clearCaseNote = useNotesStore((s) => s.clearCaseNote);

  const [text, setText] = React.useState(storedNote?.text ?? "");

  // Re-sync local text whenever the *stored* note actually changes out
  // from under us — a different case being loaded, or its first hydration
  // from localStorage completing after mount — without clobbering
  // whatever the investigator is actively typing on every render. Same
  // "adjust state during render" pattern used in FilterToolbar.tsx /
  // EventDetailsDrawer.tsx (react-hooks/set-state-in-effect elsewhere in
  // this codebase flags a useEffect+setState doing the same thing).
  const syncKey = `${caseId ?? "none"}:${storedNote?.updatedAt ?? "empty"}`;
  const [syncedKey, setSyncedKey] = React.useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setText(storedNote?.text ?? "");
  }

  const caseIdRef = React.useRef(caseId);
  const setCaseNoteRef = React.useRef(setCaseNote);
  React.useEffect(() => {
    caseIdRef.current = caseId;
    setCaseNoteRef.current = setCaseNote;
  });

  const debounceHandle = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    return () => {
      if (debounceHandle.current) clearTimeout(debounceHandle.current);
    };
  }, []);

  const handleChange = (value: string) => {
    setText(value);
    if (!caseIdRef.current) return;
    if (debounceHandle.current) clearTimeout(debounceHandle.current);
    debounceHandle.current = setTimeout(() => {
      if (caseIdRef.current) setCaseNoteRef.current(caseIdRef.current, value);
    }, AUTO_SAVE_DEBOUNCE_MS);
  };

  const handleClear = () => {
    if (debounceHandle.current) clearTimeout(debounceHandle.current);
    setText("");
    if (caseId) clearCaseNote(caseId);
  };

  const disabled = !caseId;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <NotebookPen className="h-4 w-4" aria-hidden="true" />
            Case Notes
          </h2>
          <span className="text-xs text-muted-foreground">
            {storedNote?.updatedAt
              ? `Last edited ${format(new Date(storedNote.updatedAt), "MMM d, yyyy HH:mm")}`
              : "Not yet saved"}
          </span>
        </div>

        <Textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Record observations, hypotheses, or next steps for this investigation…"
          className="min-h-[120px]"
          disabled={disabled}
          aria-label="Case notes"
        />

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || !text}
            onClick={handleClear}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear Notes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
