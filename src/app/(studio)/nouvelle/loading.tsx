import { Squelette } from "@/components/ui/Squelette";

/** Chargement de « Nouvelle vidéo » : modèles puis cartes de formats. */
export default function ChargementNouvelle() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-6">
      <Squelette className="h-9 w-56" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1].map((i) => (
          <Squelette key={i} className="h-28 w-[78%] shrink-0 rounded-carte sm:w-80" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Squelette key={i} className="h-64 rounded-carte" />
        ))}
      </div>
    </div>
  );
}
