import { Squelette } from "@/components/ui/Squelette";

/** Chargement d'une fiche script : chiffres puis blocs. */
export default function ChargementScript() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto max-w-2xl space-y-4">
      <Squelette className="h-5 w-24" />
      <Squelette className="h-9 w-3/4" />
      <Squelette className="h-28 w-full rounded-carte" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Squelette key={i} className="h-24 w-full rounded-carte" />
      ))}
    </div>
  );
}
