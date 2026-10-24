import { AbsoluteFill } from "remotion";
import { illustrationCouverture } from "../../../../src/briques/visuels/choix-illustration";
import { Zone } from "../commun/controle-debordement";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE_BORNE, MARGE, TITRE_MAX_COUVERTURE, TITRE_MIN_COUVERTURE } from "../commun/constantes";
import { IllustrationCouverture, PiedCouverture, SousTitre } from "../commun/Couverture";
import { Filet } from "../commun/editorial";
import { Titre } from "../commun/Titre";
import { BORD_DROIT_TEXTE_BAS } from "../commun/zones";

interface Proprietes {
  titre: string;
  sousTitre?: string;
  index: number;
  total: number;
}

const HAUTEUR_TITRE = 560;
const ILLUSTRATION_MAX = 500;
const ILLUSTRATION_MIN = 260;

/**
 * T01C — couverture, variante C (style C, grand bloc) : un bloc orange à fond perdu porte l'illustration du sujet (banque I01…I12), centrée, en
 * haut et, en bas, le titre géant en capitales à l'encre (encre sur orange : 5,4:1) ; sous le bloc, sur la crème, un filet, le sous-titre et
 * le pied. L'illustration prend la place laissée par le titre : jamais d'aplat vide.
 */
export function T01C({ titre, sousTitre, index, total }: Proprietes) {
  const illustration = illustrationCouverture("T01C", titre, sousTitre);
  return (
    <AbsoluteFill style={{ background: COULEURS.creme }}>
      <div style={{ flex: 1, minHeight: 0, background: COULEURS.orange, display: "flex", flexDirection: "column", padding: `${MARGE}px ${MARGE}px 48px` }}>
        <div style={{ flex: 1, minHeight: ILLUSTRATION_MIN, display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <IllustrationCouverture id={illustration} max={ILLUSTRATION_MAX} surOrange />
        </div>
        <Zone libelle="T01C : titre" style={{ flex: "none", maxHeight: HAUTEUR_TITRE + 16, width: LARGEUR_TEXTE }}>
          <Titre texte={titre} maxLignes={4} hauteurMax={HAUTEUR_TITRE} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_COUVERTURE} max={TITRE_MAX_COUVERTURE} grand />
        </Zone>
      </div>
      <div style={{ flex: "none", padding: `40px ${MARGE}px ${MARGE}px`, display: "flex", flexDirection: "column", gap: 28 }}>
        {sousTitre && (
          <Zone libelle="T01C : sous-titre" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <Filet style={{ width: 120, height: 6 }} />
            <SousTitre texte={sousTitre} largeurMax={BORD_DROIT_TEXTE_BAS - MARGE} />
          </Zone>
        )}
        <PiedCouverture index={index} total={total} />
      </div>
    </AbsoluteFill>
  );
}
