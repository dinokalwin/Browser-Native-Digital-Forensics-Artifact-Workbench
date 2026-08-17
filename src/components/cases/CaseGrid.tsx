import type { CaseMetadata } from "@/lib/cases/types";
import { CaseCard } from "@/components/cases/CaseCard";

interface CaseGridProps {
  cases: CaseMetadata[];
  activeCaseId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Case Library's Grid view (Phase 5.10) — a responsive card grid, same
 * breakpoint rhythm (`sm:2 / lg:3 / 2xl:5` style progression) this
 * project's other card grids already use (e.g. `DashboardPage.tsx`'s
 * Investigation Statistics row), scaled down to 4 columns max since a
 * `CaseCard` carries more information than a `StatCard`.
 */
export function CaseGrid({ cases, activeCaseId, onOpen, onRename, onDelete }: CaseGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {cases.map((caseMetadata) => (
        <CaseCard
          key={caseMetadata.id}
          caseMetadata={caseMetadata}
          isActive={caseMetadata.id === activeCaseId}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
