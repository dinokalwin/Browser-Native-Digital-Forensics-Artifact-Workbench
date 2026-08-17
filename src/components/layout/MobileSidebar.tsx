import { useUIStore } from "@/store/uiStore";
import { Brand } from "@/components/layout/Brand";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Sheet-based nav drawer for < lg viewports, triggered from Navbar's
 * hamburger button. Shares SidebarNav so link markup/active-state logic
 * isn't duplicated between desktop and mobile.
 */
export function MobileSidebar() {
  const open = useUIStore((s) => s.mobileNavOpen);
  const setOpen = useUIStore((s) => s.setMobileNavOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="flex w-72 flex-col gap-6 print:hidden">
        <SheetHeader>
          {/* SheetTitle is visually hidden but keeps the drawer
              accessible to screen readers; Brand (a link) is rendered
              separately since titles shouldn't contain interactive
              elements. */}
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <Brand />
        </SheetHeader>
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
