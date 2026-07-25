import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, resolving conflicts (last one wins).
 * Required by shadcn/ui-generated components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
