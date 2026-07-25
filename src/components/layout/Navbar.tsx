import { Menu, FileText } from "lucide-react";

import { useUIStore } from "@/store/uiStore";
import { useEvidenceStore } from "@/store/evidenceStore";
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

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6">
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
