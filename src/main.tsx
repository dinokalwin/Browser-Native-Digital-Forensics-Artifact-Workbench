import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { router } from "@/routes";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="dfir-workbench-theme">
        {/* Phase 3 — Accessibility Hardening (SDD §21 "Reduced motion").
            `reducedMotion="user"` is framer-motion's own built-in respect
            for the `prefers-reduced-motion: reduce` media query: every
            `motion.*`/`AnimatePresence` transition anywhere in the app
            (DropZone, MitreCoverageMatrix, landing page, etc.) is
            automatically simplified to an instant/opacity-only state
            change for a user who has that OS/browser preference set — no
            per-component changes needed, and no new dependency, since this
            ships in the already-installed `framer-motion` package. */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider delayDuration={200}>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
