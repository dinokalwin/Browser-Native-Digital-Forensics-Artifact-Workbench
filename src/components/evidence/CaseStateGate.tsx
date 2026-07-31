import type { ReactNode } from "react";
import { FileWarning, Loader2, UploadCloud } from "lucide-react";

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={uploadedFile.name}
        actions={<CaseStatusBadge status={status} />}
      />
      {children(events)}
    </div>
  );
}
