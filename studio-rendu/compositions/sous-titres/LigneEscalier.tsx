/** Dessin de l'escalier de lignes (C2-U20b-a, AM-09) : pièce neuve, éteinte, importée par aucun fichier. Aucun calcul de mise en page : tout vient de `geometrieEscalier`. Couleurs reçues en propriétés. Manrope Bold, jamais en v4. */
import React from "react";
import type { GeometrieEscalier } from "../../../src/briques/sous-titres/escalier";
import { chargerPolices, FAMILLES } from "./polices";

/** « Mémoire floue » d'AM-09 : les lignes déjà passées restent visibles, floues et estompées. */
export const MEMOIRE_FLOUE = Object.freeze({ flouPx: 5, opacite: 0.4 });

export type ParametresLigneEscalier = {
  /** Résultat de `geometrieEscalier` ; `null` → rien n'est dessiné (repli sur le gabarit groupe). */
  geometrie: GeometrieEscalier | null;
  couleur: string;
  /** Couleur du contour/fond d'appui du texte, de la charte (reçue, jamais en dur). */
  fond: string;
  /** Indice de la ligne active (nette) ; les lignes d'indice inférieur prennent la mémoire floue. */
  ligneActive: number;
};

export const LigneEscalier: React.FC<ParametresLigneEscalier> = ({ geometrie, couleur, fond, ligneActive }) => {
  if (!geometrie) return null;
  chargerPolices(["Manrope Bold"]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {geometrie.lignes.map((l, i) => {
        const passee = i < ligneActive;
        return (
          <div
            key={i}
            data-ligne-escalier={i}
            style={{
              position: "absolute", left: l.xPx, top: l.yPx, width: l.largeurPx, height: l.hauteurPx,
              transform: `scale(${l.echelle})`, transformOrigin: "left top",
              whiteSpace: "nowrap", color: couleur, WebkitTextStroke: `1px ${fond}`,
              fontFamily: `"${FAMILLES["Manrope Bold"]}", "Manrope", sans-serif`, fontSize: l.taillePx,
              ...(passee ? { filter: `blur(${MEMOIRE_FLOUE.flouPx}px)`, opacity: MEMOIRE_FLOUE.opacite } : {}),
            }}
          >
            {l.texte}
          </div>
        );
      })}
    </div>
  );
};
