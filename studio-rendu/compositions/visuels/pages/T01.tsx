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
  /** Retraits (px) du haut et du bas de la page : ceux du cadre du réseau (H2), la marge habituelle sinon. */
  retrait?: { haut: number; bas: number };
}

/** Hauteur maximale (px) du titre : le bloc orange garde au moins `BLOC_MIN` px. */
const HAUTEUR_TITRE = 600;
const BLOC_MIN = 380;
const ILLUSTRATION_MAX = 500;
const SANS_CADRE = { haut: MARGE, bas: MARGE };
/**
 * Dans un cadre, le titre descend encore de `BOITE_LIGNE` px sous le retrait du haut : la boîte d'une ligne de capitales dépasse l'encre
 * d'environ 0,12 em (26 px au plus grand corps), et c'est elle que la mesure compare aux zones interdites (pastille du titre LinkedIn).
 */
const BOITE_LIGNE = 32;

/**
 * T01 — couverture, variante A (style C typographique) : titre géant en capitales en haut (dernière ligne orange), filet ; dessous, un bloc
 * orange à fond perdu qui porte le sous-titre et l'illustration du sujet (banque I01…I12), et le pied. Jamais de tiers vide : le bloc prend
 * toute la place laissée par le titre. Dans un cadre (H2), le retrait du haut se prend sur le titre, celui du bas sur le bloc (qui garde sa
 * hauteur utile).
 */
export function T01({ titre, sousTitre, index, total, retrait = SANS_CADRE }: Proprietes) {
  const illustration = illustrationCouverture("T01", titre, sousTitre);
  const haut = retrait.haut > MARGE ? retrait.haut + BOITE_LIGNE : MARGE;
  const hauteurTitre = HAUTEUR_TITRE - (haut - MARGE);
  return (
    <AbsoluteFill style={{ background: COULEURS.creme }}>
      <div style={{ flex: "none", padding: `${haut}px ${MARGE}px 0` }}>
        <Zone libelle="T01 : titre" style={{ maxHeight: hauteurTitre + 16, width: LARGEUR_TEXTE }}>
          <Titre texte={titre} maxLignes={4} hauteurMax={hauteurTitre} largeur={LARGEUR_TITRE_BORNE} min={TITRE_MIN_COUVERTURE} max={TITRE_MAX_COUVERTURE} grand accent />
        </Zone>
        <Filet style={{ marginTop: 28 }} />
      </div>
      <div style={{ flex: 1, minHeight: BLOC_MIN + (retrait.bas - MARGE), marginTop: 48, background: COULEURS.orange, display: "flex", flexDirection: "column", padding: `48px ${MARGE}px ${retrait.bas}px` }}>
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
