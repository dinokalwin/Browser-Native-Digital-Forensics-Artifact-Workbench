import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useEvidenceStore } from "@/store/evidenceStore";
import { Button } from "@/components/ui/button";

/**
 * Drag-and-drop / click-to-browse upload surface for the landing page.
 *
 * Validates the file extension, hands the File to `evidenceStore.loadFile`
 * (which runs the real browser-native EVTX parser — see
 * src/backend/evtx-parser.ts — entirely client-side, nothing is uploaded
 * to a server), and navigates to the dashboard only once that pipeline
 * reports success. On failure the user stays here and sees the error.
 */
export function DropZone() {
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const loadFile = useEvidenceStore((s) => s.loadFile);
  const status = useEvidenceStore((s) => s.status);
  const backendError = useEvidenceStore((s) => s.error);
  const isBusy = status === "parsing" || status === "analyzing";

  const handleFiles = React.useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".evtx")) {
        setLocalError("Unsupported file type. Please upload a .evtx file.");
        return;
      }

      setLocalError(null);
      await loadFile(file);

      // Only navigate on a successful parse — on failure the store's
      // `error` is already set and rendered below, and the user should
      // stay put to see it (and try another file) rather than land on a
      // dashboard with nothing in it.
      const state = useEvidenceStore.getState();
      if (state.status === "ready") {
        toast.success("EVTX file parsed successfully", {
          description: `${state.events.length.toLocaleString()} events extracted from ${file.name}`,
        });
        navigate("/dashboard");
      } else if (state.status === "error") {
        toast.error("Couldn't parse this file", { description: state.error ?? undefined });
      }
    },
    [loadFile, navigate],
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    void handleFiles(e.dataTransfer.files);
  };

  const displayError = localError ?? backendError;

  return (
    <div className="mx-auto w-full max-w-xl">
      <motion.div
        role="button"
        tabIndex={0}
        aria-label="Upload EVTX file"
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
        <input
          ref={inputRef}
          type="file"
          accept=".evtx"
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />

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
            Drag and drop a Windows Event Log (.evtx) file here, or click to
            browse.
          </p>
        </div>

        <Button type="button" disabled={isBusy} tabIndex={-1} aria-hidden="true">
          {isBusy ? "Processing…" : "Select File"}
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
    </div>
  );
}
