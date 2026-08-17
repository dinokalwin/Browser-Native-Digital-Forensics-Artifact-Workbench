import { Menu, FileText, Search } from "lucide-react";

import { useUIStore } from "@/store/uiStore";
import { useEvidenceStore } from "@/store/evidenceStore";
import { useSearchStore } from "@/store/searchStore";
import { Brand } from "@/components/layout/Brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Top navigation: mobile menu trigger + brand (visible below lg, since
 * the desktop Sidebar already renders the brand), the active case file
 * indicator, and the theme toggle. Sticky so it stays reachable while
 * scrolling long evidence tables/timelines.
 */
export function Navbar() {
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen);
  const uploadedFile = useEvidenceStore((s) => s.uploadedFile);
  const openSearch = useSearchStore((s) => s.open);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6 print:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation menu"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu />
      </Button>

      <div className="lg:hidden">
        <Brand compact />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Phase 5.12 — Global Investigation Search. `GlobalSearch.tsx`
            (mounted once in AppShell.tsx) owns the actual Ctrl/Cmd+K
            listener and the palette itself; this button is a second,
            mouse-first entry point into the exact same `searchStore.ts`
            state, so both always agree on what "open" means. */}
        <Button
          variant="outline"
          size="sm"
          onClick={openSearch}
          aria-label="Search this investigation"
          className="hidden items-center gap-2 text-muted-foreground sm:flex"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Search
          <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Ctrl/⌘ K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={openSearch}
          aria-label="Search this investigation"
          className="sm:hidden"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
        {uploadedFile && (
          <Badge
            variant="outline"
            className="hidden items-center gap-1.5 border-primary/30 text-foreground sm:flex"
          >
            <FileText className="h-3 w-3 text-primary" aria-hidden="true" />
            <span className="max-w-40 truncate">{uploadedFile.name}</span>
          </Badge>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
