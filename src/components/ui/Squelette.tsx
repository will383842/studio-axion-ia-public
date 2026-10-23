import { cn } from "@/lib/cn";

/** Bloc de chargement scintillant. */
export function Squelette({ className, rond }: { className?: string; rond?: boolean }) {
  return <div aria-hidden className={cn("squelette", rond ? "rounded-full" : "rounded-xl", className)} />;
}

/** Grille de vignettes en chargement (pages loading.tsx). */
export function SqueletteGrille({ nombre = 6, ratio = "9:16" }: { nombre?: number; ratio?: "9:16" | "16:9" | "1:1" }) {
  return (
    <div role="status" aria-label="Chargement" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="space-y-2">
          <Squelette className={cn("w-full rounded-carte", ratio === "9:16" ? "aspect-[9/16]" : ratio === "16:9" ? "aspect-video" : "aspect-square")} />
          <Squelette className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Page en chargement : en-tête + grille. */
export function SquelettePage() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-6">
      <div className="space-y-3">
        <Squelette className="h-9 w-56" />
        <Squelette className="h-4 w-72" />
      </div>
      <Squelette className="h-40 w-full rounded-carte" />
      <SqueletteGrille nombre={4} />
    </div>
  );
}
