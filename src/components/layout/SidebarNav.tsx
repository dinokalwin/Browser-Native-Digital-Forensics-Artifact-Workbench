import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarNavProps {
  /** Icon-only rail mode (desktop collapsed state). */
  collapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * Shared nav-link list rendered by both the desktop Sidebar (rail or
 * full width) and the mobile Sheet drawer, so active-state logic and
 * link markup live in exactly one place.
 */
export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const link = (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center px-2",
                isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        );

        if (!collapsed) return link;

        return (
          <Tooltip key={item.to}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
