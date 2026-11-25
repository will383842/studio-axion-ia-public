/**
 * PLANCHE « CONTOURS » (PLANCHE-CONTOURS-a-v21r) : les 4 gabarits de sous-titres (Karaoké, Minimal, Impact, Bandeau) sur 3 fonds
 * (clair, sombre, illustration claire) pour 3 variantes de contour (V0 actuel, V1, V2 avec ombre douce). Williams répond V0, V1 ou V2.
 * Outil local, composant pur (aucun hook, aucune horloge, aucun hasard) : chaque ligne est dessinée par `cssElement` du Studio,
 * jamais par un style écrit à la main. Rien n'importe ce fichier depuis `src/` ni `studio-rendu/`. Rien n'est changé dans la vidéo.
 */
import { createElement, type JSX } from "react";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { COULEURS_REPLI, GABARITS, type DefinitionGabarit } from "../../src/briques/sous-titres/style";
import { cssElement, type ElementDessine } from "../../src/briques/sous-titres/scene";
import type { GabaritRendu } from "../../src/briques/sous-titres/types-rendu";

export type NomVariante = "V0" | "V1" | "V2";
export type NomFond = "clair" | "sombre" | "illustration-claire";
export type FormatPlanche = "9x16" | "16x9";
export interface ReglageContour {
  contourPx: number;
  ombre: { flouPx: number; decalagePx: number; opacite: number };
}

export const NOMS_VARIANTES: readonly NomVariante[] = ["V0", "V1", "V2"];
export const GABARITS_PLANCHE: readonly GabaritRendu[] = ["karaoke", "minimal", "impact", "bandeau"];
export const FONDS_PLANCHE: readonly NomFond[] = ["clair", "sombre", "illustration-claire"];
export const PHRASE_PLANCHE = "Ton droit reste gratuit";
/** Contours proposés (Q3) pour Karaoké et Impact ; Minimal et Bandeau restent à 0. */
const CONTOURS_PROPOSES: Record<"V1" | "V2", { karaoke: number; impact: number }> = { V1: { karaoke: 4, impact: 10 }, V2: { karaoke: 3, impact: 8 } };

function reglage(variante: NomVariante, g: GabaritRendu): ReglageContour {
  const actuel = GABARITS[g];
  if (variante === "V0" || actuel.contourPx === 0) return { contourPx: actuel.contourPx, ombre: { ...actuel.ombre } };
  const contourPx = CONTOURS_PROPOSES[variante][g as "karaoke" | "impact"];
  if (variante === "V1") return { contourPx, ombre: { ...actuel.ombre } };
  // V2 : ombre douce = flou × 1,3, opacité − 0,1.
  return { contourPx, ombre: { ...actuel.ombre, flouPx: actuel.ombre.flouPx * 1.3, opacite: Math.round((actuel.ombre.opacite - 0.1) * 100) / 100 } };
}

/** V0 = valeurs de `GABARITS` LUES (jamais recopiées) ; V1 et V2 = propositions de la conception. */
export const VARIANTES_CONTOUR: Record<NomVariante, Record<GabaritRendu, ReglageContour>> = Object.fromEntries(
  NOMS_VARIANTES.map((v) => [v, Object.fromEntries(GABARITS_PLANCHE.map((g) => [g, reglage(v, g)]))]),
) as Record<NomVariante, Record<GabaritRendu, ReglageContour>>;

export interface CaseContour {
  variante: NomVariante;
  gabarit: GabaritRendu;
  fond: NomFond;
}
/** 4 gabarits × 3 fonds × 3 variantes = 36 cases, sans doublon. */
export function casesContours(): CaseContour[] {
  const cases: CaseContour[] = [];
  for (const variante of NOMS_VARIANTES) for (const gabarit of GABARITS_PLANCHE) for (const fond of FONDS_PLANCHE) cases.push({ variante, gabarit, fond });
  return cases;
}

const DIMENSIONS: Record<FormatPlanche, { largeur: number; hauteur: number }> = { "9x16": { largeur: 1080, hauteur: 1920 }, "16x9": { largeur: 1920, hauteur: 1080 } };
export const DIMENSIONS_PLANCHE = DIMENSIONS;

const FOND_CSS: Record<NomFond, string> = {
  clair: PALETTE.ivoire,
  sombre: PALETTE.noir,
  "illustration-claire": `linear-gradient(160deg, ${PALETTE.blanc} 0%, ${PALETTE.gris} 55%, ${PALETTE.ivoire} 100%)`,
};

function ligneDe(g: GabaritRendu, c: ReglageContour, taillePx: number): ElementDessine {
  const gabarit: DefinitionGabarit = { ...GABARITS[g], contourPx: c.contourPx, ombre: c.ombre };
  // Bandeau : rectangle crème, texte noir (comme `scene.ts`) ; les autres gabarits : texte crème.
  const couleur = gabarit.bandeau ? COULEURS_REPLI.contour : COULEURS_REPLI.texte;
  const mots = PHRASE_PLANCHE.split(" ").map((texte) => ({ texte, couleur, opacite: 1, souligne: 0 }));
  return {
    cle: `planche-${g}`,
    gabarit,
    police: gabarit.police,
    taillePx,
    yPx: 0,
    rotationDeg: 0,
    echelle: 1,
    opacite: 1,
    decalageYPx: 0,
    espacePx: gabarit.espaceMotsEm * taillePx,
    mots,
    couleurSoulignement: COULEURS_REPLI.accent,
    ...(gabarit.bandeau ? { fond: { couleur: PALETTE.ivoire, margeXPx: gabarit.bandeau.margeXEm * taillePx, margeYPx: gabarit.bandeau.margeYEm * taillePx } } : {}),
  };
}

export function PlancheContours({ variante, format = "9x16" }: { variante: NomVariante; format?: FormatPlanche }): JSX.Element {
  const h = createElement;
  const dim = DIMENSIONS[format];
  const couleurs = COULEURS_REPLI;
  const colonnes = format === "9x16" ? 1 : 2;
  const cases = FONDS_PLANCHE.map((fond) =>
    h(
      "div",
      { key: fond, "data-fond": fond, style: { background: FOND_CSS[fond], position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", overflow: "hidden" } },
      GABARITS_PLANCHE.map((g) => {
        const el = ligneDe(g, VARIANTES_CONTOUR[variante][g], GABARITS[g].taillePx * (format === "9x16" ? 0.62 : 0.5));
        const css = cssElement(el, { couleurs, largeur: dim.largeur, facteurOmbre: 1, echelleTexte: 1, encre: false }, FAMILLE_CSS_AXION);
        return h(
          "div",
          { key: g, "data-gabarit": g, style: { position: "relative", display: "flex", justifyContent: "center", width: "100%" } },
          h("div", { style: { ...css.ligne } }, el.mots.map((m, i) => h("span", { key: i, style: css.mot(i) }, m.texte))),
        );
      }),
    ),
  );
  const legende = h("div", { key: "legende", style: { position: "absolute", left: 24, top: 16, fontFamily: FAMILLE_CSS_AXION, fontSize: 30, fontWeight: 700, color: PALETTE.terracotta } }, legendeDe(variante));
  return h(
    "div",
    { style: { position: "relative", width: dim.largeur, height: dim.hauteur, overflow: "hidden", background: PALETTE.ivoire } },
    h("div", { style: { position: "absolute", inset: 0, display: "grid", gridTemplateColumns: colonnes === 1 ? "1fr" : "1fr 1fr 1fr", gridTemplateRows: colonnes === 1 ? "1fr 1fr 1fr" : "1fr" } }, cases),
    legende,
  );
}

/** Légende fixe : « Vn · contour N px » (Karaoké / Impact). */
export function legendeDe(variante: NomVariante): string {
  const v = VARIANTES_CONTOUR[variante];
  return `${variante} · contour ${v.karaoke.contourPx} px / ${v.impact.contourPx} px`;
}
