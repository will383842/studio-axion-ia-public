/**
 * PLANCHE « SOUS-TITRES RÉELS » (FIX-MINIMAL-FOND-CLAIR-v21s) : les gabarits de sous-titres sur 3 fonds, dessinés par le VRAI moteur
 * (`donneesCalque` → `sceneAuTemps` → `cssElement`) avec la police réellement chargée par le rendu (`familles`), jamais une police de secours.
 * Sur fond clair, le facteur d'ombre est celui qu'aurait un décor clair connu ; sur fond sombre, 1.
 * Outil local, composant pur (aucun hook, aucune horloge, aucun hasard). Rien n'importe ce fichier depuis `src/` ni `studio-rendu/`.
 */
import { createElement, type JSX } from "react";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { donneesCalque } from "../../src/briques/sous-titres";
import { cssElement, sceneAuTemps } from "../../src/briques/sous-titres/scene";
import { COULEURS_REPLI } from "../../src/briques/sous-titres/style";
import type { GabaritRendu } from "../../src/briques/sous-titres/types-rendu";
import type { SegmentSousTitres } from "../../src/domaine/types";

export type NomFondReel = "clair" | "sombre" | "illustration-claire";
export type FormatPlancheReelle = "9x16" | "16x9";

/** Fonds de la planche : couleurs lues dans la charte. */
export const FONDS_REELS: Record<NomFondReel, string> = {
  clair: PALETTE.ivoire,
  sombre: PALETTE.noir,
  "illustration-claire": `linear-gradient(160deg, ${PALETTE.blanc} 0%, ${PALETTE.gris} 55%, ${PALETTE.ivoire} 100%)`,
};
export const NOMS_FONDS_REELS = Object.keys(FONDS_REELS) as NomFondReel[];
export const DIMENSIONS_REELLES: Record<FormatPlancheReelle, { largeur: number; hauteur: number }> = { "9x16": { largeur: 1080, hauteur: 1920 }, "16x9": { largeur: 1920, hauteur: 1080 } };

/** Un groupe de la phrase, mots répartis sur 1 s ; le style du segment suit le gabarit (comme `tests/e2e1-moteur-05-sous-titres-fond-clair.test.ts`). */
function segmentDe(phrase: string, gabarit: GabaritRendu): SegmentSousTitres {
  const mots = phrase.split(" ").map((mot, i, tous) => ({ mot, debutSec: i / tous.length, finSec: (i + 1) / tous.length }));
  const style = gabarit === "impact" ? "impact" : gabarit === "bandeau" ? "bandeau" : "base";
  return { id: `planche-${gabarit}`, debutSec: 0, finSec: 1, mots, style, importance: 0, souligne: null, position: "auto", inclinaison: 0 } as SegmentSousTitres;
}

export interface DemandePlancheReelle {
  phrase: string;
  gabarits: readonly GabaritRendu[];
  /** Facteur d'ombre d'un décor clair (1 = fond inconnu, 2 = décor clair connu). */
  facteurOmbre: number;
  format: FormatPlancheReelle;
  /** Nom de police du moteur → famille CSS réellement chargée. */
  familles: Record<string, string>;
}

export function PlancheSousTitresReels({ phrase, gabarits, facteurOmbre, format, familles }: DemandePlancheReelle): JSX.Element {
  const h = createElement;
  const dim = DIMENSIONS_REELLES[format];
  const cases = NOMS_FONDS_REELS.map((fond) =>
    h(
      "div",
      { key: fond, "data-fond": fond, style: { background: FONDS_REELS[fond], position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", overflow: "hidden" } },
      gabarits.map((g) => {
        const base = g === "minimal" ? "minimal" : "karaoke";
        const segment = segmentDe(phrase, g);
        const d = { ...donneesCalque({ segments: [segment], base, couleurs: COULEURS_REPLI, ratio: format === "9x16" ? "9:16" : "16:9" }), facteurOmbre: fond === "sombre" ? 1 : facteurOmbre };
        const el = sceneAuTemps(d, 0.99);
        if (!el) return h("div", { key: g, "data-gabarit": g });
        const css = cssElement(el, d, familles[el.police] ?? el.police);
        return h(
          "div",
          { key: g, "data-gabarit": g, style: { position: "relative", display: "flex", justifyContent: "center", width: "100%" } },
          h("div", { style: { ...css.ligne } }, el.mots.map((m, i) => h("span", { key: i, style: css.mot(i) }, m.texte))),
        );
      }),
    ),
  );
  const legende = h("div", { key: "legende", style: { position: "absolute", left: 24, top: 16, fontFamily: familles["Manrope ExtraBold"] ?? "Manrope", fontSize: 30, color: PALETTE.terracotta } }, legendeReelle(gabarits, facteurOmbre));
  return h(
    "div",
    { style: { position: "relative", width: dim.largeur, height: dim.hauteur, overflow: "hidden", background: PALETTE.ivoire } },
    h("div", { style: { position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr 1fr 1fr" } }, cases),
    legende,
  );
}

/** Légende fixe : « <gabarits> · facteur d'ombre N ». */
export function legendeReelle(gabarits: readonly GabaritRendu[], facteurOmbre: number): string {
  return `${gabarits.join(", ")} · facteur d'ombre ${facteurOmbre}`;
}
