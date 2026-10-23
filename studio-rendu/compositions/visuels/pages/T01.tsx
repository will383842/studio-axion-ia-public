import { AbsoluteFill } from "remotion";
import { Annotation } from "../commun/Annotation";
import { Badge } from "../commun/Badge";
import { BORD_DROIT_TEXTE, COULEURS, FORMAT, LARGEUR_TEXTE, LARGEUR_TITRE_BORNE, MARGE, TITRE_MIN_COUVERTURE } from "../commun/constantes";
import { Swipe } from "../commun/Swipe";
import { Titre } from "../commun/Titre";

interface Proprietes {
  titre: string;
  sousTitre?: string;
  index: number;
  total: number;
}

const HAUTEUR_PIED = 56;
const HAUTEUR_BADGE = 150;

/** T01 — couverture, variante A : grand titre sur toute la largeur, dernière ligne en orange, trait, sous-titre, repère de défilement. */
export function T01({ titre, sousTitre, index, total }: Proprietes) {
  const hauteurTitre = FORMAT.hauteur - 2 * MARGE - HAUTEUR_PIED - HAUTEUR_BADGE - 80;
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36 }}>
        <Titre texte={titre} maxLignes={4} hauteurMax={hauteurTitre} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_COUVERTURE} accent />
        <Annotation largeur={LARGEUR_TEXTE / 2} />
        {sousTitre && <Badge texte={sousTitre} largeurMax={BORD_DROIT_TEXTE - MARGE} />}
      </div>
      <Swipe index={index} total={total} />
    </AbsoluteFill>
  );
}
