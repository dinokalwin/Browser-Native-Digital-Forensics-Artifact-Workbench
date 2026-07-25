import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level crash guard. React error boundaries must be class components
 * (there's no Hooks equivalent for componentDidCatch) — this is the one
 * exception to this codebase's otherwise all-function-component style.
 *
 * Wraps the whole app (see main.tsx) so an unexpected rendering error
 * anywhere shows a recoverable "Something went wrong" screen instead of
 * a blank white page — the same "degrade honestly" philosophy used
 * throughout the parsing pipeline's error states.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {this.state.error.message || "An unexpected error occurred while rendering this page."}
          </p>
        </div>
        <Button onClick={this.reset}>Return to landing page</Button>
      </div>
    );
  }
}
