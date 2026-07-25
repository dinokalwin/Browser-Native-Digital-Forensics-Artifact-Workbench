import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Thin theming wrapper around sonner's Toaster so success/error/info
 * toasts pick up the SOC dark theme's CSS variables instead of sonner's
 * defaults. Rendered once at the app root (see main.tsx).
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!text-severity-normal",
          error: "group-[.toaster]:!text-severity-critical",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
