import { FileDown } from "lucide-react";
import { toast } from "sonner";

import type { EvtxEvent } from "@/types/evidence";
import { exportCSV, exportJSON } from "@/services/evtxApi";
import { downloadBlob } from "@/lib/download-blob";
import { Button } from "@/components/ui/button";

interface ExportControlsProps {
  /** The currently visible/filtered event set — exports respect active search & filters. */
  events: EvtxEvent[];
}

function timestampedFilename(extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `dfir-workbench-export-${stamp}.${extension}`;
}

export function ExportControls({ events }: ExportControlsProps) {
  const disabled = events.length === 0;

  const handleExportCSV = () => {
    const blob = exportCSV(events);
    downloadBlob(blob, timestampedFilename("csv"));
    toast.success("CSV export ready", {
      description: `${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"} exported.`,
    });
  };

  const handleExportJSON = () => {
    const blob = exportJSON(events);
    downloadBlob(blob, timestampedFilename("json"));
    toast.success("JSON export ready", {
      description: `${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"} exported.`,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleExportCSV}
        disabled={disabled}
      >
        <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
        Export CSV
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleExportJSON}
        disabled={disabled}
      >
        <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
        Export JSON
      </Button>
    </div>
  );
}
