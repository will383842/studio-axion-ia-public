import { cn } from "@/lib/cn";

/** Lueur orange décorative (dégradé radial 10–18 %). Placer dans un parent `relative isolate`. */
export function Lueur({ forte, position = "haut", className }: { forte?: boolean; position?: "haut" | "centre" | "bas"; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 -z-10",
        position === "haut" && "top-0 h-3/4",
        position === "centre" && "inset-y-0",
        position === "bas" && "bottom-0 h-3/4 rotate-180",
        forte ? "lueur-forte" : "lueur",
        className,
      )}
    />
  );
}
