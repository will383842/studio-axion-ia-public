import { AbsoluteFill } from "remotion";
import { TEXTES_FIXES } from "../../../../src/briques/visuels/textes-fixes";
import { typographieFrancaise } from "../../../../src/briques/visuels/typographie-francaise";
import { couperPhrase } from "../../../../src/briques/visuels/variante-t21";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE_BORNE, MARGE, PAGE, POLICE_CORPS, TITRE_MAX_COUVERTURE } from "../commun/constantes";
import { Zone } from "../commun/controle-debordement";
import { Dessin } from "../commun/Picto";
import type { SpecVisuel } from "../commun/types";
import { Swipe } from "../commun/Swipe";
import { Titre } from "../commun/Titre";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  index: number;
  total: number;
  variante?: VarianteT21;
}

/** Mises en page de la dernière page (tour 2) : bulle pleine orange, bulle au contour crème avec trois points, typographique (phrase en grand). */
export const VARIANTES_T21 = ["bulle-pleine", "bulle-points", "typographique"] as const;
export type VarianteT21 = (typeof VARIANTES_T21)[number];

/**
 * Variante de la dernière page d'après le SUJET du carrousel (titre de la couverture, empreinte FNV-1a) : deux carrousels différents n'ont pas
 * forcément la même dernière page, le même carrousel a toujours la même. Fonction PURE.
 */
export function varianteFin(spec: SpecVisuel): VarianteT21 {
  const couverture = spec.pages[0];
  const sujet = couverture && "titre" in couverture ? couverture.titre : spec.alt;
  let h = 0x811c9dc5;
  for (const c of sujet) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  return VARIANTES_T21[h % VARIANTES_T21.length];
}

/** Bulle de discussion (viewBox 120 × 104) : rectangle arrondi et queue en bas à gauche ; trois points au centre (« on vous écrit »). */
const CHEMIN_BULLE = "M22 4 H98 A18 18 0 0 1 116 22 V62 A18 18 0 0 1 98 80 H50 L26 100 L30 80 H22 A18 18 0 0 1 4 62 V22 A18 18 0 0 1 22 4 Z";
const TROIS_POINTS = [38, 60, 82] as const;
const LARGEUR_BULLE = 340;

/** Bulle NETTE dessinée sur place : pleine orange (points crème), ou contour crème épais (points orange). */
function Bulle({ pleine }: { pleine: boolean }) {
  return (
    <Dessin nom="bulle">
      <svg width={LARGEUR_BULLE} height={(LARGEUR_BULLE * 104) / 120} viewBox="0 0 120 104" role="img" aria-hidden style={{ display: "block" }}>
        <path d={CHEMIN_BULLE} fill={pleine ? COULEURS.orange : "none"} stroke={pleine ? "none" : COULEURS.creme} strokeWidth={6} strokeLinejoin="round" />
        {TROIS_POINTS.map((x) => (
          <circle key={x} cx={x} cy={42} r={7.5} fill={pleine ? COULEURS.creme : COULEURS.orange} />
        ))}
      </svg>
    </Dessin>
  );
}

/** Taille de la phrase en grand : celle validée en rendu réel et mise en ligne le 24/10 (fin de phrase orange, aucune ligne hors colonne). */
const TAILLE_PHRASE = 116;

/**
 * Variante typographique : la phrase d'invitation en grand, sans dessin (aucun rond) ; la fin de phrase en orange (`couperPhrase`, avec ou
 * sans « : »). Bornée au bord du compteur de Meta : la phrase descend sous y = 1080.
 */
function PhraseEnGrand() {
  const { debut, fin } = couperPhrase(TEXTES_FIXES.t21Ligne);
  return (
    <div style={{ maxWidth: largeurTexteMax(MARGE, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLE_PHRASE, lineHeight: 1.1, letterSpacing: -1.5, textWrap: "balance", color: COULEURS.creme }}>
      {debut && `${typographieFrancaise(debut)} `}
      <span style={{ color: COULEURS.orange }}>{fin}</span>
    </div>
  );
}

const TAILLE_LIGNE = 46;

/**
 * T21 — DERNIÈRE page, seule page sombre (fond encre), style TYPOGRAPHIQUE (C, ART-1) : l'appel en capitales géantes (crème, dernière ligne
 * orange), puis une bulle de discussion NETTE dessinée sur place (pleine, ou au contour avec trois points) et la ligne d'invitation sous un
 * filet orange ou, en variante typographique, la phrase d'invitation seule en grand sous le filet ; la marque « Axion-IA » en pied, discrète.
 * Tout le texte est posé par le code (`textes-fixes.ts`) : aucun lien, aucun nom, aucun mot-clé d'appel.
 */
export function T21({ index, total, variante = "bulle-pleine" }: Proprietes) {
  const typographique = variante === "typographique";
  chargerPoliceInter();
  return (
    <AbsoluteFill style={{ background: COULEURS.encre, padding: MARGE, boxSizing: "border-box" }}>
      <Zone libelle="T21 : corps" style={{ flex: 1, minHeight: 0, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", justifyContent: "space-between", marginBottom: PAGE.ecart }}>
        <Titre texte={TEXTES_FIXES.t21Titre} maxLignes={4} hauteurMax={560} couleur={COULEURS.creme} largeur={LARGEUR_TITRE_BORNE} max={TITRE_MAX_COUVERTURE} grand accent />
        {typographique ? null : (
          <div style={{ alignSelf: "center" }}>
            <Bulle pleine={variante === "bulle-pleine"} />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ width: 120, height: 6, background: COULEURS.orange }} />
          {typographique ? (
            <PhraseEnGrand />
          ) : (
            <div style={{ maxWidth: largeurTexteMax(MARGE, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLE_LIGNE, lineHeight: 1.25, color: COULEURS.creme }}>{TEXTES_FIXES.t21Ligne}</div>
          )}
        </div>
      </Zone>
      <div style={{ flex: "none", height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} sombre signature={TEXTES_FIXES.signature} />
      </div>
    </AbsoluteFill>
  );
}
