import { Brand } from "@/components/layout/Brand";

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <Brand compact />
        <p className="text-xs text-muted-foreground">
          Runs entirely client-side. Built for rapid, offline-friendly triage.
        </p>
      </div>
    </footer>
  );
}
