/**
 * Pièces communes aux couvertures : le cadre de la page (la maquette 1080 × 1350, centrée dans la hauteur du format et rognée aux bords de
 * la page comme `.pg { overflow: hidden }`), la zone de texte (`.main` : marge 80, début à 196 px, fin à 150 px du bas) et le titre à accent
 * au milieu de la phrase (l'accent n'est pas toujours le dernier mot). Les dessins de la maquette gardent leurs coordonnées de page.
 */
import type { CSSProperties, ReactNode } from "react";
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { police, POLICE_TITRE, POLICE_SERIF } from "../../commun/Primitives";
import { MARGE_SURE } from "../../constantes-continu";

const HAUTEUR_MAQUETTE = 1350;

/**
 * Cadre rogné aux bords de la page (`contain: paint`, comme `overflow: clip`) : le dessin hors page n'est ni peint ni compté dans le
 * débordement de la toile ; les textes restent mesurés à leur vraie place.
 */
export function Cadre({ hauteur, fond, children }: { hauteur: number; fond?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: 0, contain: "paint" }}>
      {fond}
      <div style={{ position: "absolute", left: 0, top: (hauteur - HAUTEUR_MAQUETTE) / 2, width: 1080, height: HAUTEUR_MAQUETTE }}>{children}</div>
    </div>
  );
}

/** `.main` : colonne de texte au-dessus des dessins. */
export function ZoneTexte({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 1080 - 2 * MARGE_SURE, height: HAUTEUR_MAQUETTE - 196 - 150, display: "flex", flexDirection: "column", ...style }}>{children}</div>;
}

/** Espace insécable avant « ? ! : ; » comme le fait la typographie française. */
export function typo(texte: string): string {
  return texte.replace(/ ([?!:;»])/g, " $1");
}

/** Attache la suite à l'accent : collée avant une virgule ou un point, insécable avant « ? », sinon séparée par une espace. */
function liaison(suite: string): string {
  if (/^[,.…]/.test(suite)) return "";
  if (/^[?!:;»]/.test(suite)) return " ";
  return " ";
}

/** `T(s, 'début <em>accent</em> suite')` : grand titre Bricolage 800 ; l'accent en Instrument Serif italique orange. */
export function TitreCouverture({ taille, titre, accent, suite, sombre = false, style }: { taille: number; titre: string; accent?: string; suite?: string; sombre?: boolean; style?: CSSProperties }) {
  return (
    <h1 style={{ ...police(800, taille, 0.94, POLICE_TITRE), letterSpacing: "-0.045em", wordSpacing: "0.08em", margin: 0, textWrap: "balance", color: sombre ? C.creme : C.encre, ...style }}>
      {typo(titre)}
      {accent ? (
        <>
          {" "}
          <em style={{ ...police(400, Math.round(taille * 1.1), 0.9, POLICE_SERIF, true), letterSpacing: "-0.015em", color: C.orange, wordSpacing: 0 }}>{typo(accent)}</em>
        </>
      ) : null}
      {suite ? `${liaison(suite)}${typo(suite)}` : null}
    </h1>
  );
}
