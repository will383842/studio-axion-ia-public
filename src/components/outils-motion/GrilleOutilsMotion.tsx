import { EtatVide } from "@/components/ui/EtatVide";
import type { OutilMotion } from "@/outils-motion/catalogue";
import { Pictogramme } from "./Pictogramme";

/** Cartes très visuelles, peu de texte : un dessin, un nom, une phrase. Liste vide : un état vide, jamais une page blanche. */
export function GrilleOutilsMotion({ outils }: { outils: readonly OutilMotion[] }) {
  if (outils.length === 0) {
    return <EtatVide icone="baguette" titre="Aucun outil pour le moment" phrase="Les pièces animées apparaîtront ici dès qu'elles seront prêtes." />;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Outils motion design">
      {outils.map((o) => (
        <li key={o.id} data-outil={o.id} className="flex flex-col overflow-hidden rounded-carte border border-trait bg-surface-1 shadow-carte">
          <div className="aspect-[10/9] bg-surface-2 p-4">
            <Pictogramme id={o.id} />
          </div>
          <div className="space-y-1 p-3.5">
            <h2 className="text-base font-semibold text-texte">{o.nom}</h2>
            <p className="text-sm text-texte-doux">{o.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
