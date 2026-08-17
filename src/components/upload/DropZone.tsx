import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useEvidenceStore } from "@/store/evidenceStore";
import { Button } from "@/components/ui/button";
import { FileInfoCard } from "@/components/upload/FileInfoCard";
import { SelectedFilesCard } from "@/components/upload/SelectedFilesCard";

/** Anything larger than this still parses normally — it's a heads-up, not a limit. */
const MAX_FILE_SIZE_WARNING = 500 * 1024 * 1024; // 500 MB

/**
 * Rejection-level validation only. A non-null return blocks the upload
 * entirely (the message is shown inline via `localError`). Kept as a pure
 * function, separate from the component, so the rules are readable and
 * testable on their own — no DOM, no state, no side effects.
 *
 * The large-file check is deliberately NOT part of this function: it's a
 * warning, not a rejection, so it can't be expressed as "return an error
 * string" — see `isLargeFile` and its use in `handleFiles` below.
 */
function validateFile(file: File): string | null {
  if (file.size === 0) {
    return "This file is empty.";
  }

  if (!file.name.toLowerCase().endsWith(".evtx")) {
    return "Only Windows Event Log (.evtx) files are supported.";
  }

  return null;
}

/** Large files aren't rejected — just flagged, since parsing may take longer. */
function isLargeFile(file: File): boolean {
  return file.size > MAX_FILE_SIZE_WARNING;
}

/**
 * Drag-and-drop / click-to-browse upload surface for the landing page.
 *
 * Validates every selected file (see `validateFile`), hands the valid ones
 * to `evidenceStore.loadFiles` (Phase 5.7 — Multi-EVTX Investigation; each
 * file is still parsed independently by the same real browser-native EVTX
 * parser, see src/backend/evtx-parser.ts — entirely client-side, nothing is
 * uploaded to a server), and navigates to the dashboard once that pipeline
 * reports at least one file loaded successfully. On total failure the user
 * stays here and sees the error.
 */
export function DropZone() {
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  // Local-only, purely presentational: powers FileInfoCard/SelectedFilesCard
  // (name/size/last modified) without adding anything to evidenceStore. The
  // store's UploadedFileMeta intentionally doesn't carry the browser File
  // object or its lastModified timestamp, and that's out of scope here —
  // this state never feeds the parsing pipeline, which continues to read
  // the validated `File[]` directly in handleFiles exactly as before.
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  const loadFiles = useEvidenceStore((s) => s.loadFiles);
  const status = useEvidenceStore((s) => s.status);
  const backendError = useEvidenceStore((s) => s.error);
  const eventCount = useEvidenceStore((s) => s.events.length);
  const failedFiles = useEvidenceStore((s) => s.failedFiles);
  const isBusy = status === "parsing" || status === "analyzing";

  const handleFiles = React.useCallback(
    async (fileList: FileList | null) => {
      const incoming = Array.from(fileList ?? []);
      if (incoming.length === 0) return;

      const validFiles: File[] = [];
      const invalidFiles: Array<{ file: File; reason: string }> = [];
      for (const file of incoming) {
        const validationError = validateFile(file);
        if (validationError) invalidFiles.push({ file, reason: validationError });
        else validFiles.push(file);
      }

      if (validFiles.length === 0) {
        // Every selected file was rejected — show the first reason inline,
        // same single-message treatment as the pre-5.7 single-file path.
        setLocalError(invalidFiles[0]?.reason ?? "No valid .evtx files were selected.");
        return;
      }

      if (invalidFiles.length > 0) {
        toast.warning(
          invalidFiles.length === 1
            ? `Skipped "${invalidFiles[0].file.name}": ${invalidFiles[0].reason}`
            : `Skipped ${invalidFiles.length} files that aren't valid .evtx files.`,
        );
      }

      if (validFiles.some(isLargeFile)) {
        toast.warning("Large file detected. Parsing may take longer.");
      }

      setLocalError(null);
      setSelectedFiles(validFiles);
      await loadFiles(validFiles);

      // Only navigate once at least one file parsed successfully — on
      // total failure the store's `error` is already set and rendered
      // below, and the user should stay put to see it (and try again)
      // rather than land on a dashboard with nothing in it.
      const state = useEvidenceStore.getState();

      // QA-01 — Duplicate EVTX File Protection. Reported regardless of the
      // eventual parse outcome below: this describes what was *selected*,
      // not whether parsing subsequently succeeded, so an analyst always
      // learns a duplicate was skipped even on an otherwise-failed load.
      if (state.duplicateFiles.length > 0) {
        toast.warning(
          state.duplicateFiles.length === 1
            ? `"${state.duplicateFiles[0]}" was already selected and was skipped.`
            : `${state.duplicateFiles.length.toLocaleString()} duplicate files were already selected and were skipped.`,
          {
            description:
              state.duplicateFiles.length > 1 ? state.duplicateFiles.join(", ") : undefined,
          },
        );
      }

      // QA-02 — Same-Host Advisory. Advisory only, per `evidenceStore.ts`'s
      // own doc comment on `multiHostWarning` — the case still loads
      // normally; this just tells the analyst what was combined so a
      // cross-host correlation isn't mistaken for a same-host one.
      if (state.multiHostWarning) {
        toast.warning("These evidence files contain different host names.", {
          description: `Combining them may produce cross-host correlations. Continue only if this is intentional. Hosts: ${state.multiHostWarning.join(", ")}.`,
        });
      }

      if (state.status === "ready") {
        toast.success(
          validFiles.length === 1
            ? "EVTX file parsed successfully"
            : "EVTX files parsed successfully",
          {
            description:
              validFiles.length === 1
                ? `${state.events.length.toLocaleString()} events extracted from ${validFiles[0].name}`
                : `${state.events.length.toLocaleString()} merged events extracted from ${state.uploadedFiles.length.toLocaleString()} of ${validFiles.length.toLocaleString()} files`,
          },
        );
        if (state.failedFiles.length > 0) {
          toast.warning(
            `${state.failedFiles.length.toLocaleString()} file(s) failed to parse and were skipped.`,
            {
              description: state.failedFiles.join(", "),
            },
          );
        }
        navigate("/dashboard");
      } else if (state.status === "error") {
        toast.error(
          validFiles.length === 1
            ? "Couldn't parse this file"
            : "Couldn't parse any of the selected files",
          { description: state.error ?? undefined },
        );
      }
    },
    [loadFiles, navigate],
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    void handleFiles(e.dataTransfer.files);
  };

  const displayError = localError ?? backendError;

  return (
    <div className="mx-auto w-full max-w-xl">
      {/*
        Hidden trigger, not a second interactive control: it's opened
        programmatically via `inputRef.current?.click()` from the card's own
        click/keydown handlers below, never focused/activated directly. Kept
        as a SIBLING of the `role="button"` card rather than a descendant —
        axe's nested-interactive rule flags any native interactive element
        (button, input, etc.) nested inside an ARIA `role="button"`
        container regardless of `tabIndex`/`aria-hidden`, since some
        assistive-tech/browser combinations can still reach it. `.click()`
        still works on an element that's merely visually hidden (`sr-only`)
        and outside the tab order.
      */}
      <input
        ref={inputRef}
        type="file"
        accept=".evtx"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <motion.div
        role="button"
        tabIndex={0}
        aria-label="Upload EVTX file or files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={onDrop}
        animate={{ scale: isDragActive ? 1.02 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed border-border bg-card/50 px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isDragActive && "border-primary bg-primary/5",
          isBusy && "pointer-events-none opacity-70",
        )}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isBusy ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          )}
        </span>

        <div className="space-y-1">
          <p className="font-medium text-foreground">
            {isBusy ? "Parsing EVTX file…" : "Upload EVTX File"}
          </p>
          <p className="text-sm text-muted-foreground">
            Drag and drop one or more Windows Event Log (.evtx) files here, or click to browse.
          </p>
        </div>

        {/*
          Purely decorative — the whole card is already the click/keyboard
          target (see the outer `role="button"` above). Rendered as a `span`
          via `asChild` rather than a real `<button>`: axe's nested-interactive
          check flags a native interactive element inside an ARIA `role="button"`
          container regardless of `aria-hidden`/`tabIndex={-1}`, since some
          assistive-tech/browser combinations can still reach it. A `span`
          keeps the identical visual styling with no focusable/interactive
          semantics to conflict with the parent.
        */}
        <Button asChild aria-disabled={isBusy} aria-hidden="true">
          <span>{isBusy ? "Processing…" : "Select File"}</span>
        </Button>

        <AnimatePresence>
          {isBusy && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Parsing progress"
            >
              <motion.span
                className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {displayError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{displayError}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {selectedFiles.length === 1 && !localError && (
          <FileInfoCard
            // Keyed by identity so a newly-selected file (even one that
            // reuses the same name) remounts and replays the enter
            // animation, instead of silently patching the previous card.
            key={`${selectedFiles[0].name}-${selectedFiles[0].lastModified}-${selectedFiles[0].size}`}
            file={selectedFiles[0]}
            status={status}
            eventCount={status === "ready" ? eventCount : null}
            className="mt-4"
          />
        )}
        {selectedFiles.length > 1 && !localError && (
          <SelectedFilesCard
            key={selectedFiles
              .map((file) => `${file.name}-${file.lastModified}-${file.size}`)
              .join("|")}
            files={selectedFiles}
            status={status}
            eventCount={status === "ready" ? eventCount : null}
            failedFiles={failedFiles}
            className="mt-4"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
