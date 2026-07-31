import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  // No margin of its own: every caller places this inside a `gap-6`
  // flex/grid container (see CaseStateGate.tsx), which is the single
  // source of spacing between this header and whatever follows it. A
  // `mb-*` here on top of that gap would silently double the space below
  // the header — exactly the kind of stacked-spacing bug this component
  // must not reintroduce.
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
