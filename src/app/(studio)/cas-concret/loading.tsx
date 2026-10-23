import { Squelette, SqueletteGrille } from "@/components/ui/Squelette";

/** Cas concret MD en chargement : titre, case, pastilles, cartes. */
export default function ChargementCasConcret() {
  return (
    <div role="status" aria-label="Chargement des cas" className="mx-auto max-w-2xl">
      <Squelette className="mb-6 h-9 w-48" />
      <Squelette rond className="mb-4 h-14 w-full" />
      <Squelette rond className="mb-4 h-11 w-2/3" />
      <SqueletteGrille nombre={4} />
    </div>
  );
}
