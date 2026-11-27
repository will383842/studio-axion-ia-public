/** Éléments communs aux plaquettes « listes » : la zone de contenu de la maquette (`.main`) et les polices des cartes (`.bf`, `.sm`). */
import type { CSSProperties, ReactNode } from "react";
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { police, POLICE_TEXTE, POLICE_TITRE } from "../../commun/Primitives";
import { MARGE_SURE } from "../../constantes-continu";

/** `.pg` padding 84/80 + `.top` 60 + `.main` padding 52 en haut (196), 150 en bas. */
export const HAUT_CONTENU = 196;
export const BAS_CONTENU = 150;

/** Zone de contenu d'une plaquette : 920 px de large entre les marges sûres, de 196 px à `hauteur - 150 - basReserve`. */
export function ZoneListe({ hauteur, basReserve = 0, children }: { hauteur: number; basReserve?: number; children: ReactNode }) {
  return <div style={{ position: "absolute", left: MARGE_SURE, top: HAUT_CONTENU, width: 1080 - 2 * MARGE_SURE, height: hauteur - HAUT_CONTENU - BAS_CONTENU - basReserve, display: "flex", flexDirection: "column" }}>{children}</div>;
}

/** `.bf` : Bricolage 800, interligne et espacement serrés. */
export function bf(taille: number, interligne = 1): CSSProperties {
  return { ...police(800, taille, interligne, POLICE_TITRE), letterSpacing: "-0.04em" };
}

/** `.sm` : texte secondaire 31 px, à 78 % d'opacité, de la couleur de sa carte. */
export function Sm({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ ...police(500, 31, 1.3, POLICE_TEXTE), margin: 0, opacity: 0.78, ...style }}>{children}</p>;
}

/** Brun brûlé (`orangeBrule`) des libellés qui étaient en orange dans la maquette : l'orange est réservé aux grands titres. */
export const LIBELLE_CLAIR = C.orangeBrule;
