import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SearchX } from "lucide-react";

import { useEvidenceStore } from "@/store/evidenceStore";
import { useCaseStore, useHydrateCaseStore } from "@/store/caseStore";
import { computeCaseLibraryStats, searchCases, sortCases } from "@/lib/cases/statistics";
import { DEFAULT_CASE_SORT_ORDER, type CaseMetadata, type CaseSortOrder, type CaseViewMode } from "@/lib/cases/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { CaseStatistics } from "@/components/cases/CaseStatistics";
import { CaseToolbar } from "@/components/cases/CaseToolbar";
import { CaseGrid } from "@/components/cases/CaseGrid";
import { CaseList } from "@/components/cases/CaseList";
import { EmptyCases } from "@/components/cases/EmptyCases";
import { RenameCaseDialog } from "@/components/cases/RenameCaseDialog";
import { DeleteCaseDialog } from "@/components/cases/DeleteCaseDialog";

/**
 * Case Library (Phase 5.10) — the dedicated `/dashboard/cases` page for
 * browsing every investigation ever analyzed in this browser, independent
 * of whichever case (if any) is currently loaded in `evidenceStore`. This
 * is the one page in the `/dashboard` tree that deliberately does NOT use
 * `CaseStateGate`: an empty Case Library and an empty `evidenceStore` are
 * two different, unrelated conditions (an analyst with a rich case history
 * can visit this page with nothing currently loaded, and one with a case
 * open can have zero saved history if they've only ever used the app
 * once), so this page renders its own always-available content instead of
 * gating on "is a case loaded right now".
 *
 * Raw events are never persisted (this phase's "metadata only" scope) —
 * see `handleOpen` below for what "Open" can and can't do as a result.
 */
export default function CasesPage() {
  const navigate = useNavigate();
  useHydrateCaseStore();

  const cases = useCaseStore((s) => s.cases);
  const renameStoreCase = useCaseStore((s) => s.rename);
  const removeStoreCase = useCaseStore((s) => s.remove);
  const markOpened = useCaseStore((s) => s.markOpened);

  const activeCaseId = useEvidenceStore((s) => s.uploadedFile?.name ?? null);

  const [search, setSearch] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<CaseSortOrder>(DEFAULT_CASE_SORT_ORDER);
  const [viewMode, setViewMode] = React.useState<CaseViewMode>("grid");

  const stats = React.useMemo(() => computeCaseLibraryStats(cases), [cases]);
  const visibleCases = React.useMemo(
    () => sortCases(searchCases(cases, search), sortOrder),
    [cases, search, sortOrder],
  );

  const [renameTarget, setRenameTarget] = React.useState<CaseMetadata | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CaseMetadata | null>(null);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const handleRenameRequest = (id: string) => {
    const target = cases.find((c) => c.id === id) ?? null;
    setRenameTarget(target);
    setRenameOpen(true);
  };
  const handleDeleteRequest = (id: string) => {
    const target = cases.find((c) => c.id === id) ?? null;
    setDeleteTarget(target);
    setDeleteOpen(true);
  };

  const handleRenameConfirm = (id: string, name: string) => {
    renameStoreCase(id, name);
    toast.success("Case renamed");
  };
  const handleDeleteConfirm = (id: string) => {
    removeStoreCase(id);
    toast.success("Case removed from your library", {
      description: "Its notes and bookmarks were kept, in case you reopen it later.",
    });
  };

  // "Open" can only ever restore what this phase actually persists —
  // metadata, not raw events (see this page's own doc comment). A case
  // that's already the active `evidenceStore` investigation goes straight
  // to the Dashboard; anything else needs the source file(s) re-uploaded
  // before there's anything to view, so this is honest about that rather
  // than pretending to "reopen" data that was never saved.
  const handleOpen = (id: string) => {
    markOpened(id);
    if (id === activeCaseId) {
      navigate("/dashboard");
      return;
    }
    const target = cases.find((c) => c.id === id);
    toast.info("Re-upload this case's source file(s) to resume it", {
      description:
        target && target.sourceFiles.length > 0
          ? `Only ${target.sourceFiles.join(", ")} — raw events aren't stored between sessions, only case metadata.`
          : "Raw events aren't stored between sessions, only case metadata.",
    });
    navigate("/");
  };

  const hasAnyCases = cases.length > 0;
  const hasVisibleCases = visibleCases.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Case Library"
        description="Every investigation you've analyzed on this device, saved locally."
      />

      <CaseStatistics stats={stats} />

      {!hasAnyCases ? (
        <EmptyCases />
      ) : (
        <>
          <CaseToolbar
            search={search}
            onSearchChange={setSearch}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {!hasVisibleCases ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-12 text-center">
              <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">No cases match &ldquo;{search}&rdquo;.</p>
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </div>
          ) : viewMode === "grid" ? (
            <CaseGrid
              cases={visibleCases}
              activeCaseId={activeCaseId}
              onOpen={handleOpen}
              onRename={handleRenameRequest}
              onDelete={handleDeleteRequest}
            />
          ) : (
            <CaseList
              cases={visibleCases}
              activeCaseId={activeCaseId}
              onOpen={handleOpen}
              onRename={handleRenameRequest}
              onDelete={handleDeleteRequest}
            />
          )}
        </>
      )}

      <RenameCaseDialog
        caseMetadata={renameTarget}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onConfirm={handleRenameConfirm}
      />
      <DeleteCaseDialog
        caseMetadata={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
