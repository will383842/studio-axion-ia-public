import { Squelette } from "@/components/ui/Squelette";

/** Chargement de la fiche personnage : portrait, onglets, cartes de visages. */
export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-5">
      <Squelette className="h-6 w-32" />
      <div className="flex items-center gap-4">
        <Squelette rond className="size-24" />
        <div className="flex-1 space-y-2">
          <Squelette className="h-8 w-40" />
          <Squelette className="h-4 w-28" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Squelette key={i} className="h-11 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Squelette key={i} className="aspect-[4/5] w-full rounded-carte" />
        ))}
      </div>
    </div>
  );
}
