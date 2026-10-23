import { Squelette } from "@/components/ui/Squelette";

/** Chargement des Matières : jauge, boutons, pastilles, cartes. */
export default function ChargementMatieres() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl space-y-4">
      <Squelette className="h-9 w-40" />
      <Squelette className="h-36 w-full rounded-carte" />
      <div className="grid grid-cols-2 gap-2">
        <Squelette className="h-12 rounded-full" />
        <Squelette className="h-12 rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <Squelette key={i} className="h-28 w-full rounded-carte" />
      ))}
    </div>
  );
}
