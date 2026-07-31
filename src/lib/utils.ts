import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, resolving conflicts (last one wins).
 * Required by shadcn/ui-generated components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Formats a byte count as a human-readable size (B / KB / MB / GB / TB),
 * using 1024-based (binary) units — matching how File.size and Windows
 * Explorer both report file sizes. One decimal place once the value is
 * smaller than 100 in its chosen unit, otherwise a whole number, so small
 * values stay precise (e.g. "3.4 MB") without cluttering larger ones
 * (e.g. "512 MB" instead of "512.0 MB").
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";

  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    FILE_SIZE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const formatted = value < 100 ? value.toFixed(1) : Math.round(value).toString();

  return `${formatted} ${FILE_SIZE_UNITS[exponent]}`;
}
