import { Squelette } from "@/components/ui";

/** Chargement de l'écran Résultat : numéro, limite, puis une ligne par version. */
export default function ChargementResultat() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl space-y-4">
      <Squelette className="h-6 w-40 rounded-full" />
      <Squelette className="h-9 w-28" />
      <Squelette className="h-4 w-64" />
      <Squelette className="h-36 w-full rounded-carte" />
      <div className="space-y-px overflow-hidden rounded-carte">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 bg-surface-1 p-4">
            <Squelette className="size-9 rounded-xl" />
            <Squelette className="h-4 flex-1" />
            <Squelette className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
