import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Fusionne des classes Tailwind sans conflits : cn("p-2", cond && "p-4") → "p-4". */
export function cn(...entrees: ClassValue[]): string {
  return twMerge(clsx(entrees));
}
