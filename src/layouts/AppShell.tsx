import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { Navbar } from "@/components/layout/Navbar";
import { PageLoadingFallback } from "@/components/feedback/PageLoadingFallback";

/**
 * Structural shell for the /dashboard route tree: desktop Sidebar +
 * Sheet-based MobileSidebar, sticky Navbar, and the main content area
 * nested routes render into.
 */
export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Sidebar />
      <MobileSidebar />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Navbar />
        <main id="main-content" className="min-w-0 flex-1 p-4 lg:p-6">
          <Suspense fallback={<PageLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
