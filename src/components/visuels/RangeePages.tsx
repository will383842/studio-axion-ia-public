import type { VueCarrouselFiche } from "@/domaine/visuels/contrats";
import { VisionneusePages } from "./VisionneusePages";

/** Pages d'un carrousel en grille (2 colonnes sur téléphone, jusqu'à 4 sur ordinateur, 4:5) ; un clic ouvre la visionneuse. */
export function RangeePages({
  pages,
  titre,
  className,
}: {
  pages: VueCarrouselFiche["pages"];
  titre: string;
  className?: string;
}) {
  // Base 1 à l'écran : le service de rendu numérote à partir de 0 (p.index), on affiche p.index + 1.
  return <VisionneusePages titre={titre} className={className} pages={pages.map((p) => ({ n: p.index + 1, urlX1: p.urlX1, urlX2: p.urlX2 }))} />;
}
