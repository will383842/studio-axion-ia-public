import { AbsoluteFill } from "remotion";
import { illustrationCouverture } from "../../../../src/briques/visuels/choix-illustration";
import { Zone } from "../commun/controle-debordement";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE_BORNE, MARGE, TITRE_MAX_COUVERTURE, TITRE_MIN_COUVERTURE } from "../commun/constantes";
import { IllustrationCouverture, PiedCouverture, SousTitre } from "../commun/Couverture";
import { Filet } from "../commun/editorial";
import { Titre } from "../commun/Titre";
import { largeurTexteMax } from "../commun/zones";

interface Proprietes {
  titre: string;
  sousTitre?: string;
  index: number;
  total: number;
}

/** Hauteur maximale (px) du titre : le bloc orange garde au moins `BLOC_MIN` px. */
const HAUTEUR_TITRE = 600;
const BLOC_MIN = 380;
const ILLUSTRATION_MAX = 500;

/**
 * T01 — couverture, variante A (style C typographique) : titre géant en capitales en haut (dernière ligne orange), filet ; dessous, un bloc
 * orange à fond perdu qui porte le sous-titre et l'illustration du sujet (banque I01…I12), et le pied. Jamais de tiers vide : le bloc prend
 * toute la place laissée par le titre.
 */
export function T01({ titre, sousTitre, index, total }: Proprietes) {
  const illustration = illustrationCouverture("T01", titre, sousTitre);
  return (
    <AbsoluteFill style={{ background: COULEURS.creme }}>
      <div style={{ flex: "none", padding: `${MARGE}px ${MARGE}px 0` }}>
        <Zone libelle="T01 : titre" style={{ maxHeight: HAUTEUR_TITRE + 16, width: LARGEUR_TEXTE }}>
          <Titre texte={titre} maxLignes={4} hauteurMax={HAUTEUR_TITRE} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_COUVERTURE} max={TITRE_MAX_COUVERTURE} grand accent />
        </Zone>
        <Filet style={{ marginTop: 28 }} />
      </div>
      <div style={{ flex: 1, minHeight: BLOC_MIN, marginTop: 48, background: COULEURS.orange, display: "flex", flexDirection: "column", padding: `48px ${MARGE}px ${MARGE}px` }}>
        <Zone libelle="T01 : bloc" style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: sousTitre ? "space-between" : "center", gap: 40 }}>
          {sousTitre && <SousTitre texte={sousTitre} largeurMax={Math.min(440, largeurTexteMax(MARGE))} />}
          <IllustrationCouverture id={illustration} max={ILLUSTRATION_MAX} largeurMax={sousTitre ? LARGEUR_TEXTE - 440 - 40 : undefined} surOrange />
        </Zone>
        <div style={{ marginTop: 24 }}>
          <PiedCouverture index={index} total={total} surOrange />
        </div>
      </div>
    </AbsoluteFill>
  );
}
