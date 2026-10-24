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
  /** Retraits (px) du haut et du bas de la page : ceux du cadre du réseau (H2), la marge habituelle sinon. */
  retrait?: { haut: number; bas: number };
}

const HAUTEUR_TITRE = 470;
const ILLUSTRATION_MAX = 560;
const HAUTEUR_TEXTE = 740;
const BLOC_MIN = 400;
const SANS_CADRE = { haut: MARGE, bas: MARGE };

/**
 * T01B — couverture, variante B (style C, demi-page) : bloc orange à fond perdu en haut, qui porte l'illustration du sujet (banque I01…I12) ;
 * dessous, sur la crème, le titre géant en capitales (dernière ligne orange) et le sous-titre. Le bloc prend la place laissée par le texte :
 * jamais d'aplat vide, jamais de forme sans sens. Dans un cadre (H2), le bloc garde sa hauteur utile sous le retrait du haut ; les deux
 * retraits se prennent sur le texte.
 */
export function T01B({ titre, sousTitre, index, total, retrait = SANS_CADRE }: Proprietes) {
  const illustration = illustrationCouverture("T01B", titre, sousTitre);
  const ecart = retrait.haut - MARGE + (retrait.bas - MARGE);
  return (
    <AbsoluteFill style={{ background: COULEURS.creme }}>
      <div style={{ flex: 1, minHeight: BLOC_MIN + (retrait.haut - MARGE), background: COULEURS.orange, display: "flex", alignItems: "center", justifyContent: "center", padding: `${retrait.haut}px ${MARGE}px 48px` }}>
        <IllustrationCouverture id={illustration} max={ILLUSTRATION_MAX} surOrange />
      </div>
      <div style={{ flex: "none", padding: `48px ${MARGE}px ${retrait.bas}px`, display: "flex", flexDirection: "column" }}>
        <Zone libelle="T01B : texte" style={{ maxHeight: HAUTEUR_TEXTE - ecart, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", gap: 28 }}>
          <Titre texte={titre} maxLignes={3} hauteurMax={HAUTEUR_TITRE - ecart} largeur={LARGEUR_TITRE_BAS} min={TITRE_MIN_COUVERTURE} max={TITRE_MAX_COUVERTURE} grand accent />
          {sousTitre && <SousTitre texte={sousTitre} largeurMax={BORD_DROIT_TEXTE_BAS - MARGE} />}
        </Zone>
        <div style={{ marginTop: 32 }}>
          <PiedCouverture index={index} total={total} />
        </div>
      </div>
    </AbsoluteFill>
  );
}
