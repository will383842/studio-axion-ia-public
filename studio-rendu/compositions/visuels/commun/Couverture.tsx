/** Éléments communs des couvertures du style C (ART-1) : sous-titre, illustration de la banque sur un bloc orange, pied avec la marque. */
import type { IdIllustration } from "../../../../src/briques/visuels/registre-illustrations";
import { TEXTES_FIXES } from "../../../../src/briques/visuels/textes-fixes";
import { chargerPoliceInter } from "../polices";
import type { CouleursDessin } from "../illustrations/palette";
import { COULEURS, PAGE, POLICE_CORPS } from "./constantes";
import { Scene } from "./Picto";
import { Swipe } from "./Swipe";

/** Corps (px) du sous-titre d'une couverture : texte courant agrandi, Inter Bold ; un sous-titre long (plus de 50 signes) descend d'un cran. */
export const TAILLE_SOUS_TITRE = 48;
export const TAILLE_SOUS_TITRE_LONG = 40;
export const tailleSousTitre = (texte: string) => (texte.length <= 50 ? TAILLE_SOUS_TITRE : TAILLE_SOUS_TITRE_LONG);

/** Illustration posée sur l'orange : le fond pâle de la scène passe en crème (il se détache), le reste garde la charte. */
export const DESSIN_SUR_ORANGE: CouleursDessin = { pale: COULEURS.creme, creme: COULEURS.pale };

export function SousTitre({ texte, largeurMax }: { texte: string; largeurMax: number }) {
  chargerPoliceInter();
  return <div style={{ maxWidth: largeurMax, fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: tailleSousTitre(texte), lineHeight: 1.22, color: COULEURS.encre }}>{texte}</div>;
}

/** Illustration carrée qui prend la hauteur de son conteneur (au plus `max` px, et au plus `largeurMax` px de large : le dessin reste centré). */
export function IllustrationCouverture({ id, max, largeurMax, surOrange = false }: { id: IdIllustration; max: number; largeurMax?: number; surOrange?: boolean }) {
  return (
    <div style={{ flex: "none", height: "100%", maxHeight: max, aspectRatio: "1", maxWidth: largeurMax }}>
      <Scene id={id} taille="100%" couleurs={surOrange ? DESSIN_SUR_ORANGE : undefined} />
    </div>
  );
}

/** Pied de couverture : marque « Axion-IA », points de position, flèche. */
export function PiedCouverture({ index, total, surOrange = false }: { index: number; total: number; surOrange?: boolean }) {
  return (
    <div style={{ flex: "none", height: PAGE.hauteurPied }}>
      <Swipe index={index} total={total} surOrange={surOrange} signature={TEXTES_FIXES.signature} />
    </div>
  );
}
