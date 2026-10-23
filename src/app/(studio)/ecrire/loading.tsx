import { Squelette } from "@/components/ui/Squelette";

/** Chargement de « Écrire » : onglets puis cartes. */
export default function ChargementEcrire() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-5">
      <Squelette className="h-9 w-40" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Squelette key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <Squelette className="h-14 w-full rounded-full" />
      {[0, 1, 2, 3].map((i) => (
        <Squelette key={i} className="h-20 w-full rounded-carte" />
      ))}
    </div>
  );
}
