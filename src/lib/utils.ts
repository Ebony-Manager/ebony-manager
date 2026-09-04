import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names safely, resolving conflicts (e.g. "p-2 p-4" -> "p-4").
 * Used by every component in the design system instead of raw template strings.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
