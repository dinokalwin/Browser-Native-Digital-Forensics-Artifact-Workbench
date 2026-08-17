import { cn } from "@/lib/utils";
import { EXPORT_FORMAT_LABEL, type ExportFormat } from "@/lib/export/types";

interface ExportFormatSelectorProps {
  formats: readonly ExportFormat[];
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
  disabled?: boolean;
}

/**
 * Small segmented control letting an investigator pick which format one of
 * the three multi-format cards (Evidence / IOC Findings / MITRE ATT&CK)
 * should export as. Cards with only one format (`formats.length <= 1`)
 * don't render this at all — `ExportCard.tsx` shows a static format badge
 * for those instead, since there's nothing to choose.
 *
 * `role="radiogroup"`/`role="radio"` (not a native `<select>`, matching
 * `CaseToolbar.tsx`'s Grid/List toggle button-group precedent instead)
 * since this is a small, always-visible 2-option choice, not a long list
 * that benefits from a native dropdown's built-in keyboard search.
 */
export function ExportFormatSelector({ formats, value, onChange, disabled = false }: ExportFormatSelectorProps) {
  if (formats.length <= 1) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Export format"
      className="inline-flex items-center gap-0.5 rounded-md border border-input bg-background p-0.5"
    >
      {formats.map((format) => (
        <button
          key={format}
          type="button"
          role="radio"
          aria-checked={value === format}
          disabled={disabled}
          onClick={() => onChange(format)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === format
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {EXPORT_FORMAT_LABEL[format]}
        </button>
      ))}
    </div>
  );
}
