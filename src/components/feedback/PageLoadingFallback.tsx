import { Loader2 } from "lucide-react";

/**
 * Suspense fallback shown while a lazy-loaded route chunk downloads
 * (see routes/index.tsx). Route-level code-splitting keeps the initial
 * bundle smaller — this covers the brief gap while the next chunk
 * arrives, which on a warm connection is rarely visible at all.
 */
export function PageLoadingFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
