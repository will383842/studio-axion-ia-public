/**
 * Éléments du style éditorial (A, ART-1) : filet fin, numéro de rang, pastille, rubrique en petites capitales espacées. Aucun contour épais,
 * aucune ombre décalée. Le texte vient du code (rang, rubrique) ; les couleurs, de la charte.
 */
import type { CSSProperties } from "react";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";
import { k } from "./Remplir";
import { COULEURS, FILET, GRAISSE_TITRE, INTERLETTRAGE_RUBRIQUE, POLICE_CORPS, POLICE_TITRE, TAILLE_RUBRIQUE } from "./constantes";

/** Filet horizontal de 2 px (encre par défaut), sur toute la largeur de son conteneur. */
export function Filet({ couleur = COULEURS.encre, style }: { couleur?: string; style?: CSSProperties }) {
  return <div style={{ flex: "none", height: FILET, background: couleur, ...style }} />;
}

/**
 * Filet de 2 px au-dessus d'un élément de liste, et l'air qui le suit (`air` px, grandit avec le remplissage) ; le PREMIER élément n'en a pas :
 * il est déjà sous le filet du titre (jamais deux filets à la suite).
 */
export function filetAuDessus(premier: boolean, air: number): CSSProperties {
  return premier ? {} : { paddingTop: k(air), borderTop: `${FILET}px solid ${COULEURS.encre}` };
}

/** Rang écrit sur deux chiffres (« 01 ») : posé par le code, jamais par le spec. */
export function rangEcrit(rang: number): string {
  return String(Math.max(1, Math.floor(rang))).padStart(2, "0");
}

/** Grand numéro de rang (« 01 ») en Inter Display Black orange : grand texte, contraste 3,3:1 sur crème (seuil 3:1). */
export function Numero({ rang, taille, couleur = COULEURS.orange }: { rang: number; taille: number | string; couleur?: string }) {
  chargerPoliceTitre();
  return <div style={{ flex: "none", fontFamily: POLICE_TITRE, fontWeight: GRAISSE_TITRE, fontSize: taille, lineHeight: 1, color: couleur, fontVariantNumeric: "tabular-nums" }}>{rangEcrit(rang)}</div>;
}

/** Pastille pleine orange, chiffre à l'encre (Inter Bold) : rang compact des pages à rangées (questions). */
export function Pastille({ rang, taille }: { rang: number; taille: number | string }) {
  chargerPoliceInter();
  return (
    <div style={{ flex: "none", width: taille, height: taille, borderRadius: "50%", background: COULEURS.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: `calc(${typeof taille === "number" ? `${taille}px` : taille} * 0.44)`, lineHeight: 1, color: COULEURS.encre }}>{rang}</div>
    </div>
  );
}

/** Rubrique : petit trait orange, mot en petites capitales espacées (Inter Bold, encre). */
export function Rubrique({ texte, couleur = COULEURS.encre }: { texte: string; couleur?: string }) {
  chargerPoliceInter();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: "none", width: 40, height: 6, background: COULEURS.orange }} />
      <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLE_RUBRIQUE, lineHeight: 1, letterSpacing: INTERLETTRAGE_RUBRIQUE, color: couleur, whiteSpace: "nowrap" }}>{texte}</div>
    </div>
  );
}

/** Étiquette en petites capitales espacées, sans fond (« AVANT », « SANS ») : Inter Bold, encre ou couleur donnée. */
export function Etiquette({ texte, couleur = COULEURS.encre, taille = TAILLE_RUBRIQUE }: { texte: string; couleur?: string; taille?: number | string }) {
  chargerPoliceInter();
  return <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: taille, lineHeight: 1.2, letterSpacing: INTERLETTRAGE_RUBRIQUE, color: couleur }}>{texte}</div>;
}
