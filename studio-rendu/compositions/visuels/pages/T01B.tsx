import { AbsoluteFill } from "remotion";
import { illustrationCouverture } from "../../../../src/briques/visuels/choix-illustration";
import { Zone } from "../commun/controle-debordement";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE_BAS, MARGE, TITRE_MAX_COUVERTURE, TITRE_MIN_COUVERTURE } from "../commun/constantes";
import { IllustrationCouverture, PiedCouverture, SousTitre } from "../commun/Couverture";
import { Titre } from "../commun/Titre";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";

interface Proprietes {
  titre: string;
  sousTitre?: string;
  index: number;
  total: number;
}

const HAUTEUR_TITRE = 470;
const ILLUSTRATION_MAX = 560;

/**
 * T01B — couverture, variante B (style C, demi-page) : bloc orange à fond perdu en haut, qui porte l'illustration du sujet (banque I01…I12) ;
 * dessous, sur la crème, le titre géant en capitales (dernière ligne orange) et le sous-titre. Le bloc prend la place laissée par le texte :
 * jamais d'aplat vide, jamais de forme sans sens.
 */
export function T01B({ titre, sousTitre, index, total }: Proprietes) {
  const illustration = illustrationCouverture("T01B", titre, sousTitre);
  return (
    <AbsoluteFill style={{ background: COULEURS.creme }}>
      <div style={{ flex: 1, minHeight: 400, background: COULEURS.orange, display: "flex", alignItems: "center", justifyContent: "center", padding: `${MARGE}px ${MARGE}px 48px` }}>
        <IllustrationCouverture id={illustration} max={ILLUSTRATION_MAX} surOrange />
      </div>
      <div style={{ flex: "none", padding: `48px ${MARGE}px ${MARGE}px`, display: "flex", flexDirection: "column" }}>
        <Zone libelle="T01B : texte" style={{ maxHeight: 740, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", gap: 28 }}>
          <Titre texte={titre} maxLignes={3} hauteurMax={HAUTEUR_TITRE} largeur={LARGEUR_TITRE_BAS} min={TITRE_MIN_COUVERTURE} max={TITRE_MAX_COUVERTURE} grand accent />
          {sousTitre && <SousTitre texte={sousTitre} largeurMax={BORD_DROIT_TEXTE_BAS - MARGE} />}
        </Zone>
        <div style={{ marginTop: 32 }}>
          <PiedCouverture index={index} total={total} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
