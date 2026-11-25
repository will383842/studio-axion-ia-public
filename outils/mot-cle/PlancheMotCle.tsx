/**
 * PLANCHE « MOT-CLÉ » (PLANCHE-MOT-CLE-v21n) : deux images fixes d'un mot-clé d'UN seul mot, en haut, sur une scène de cas concret
 * (fond, bande des sous-titres en bas) : style `etiquette` (taille 40) ou `bandeau` (taille 58), tailles de la pièce `legende`
 * (`src/briques/plan-scenes/controles.ts`, graisse 800, largeur 880). Outil local : composant pur (aucun hook, aucune horloge),
 * aucune lecture de réglage ; rien n'importe ce fichier depuis `src/` ni `studio-rendu/`. Texte en Manrope.
 * La planche rend la VRAIE pièce `legende` (composant pur, `Legende`) dans sa toile 1000×300 réduite dans la zone `haut`.
 */
import { createElement, type JSX } from "react";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { Legende } from "../../src/briques/plan-scenes/briques/Legende";
import { TOILES } from "../../src/briques/plan-scenes/toiles";
import { seChevauchent, ZONE_VISAGE, ZONES, type Rectangle } from "../../src/briques/plan-scenes/zones";
import { couleursMinimalDynamique, decouperMinimalDynamique, tailleTexteMinimale } from "../../src/briques/sous-titres/minimal-dynamique";
import type { SegmentRendu } from "../../src/briques/sous-titres/types-rendu";

export type StyleMotCle = "etiquette" | "bandeau";
export const STYLES_MOT_CLE: readonly StyleMotCle[] = ["etiquette", "bandeau"];
export const TAILLE_MOT_CLE: Record<StyleMotCle, number> = { etiquette: 40, bandeau: 58 };
export const MOT_CLE = "Devis";
export const LARGEUR_PLANCHE = 1080;
export const HAUTEUR_PLANCHE = 1920;
/** Largeur utile du texte dans la pièce : toile 1000 − 40 (maxWidth) − 2 × 44 (rembourrage du bandeau). */
const LARGEUR_MAX_TEXTE = 872;
/** Largeur moyenne d'une lettre en Manrope gras, en part du corps (mesure prudente par excès). */
const LARGEUR_LETTRE = 0.66;
/** Bande des sous-titres, en % de la hauteur (bas du cadre). */
export const BANDE_SOUS_TITRES: Rectangle = { x: 5, y: 66, largeur: 90, hauteur: 28 };
/** Image figée de la planche (fondu d'arrivée de la pièce terminé), fps et durée de la brique. */
export const IMAGE_PLANCHE = 28;
const FPS = 30;
const DUREE_IMAGES = 90;
/** Phrase dite (sous-titres rendus par les fonctions du Studio, style minimal dynamique). */
const SEGMENT_SOUS_TITRES: SegmentRendu = {
  id: "demo-mot-cle",
  debutSec: 0,
  finSec: 2,
  mots: ["Le", "devis", "part", "tout", "seul"].map((mot, i) => ({ mot, debutSec: i * 0.4, finSec: (i + 1) * 0.4, ...(mot === "devis" ? { enValeur: true } : {}) })),
};

export interface GeometrieMotCle {
  /** Boîte réelle de la pièce `legende` (toile 1000×300 mise à l'échelle dans la zone `haut`), en % du cadre. */
  boite: Rectangle;
  tailleTexte: number;
  largeurTextePx: number;
  motEntier: boolean;
  /** Échelle appliquée à la toile de la pièce pour qu'elle tienne dans la zone `haut`. */
  echelle: number;
}

/** Boîte de la pièce dans la zone `haut` : la toile de `legende` est réduite pour tenir, puis centrée dans la zone. */
export function geometrieMotCle(style: StyleMotCle, mot: string = MOT_CLE): GeometrieMotCle {
  const tailleTexte = TAILLE_MOT_CLE[style];
  const largeurTextePx = Math.round(mot.length * tailleTexte * LARGEUR_LETTRE);
  const zone = ZONES.haut;
  const toile = TOILES.legende;
  const zonePx = { largeur: (zone.largeur / 100) * LARGEUR_PLANCHE, hauteur: (zone.hauteur / 100) * HAUTEUR_PLANCHE };
  const echelle = Math.min(1, zonePx.largeur / toile.largeur, zonePx.hauteur / toile.hauteur);
  const largeurPct = ((toile.largeur * echelle) / LARGEUR_PLANCHE) * 100;
  const hauteurPct = ((toile.hauteur * echelle) / HAUTEUR_PLANCHE) * 100;
  const boite: Rectangle = { x: zone.x + (zone.largeur - largeurPct) / 2, y: zone.y + (zone.hauteur - hauteurPct) / 2, largeur: largeurPct, hauteur: hauteurPct };
  return { boite, tailleTexte, largeurTextePx, motEntier: largeurTextePx <= LARGEUR_MAX_TEXTE, echelle };
}

const pct = (n: number) => `${n}%`;

export function PlancheMotCle({ style }: { style: StyleMotCle }): JSX.Element {
  const g = geometrieMotCle(style);
  const h = createElement;
  const fond = h("div", { key: "fond", style: { position: "absolute", inset: 0, background: `linear-gradient(160deg, ${CHARTE_AXION.noir} 0%, #3a2f2a 100%)` } });
  // La VRAIE pièce `legende` (composant pur), dans sa toile 1000×300, réduite dans la zone `haut`.
  const motCle = h(
    "div",
    {
      key: "mot",
      "data-style": style,
      style: {
        position: "absolute",
        left: pct(g.boite.x),
        top: pct(g.boite.y),
        width: pct(g.boite.largeur),
        height: pct(g.boite.hauteur),
        overflow: "visible",
      },
    },
    h(
      "div",
      { style: { position: "absolute", left: 0, top: 0, width: TOILES.legende.largeur, height: TOILES.legende.hauteur, transform: `scale(${g.echelle})`, transformOrigin: "top left" } },
      h(Legende, { image: IMAGE_PLANCHE, fps: FPS, dureeImages: DUREE_IMAGES, fond: "noir", accent: "terracotta", parametres: { texte: MOT_CLE, sousTexte: "", style } }),
    ),
  );
  // Sous-titres : mêmes fonctions du Studio que la planche tendances (minimal dynamique).
  const groupes = decouperMinimalDynamique([SEGMENT_SOUS_TITRES]);
  const marque = couleursMinimalDynamique();
  const taille = Math.max(tailleTexteMinimale(HAUTEUR_PLANCHE * (BANDE_SOUS_TITRES.hauteur / 100)), 56);
  const sousTitres = h(
    "div",
    {
      key: "st",
      style: {
        position: "absolute",
        left: pct(BANDE_SOUS_TITRES.x),
        top: pct(BANDE_SOUS_TITRES.y),
        width: pct(BANDE_SOUS_TITRES.largeur),
        height: pct(BANDE_SOUS_TITRES.hauteur),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#ffffff",
        fontFamily: FAMILLE_CSS_AXION,
        fontWeight: 700,
        fontSize: taille,
      },
    },
    groupes.map((gr) =>
      h(
        "div",
        { key: gr.id, "data-groupe": gr.mots.map((m) => m.mot).join(" "), style: { display: "flex", gap: "0.3em" } },
        gr.mots.map((m, i) => (i === gr.marque ? h("span", { key: m.debutSec, style: { background: marque.fond, color: marque.texte, padding: "0 0.2em", borderRadius: 6 } }, m.mot) : h("span", { key: m.debutSec }, m.mot))),
      ),
    ),
  );
  const legende = h("div", { key: "leg", style: { position: "absolute", left: 24, bottom: 24, color: "#ffffff99", fontFamily: FAMILLE_CSS_AXION, fontSize: 28 } }, `${style} · taille ${g.tailleTexte}`);
  return h("div", { style: { position: "relative", width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE, overflow: "hidden" } }, [fond, motCle, sousTitres, legende]);
}

/** Les deux contrôles du critère de fini : hors bande des sous-titres et hors zone du visage. */
export function controlesMotCle(style: StyleMotCle): { horsSousTitres: boolean; horsVisage: boolean; motEntier: boolean; enHaut: boolean } {
  const g = geometrieMotCle(style);
  return {
    horsSousTitres: !seChevauchent(g.boite, BANDE_SOUS_TITRES),
    horsVisage: !seChevauchent(g.boite, ZONE_VISAGE),
    motEntier: g.motEntier,
    enHaut: g.boite.y + g.boite.hauteur <= ZONES.haut.y + ZONES.haut.hauteur,
  };
}
