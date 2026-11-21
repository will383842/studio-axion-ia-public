/**
 * PLANCHE « MOT-CLÉ » (PLANCHE-MOT-CLE-v21n) : deux images fixes d'un mot-clé d'UN seul mot, en haut, sur une scène de cas concret
 * (fond, bande des sous-titres en bas) : style `etiquette` (taille 40) ou `bandeau` (taille 58), tailles de la pièce `legende`
 * (`src/briques/plan-scenes/controles.ts`, graisse 800, largeur 880). Outil local : composant pur (aucun hook, aucune horloge),
 * aucune lecture de réglage ; rien n'importe ce fichier depuis `src/` ni `studio-rendu/`. Texte en Manrope.
 * La planche dessine la pièce d'après ses mesures et sa zone `haut` ; la vraie composition la rend par le plan de scènes.
 */
import { createElement, type JSX } from "react";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { seChevauchent, ZONE_VISAGE, ZONES, type Rectangle } from "../../src/briques/plan-scenes/zones";

export type StyleMotCle = "etiquette" | "bandeau";
export const STYLES_MOT_CLE: readonly StyleMotCle[] = ["etiquette", "bandeau"];
export const TAILLE_MOT_CLE: Record<StyleMotCle, number> = { etiquette: 40, bandeau: 58 };
export const MOT_CLE = "Devis";
export const LARGEUR_PLANCHE = 1080;
export const HAUTEUR_PLANCHE = 1920;
const LARGEUR_MAX_TEXTE = 880;
/** Largeur moyenne d'une lettre en Manrope gras, en part du corps (mesure prudente par excès). */
const LARGEUR_LETTRE = 0.66;
/** Bande des sous-titres, en % de la hauteur (bas du cadre). */
export const BANDE_SOUS_TITRES: Rectangle = { x: 5, y: 66, largeur: 90, hauteur: 28 };

export interface GeometrieMotCle {
  /** Boîte du mot-clé en % du cadre. */
  boite: Rectangle;
  tailleTexte: number;
  largeurTextePx: number;
  motEntier: boolean;
}

/** Boîte du mot dans la zone `haut` : centrée en largeur, calée en haut de la zone. */
export function geometrieMotCle(style: StyleMotCle, mot: string = MOT_CLE): GeometrieMotCle {
  const tailleTexte = TAILLE_MOT_CLE[style];
  const largeurTextePx = Math.round(mot.length * tailleTexte * LARGEUR_LETTRE);
  const rembourrage = Math.round(tailleTexte * 0.5);
  const largeurPx = Math.min(LARGEUR_MAX_TEXTE, largeurTextePx + 2 * rembourrage);
  const hauteurPx = Math.round(tailleTexte * 1.25 + 2 * rembourrage * 0.6);
  const zone = ZONES.haut;
  const boite: Rectangle = {
    x: zone.x + (zone.largeur - (largeurPx / LARGEUR_PLANCHE) * 100) / 2,
    y: zone.y,
    largeur: (largeurPx / LARGEUR_PLANCHE) * 100,
    hauteur: (hauteurPx / HAUTEUR_PLANCHE) * 100,
  };
  return { boite, tailleTexte, largeurTextePx, motEntier: largeurTextePx <= LARGEUR_MAX_TEXTE };
}

const pct = (n: number) => `${n}%`;

export function PlancheMotCle({ style }: { style: StyleMotCle }): JSX.Element {
  const g = geometrieMotCle(style);
  const h = createElement;
  const fond = h("div", { key: "fond", style: { position: "absolute", inset: 0, background: `linear-gradient(160deg, ${CHARTE_AXION.noir} 0%, #3a2f2a 100%)` } });
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: style === "bandeau" ? 12 : 8,
        background: style === "bandeau" ? CHARTE_AXION.terracotta : "rgba(255,255,255,0.92)",
        color: style === "bandeau" ? "#ffffff" : "#1a1a1a",
        fontFamily: FAMILLE_CSS_AXION,
        fontWeight: 800,
        fontSize: g.tailleTexte,
        whiteSpace: "nowrap",
      },
    },
    MOT_CLE,
  );
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
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontFamily: FAMILLE_CSS_AXION,
        fontWeight: 700,
        fontSize: 56,
        textAlign: "center",
      },
    },
    "Le devis part tout seul",
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
