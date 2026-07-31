import type { ReactNode } from "react";
import { FileWarning, Inbox, Loader2, UploadCloud } from "lucide-react";

import { useEvidenceStore } from "@/store/evidenceStore";
import type { EvtxEvent } from "@/types/evidence";
import { PageHeader } from "@/components/layout/PageHeader";
import { CaseStatusBadge } from "@/components/evidence/CaseStatusBadge";
import { EmptyState } from "@/components/feedback/EmptyState";

interface CaseStateGateProps {
  title: string;
  description: string;
  /** Rendered only once a case is loaded and parsing succeeded. */
  children: (events: EvtxEvent[]) => ReactNode;
}

/**
 * Shared no-file / parse-error / parsing / ready branching for every
 * page that depends on `evidenceStore` (Dashboard, Evidence Viewer,
 * Timeline). Previously each page duplicated this exact four-way switch
 * with only the icon/copy differing — consolidated here in Phase 7 so
 * there's a single place to change the empty/error/loading treatment.
 */
export function CaseStateGate({ title, description, children }: CaseStateGateProps) {
  const uploadedFile = useEvidenceStore((s) => s.uploadedFile);
  const status = useEvidenceStore((s) => s.status);
  const error = useEvidenceStore((s) => s.error);
  const events = useEvidenceStore((s) => s.events);

  if (!uploadedFile) {
    return (
      <div>
        <PageHeader
          title={title}
          description="No case file loaded"
          actions={<CaseStatusBadge status={status} />}
        />
        <EmptyState
          icon={UploadCloud}
          title="No case loaded"
          description={description}
          action={{ label: "Upload a case file", to: "/" }}
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div>
        <PageHeader
          title={title}
          description={uploadedFile.name}
          actions={<CaseStatusBadge status={status} />}
        />
        <EmptyState
          icon={FileWarning}
          title="Couldn't parse this file"
          description={error ?? "The file could not be processed. Try a different EVTX file."}
          action={{ label: "Try another file", to: "/" }}
        />
      </div>
    );
  }

  // `status === "ready"` with zero events is a *successful* parse of a
  // genuinely empty log — many real Windows EVTX channels (HardwareEvents,
  // vendor diagnostic channels, Internet Explorer on a system that never
  // used it) are commonly empty by default, and Event Viewer opens them
  // fine showing zero events. That's distinct from still-in-flight parsing,
  // and must not be shown as a perpetual "Parsing in progress" spinner —
  // see parser.ts's matching fix to stop treating this case as an error.
  if (status === "ready" && events.length === 0) {
    return (
      <div>
        <PageHeader
          title={title}
          description={uploadedFile.name}
          actions={<CaseStatusBadge status={status} />}
        />
        <EmptyState
          icon={Inbox}
          title="This log is empty"
          description="The file was parsed successfully, but it contains no events."
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div>
        <PageHeader
          title={title}
          description={uploadedFile.name}
          actions={<CaseStatusBadge status={status} />}
        />
        <EmptyState
          icon={Loader2}
          title="Parsing in progress"
          description="Extracting events from the uploaded file — this page updates automatically."
        />
      </div>
    );
  }

  return (
    // `[&>*]:min-w-0` — every direct child (PageHeader, plus whatever
    // `children(events)` renders: the dashboard's grids, the evidence
    // table, or the timeline) is a flex item of this flex-col container,
    // and flex items default to `min-width: auto`, meaning they refuse to
    // shrink below their own content's intrinsic width. EvidenceTable's
    // underlying <table> has real min-width per column (see columns.tsx),
    // so without this, that intrinsic width propagates up through every
    // flex boundary between here and the viewport, growing the whole page
    // wider than the screen instead of staying inside EvidenceTable's own
    // `overflow-x-auto` wrapper (src/components/ui/table.tsx) where it
    // belongs. This one utility is what lets that existing local-scroll
    // mechanism actually take effect, on all three pages that share this
    // component (Dashboard, Evidence Viewer, Timeline).
    <div className="flex min-w-0 flex-col gap-6 [&>*]:min-w-0">
      <PageHeader
        title={title}
        description={uploadedFile.name}
        actions={<CaseStatusBadge status={status} />}
      />
      {children(events)}
    </div>
  );
}
