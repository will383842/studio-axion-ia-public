import React from "react";
/**
 * ÉLÉMENT 36 `ElementBarre` (standard DA v4, lot 5). Ce qu'on raye : étiquettes (« UNE AGENCE », « 2 000 € ») ou rangée de 10 pictogrammes
 * de personnes (silhouettes ENCRE sur pastille, jamais de visage), barrés d'un trait tracé en 5 i à -8°.
 * Gabarit M1 (prise à D1, objet y 0,02 → 0,185 H). Déroulé (i0 = 1er mot dit) : objet en E-POP · au mot de négation, trait tracé en 5 i (palette A :
 * trait ACCENT_2 de 12 px + contour ENCRE 3 px ; palette B : trait ENCRE de 12 px) puis l'objet passe GRIS en 3 i · option : étiquette ACCENT_1
 * « 1 HEURE » en CLAQUE par-dessus (les étiquettes barrées rétrécissent). Sortie S-RETRECIT 3 i. Durée 1-1,8 s.
 * Son : `feutre` au trait (le « feutre rapide » de la fiche) + `select` discret à chaque pop.
 */
import { Easing } from "remotion";
import { accents, Bruitage, courbe, COULEURS, FPS, H, largeurTexte, melange, gestesDeVie, Palette, Plaque, Pose, ressort, tick, W } from "./commun-lot5";

export const ID_ELEMENT_BARRE = "element-barre";
export const DUREE_ELEMENT_BARRE = 54;
const SORTIE = 3;

export type ElementBarreProps = {
  frame: number; debut: number; palette: Palette;
  variante?: "etiquette" | "pictos";
  /** Étiquettes (variante « etiquette ») : 1 ou 2 textes dits. */
  textes?: string[];
  /** Images (relatives) d'apparition de chaque étiquette. */
  iApparitions?: number[];
  /** Image (relative) du mot de négation : début du trait. */
  iBarre?: number;
  /** Étiquette finale ACCENT_1 (ex. « 1 HEURE ») et son image d'arrivée (relative). */
  resultat?: { texte: string; i: number };
  duree?: number;
};

/** Trait barré : tourne autour de son CENTRE (rot), se trace de gauche à droite (p). ENCRE 14 px + liseré IVOIRE_CLAIR 3 px : visible sur clair comme sur sombre. */
function Trait({ largeur, p, rot }: { largeur: number; palette?: Palette; p: number; rot: number }) {
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: largeur, height: 14, marginLeft: -largeur / 2, marginTop: -7, transform: `rotate(${rot}deg)`, transformOrigin: "center center" }}>
      <div style={{ width: "100%", height: "100%", background: COULEURS.ENCRE, boxShadow: `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}`, borderRadius: 7, transform: `scaleX(${p})`, transformOrigin: "left center", opacity: p > 0 ? 1 : 0 }} />
    </div>
  );
}

function Silhouette({ fond }: { fond: string }) {
  return (
    <div style={{ width: 84, height: 84, borderRadius: 999, boxSizing: "border-box", background: fond, border: `${4}px solid ${COULEURS.ENCRE}`, boxShadow: `4px 5px 0 0 ${COULEURS.ENCRE}`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 28, top: 13, width: 24, height: 24, borderRadius: 999, background: COULEURS.ENCRE }} />
      <div style={{ position: "absolute", left: 14, top: 42, width: 52, height: 40, borderRadius: "26px 26px 0 0", background: COULEURS.ENCRE }} />
    </div>
  );
}

export function ElementBarre({ frame, debut, palette, variante = "etiquette", textes = ["UNE AGENCE", "2 000 €"], iApparitions = [0, 8], iBarre = 24, resultat, duree = DUREE_ELEMENT_BARRE }: ElementBarreProps) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const i = frame - debut;
  if (i < 0 || i >= duree) return null;
  const kS = i - (duree - SORTIE);
  const sortie = kS >= 0 ? 1 - courbe(kS + 1, 0, 3, Easing.in(Easing.back(1.6))) : 1;
  const iRes = resultat ? resultat.i : 9999;
  const retraitEtiquettes = i >= iRes ? 1 - courbe(i, iRes, 3, Easing.in(Easing.back(1.6))) : 1;

  if (variante === "pictos") {
    const n = 10;
    const pas = 94;
    const xs = Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * pas);
    const traitP = courbe(i, iBarre, 5, Easing.out(Easing.cubic));
    const gris = courbe(i, iBarre + 5, 3);
    return (
      <Pose x={W / 2} y={0.105 * H} echelle={Math.max(0, sortie)} z={50}>
        <div style={{ position: "relative", width: n * pas, height: 90, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {xs.map((x, k) => {
            const pop = 0.3 + 0.7 * ressort("POP", i - iApparitions[0] - k);
            if (i - iApparitions[0] - k < 0) return null;
            return <div key={k} style={{ position: "absolute", left: (n * pas) / 2 + x - 42, top: 3, transform: `scale(${pop * tick(i - iApparitions[0] - k, 8, k)}) rotate(${(k % 2 ? 1 : -1) * 2}deg)` }}><Silhouette fond={melange(COULEURS.BLANC, COULEURS.GRIS, gris)} /></div>;
          })}
          <Trait largeur={n * pas * 1.02} p={traitP} rot={-4} />
        </div>
      </Pose>
    );
  }

  const corps = 72;
  const lignes = textes.map((txt, k) => {
    const k0 = i - iApparitions[k];
    if (k0 < 0) return null;
    const largeur = largeurTexte(txt, corps) + 0.6 * corps + 10;
    const traitP = courbe(i, iBarre + 5 * k, 5, Easing.out(Easing.cubic));
    const gris = courbe(i, iBarre + 5 * k + 5, 3);
    const e = (0.3 + 0.7 * ressort("POP", k0)) * retraitEtiquettes * sortie * tick(k0, 8, 6 * k);
    const fondBase = k === 0 ? COULEURS.BLANC : ACCENT_2; // le montant : plaque ACCENT_2 (règle des chiffres)
    return (
      <Pose key={k} x={W / 2 + (k === 0 ? -30 : 40)} y={(0.077 + 0.066 * k) * H} rotation={(k === 0 ? -3 : 2) + (k0 < 6 ? -6 * (1 - ressort("POP", k0)) : 0)} echelle={Math.max(0, e)} opacite={Math.min(1, k0 / 2)}>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plaque texte={txt} fond={melange(fondBase, COULEURS.GRIS, gris)} corps={corps} />
          <Trait largeur={largeur * 1.12} p={traitP} rot={-8} />
        </div>
      </Pose>
    );
  });
  const kR = i - iRes;
  return (
    <>
      {lignes}
      {resultat && kR >= 0 ? (
        <Pose x={W / 2 + 20} y={0.105 * H} rotation={-3} echelle={Math.max(0, (1.4 - 0.4 * ressort("CLAQUE", kR)) * sortie * tick(kR, 10))} z={60}>
          <Plaque texte={resultat.texte} fond={ACCENT_1} corps={92} ombre="M" />
        </Pose>
      ) : null}
    </>
  );
}

export function bruitagesElementBarre(debut: number, iApparitions = [0, 8], iBarre = 24, iRes?: number): Bruitage[] {
  const t = (i: number) => (debut + i) / FPS;
  return [
    [t(iApparitions[0]), "select_002", 0.3],
    [t(iApparitions[1] ?? 0), "select_001", 0.3],
    [t(iBarre), "feutre", 0.7],
    ...(iRes !== undefined ? ([[t(iRes), "drop_003", 0.5]] as Bruitage[]) : []),
  ];
}
export const evenementsElementBarre = (d: number, iApp = [0, 8], iBarre = 24, iRes?: number, duree = DUREE_ELEMENT_BARRE) => [
  ...iApp.map((x) => d + x), d + iBarre, d + iBarre + 5, d + iBarre + 10, ...(iRes !== undefined ? [d + iRes] : []),
  // gestes de vie : pulsation des étiquettes avant le trait, du résultat après son arrivée
  ...gestesDeVie(iApp[0] + 8, iRes ?? duree - SORTIE).map((x) => d + x), ...(iRes !== undefined ? gestesDeVie(iRes + 8, duree - SORTIE).map((x) => d + x) : []),
  d + duree - SORTIE];
/** Rangée de pictogrammes : pops en cascade (1 i d'écart, 10 i), pulsation en vague toutes les 12 i, trait, passage au gris. */
export const evenementsPictos = (d: number, iBarre: number, duree: number) => [
  d, d + 5, d + 10, ...gestesDeVie(14, iBarre).map((x) => d + x), d + iBarre, d + iBarre + 5, d + iBarre + 8,
  ...gestesDeVie(iBarre + 8, duree - SORTIE).map((x) => d + x), d + duree - SORTIE];
