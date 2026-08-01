import * as React from "react";
import { StickyNote, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEventNote, useNotesStore, useEnsureCaseNotesLoaded } from "@/store/notesStore";

export interface EventNoteSectionProps {
  /** Uploaded file name — the key notes are namespaced under (see lib/notes.ts). */
  caseId: string | null;
  /** EvtxEvent.id of the event currently shown in the drawer. */
  eventId: string;
}

/**
 * Per-event investigator note, rendered inside EventDetailsDrawer.tsx.
 * Unlike CaseNotesPanel's auto-save, this sprint's spec lists Event Notes
 * as three explicit actions (add / edit / delete) rather than auto-save,
 * so edits are staged in a local draft and only written to storage on an
 * explicit Save — appropriate for a note tied to a specific piece of
 * evidence, where an accidental half-typed edit shouldn't silently
 * overwrite a deliberate prior note.
 */
export function EventNoteSection({ caseId, eventId }: EventNoteSectionProps) {
  useEnsureCaseNotesLoaded(caseId);

  const note = useEventNote(caseId, eventId);
  const setEventNote = useNotesStore((s) => s.setEventNote);
  const deleteEventNote = useNotesStore((s) => s.deleteEventNote);

  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(note?.text ?? "");

  // Re-sync the draft (and drop out of editing mode) whenever we land on a
  // *different* event, or that event's stored note changes underneath us
  // (first hydration completing, or a delete) — not on every render. Same
  // pattern as CaseNotesPanel.tsx.
  const syncKey = `${eventId}:${note?.updatedAt ?? "empty"}`;
  const [syncedKey, setSyncedKey] = React.useState(syncKey);
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey);
    setDraft(note?.text ?? "");
    setIsEditing(false);
  }

  if (!caseId) return null;

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setEventNote(caseId, eventId, trimmed);
    setIsEditing(false);
    toast.success("Note saved");
  };

  const handleCancel = () => {
    setDraft(note?.text ?? "");
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteEventNote(caseId, eventId);
    setDraft("");
    setIsEditing(false);
    toast.success("Note deleted");
  };

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
        Investigator Note
      </h3>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add an investigator note for this event…"
            className="min-h-[100px]"
            aria-label="Event note"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!draft.trim()}>
              Save Note
            </Button>
          </div>
        </div>
      ) : note ? (
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note.text}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Edited {format(new Date(note.updatedAt), "MMM d, yyyy HH:mm")}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsEditing(true)}>
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
          Add Note
        </Button>
      )}
    </div>
  );
}
