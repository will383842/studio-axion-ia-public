import { Squelette, SqueletteGrille } from "@/components/ui/Squelette";

/** Chargement d'un type de la Bibliothèque. */
export default function Chargement() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-6">
      <div className="space-y-3">
        <Squelette className="h-5 w-28" />
        <Squelette className="h-9 w-48" />
      </div>
      <Squelette className="h-12 w-full rounded-champ" />
      <SqueletteGrille nombre={8} ratio="1:1" />
    </div>
  );
}
