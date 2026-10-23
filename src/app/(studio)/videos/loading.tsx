import { Squelette, SqueletteGrille } from "@/components/ui/Squelette";

const LARGEURS = ["w-20", "w-24", "w-32", "w-28"];

/** Mes vidéos en chargement : titre, onglets, recherche, grille. */
export default function ChargementVideos() {
  return (
    <div role="status" aria-label="Chargement de mes vidéos">
      <Squelette className="mb-6 h-9 w-48" />
      <div className="mb-5 flex gap-2 overflow-hidden">
        {LARGEURS.map((l) => (
          <Squelette key={l} rond className={`h-11 shrink-0 ${l}`} />
        ))}
      </div>
      <Squelette rond className="mb-4 h-11 w-full" />
      <SqueletteGrille nombre={8} />
    </div>
  );
}
