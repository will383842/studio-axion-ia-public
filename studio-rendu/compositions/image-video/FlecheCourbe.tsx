import React from "react";
/**
 * K04 · FlècheCourbe : flèche qui se dessine entre deux nœuds quelconques (courbe de Bézier, la pointe arrive en
 * dernier), pleine ou pointillée, avec étiquette optionnelle. Tracée dans le calque SVG de la toile (pixels de toile).
 */
import { ECRAN_IV, TAILLE_DETAIL_IV, type CouleurSchema, type StyleLien } from "../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse } from "../cas-concret/plans/commun";
import { couleurTrait, type CheminFleche, type EtatFleche } from "./plan";

/** Épaisseur du trait (pixels de toile). */
export const EPAISSEUR_FLECHE = 9;

export function FlecheCourbe({ id, chemin, couleur, style = "plein", etat, etiquette, opaciteEtiquette = 1 }: { id: string; chemin: CheminFleche; couleur: CouleurSchema; style?: StyleLien; etat: EtatFleche; etiquette?: string; opaciteEtiquette?: number }) {
  if (etat.trace <= 0) return null;
  const c = couleurTrait(couleur);
  const L = chemin.longueur;
  const masque = `fleche-${id}`;
  const pointe = 24;
  return (
    <g opacity={etat.opacite}>
      {style === "pointille" ? (
        <>
          <defs>
            <mask id={masque} maskUnits="userSpaceOnUse">
              <path d={chemin.d} fill="none" stroke="#fff" strokeWidth={EPAISSEUR_FLECHE * 3} strokeDasharray={`${L} ${L}`} strokeDashoffset={L * (1 - etat.trace)} />
            </mask>
          </defs>
          <path d={chemin.d} fill="none" stroke={c} strokeWidth={EPAISSEUR_FLECHE} strokeLinecap="round" strokeDasharray={`2 ${EPAISSEUR_FLECHE * 2.6}`} mask={`url(#${masque})`} />
        </>
      ) : (
        <path d={chemin.d} fill="none" stroke={c} strokeWidth={EPAISSEUR_FLECHE} strokeLinecap="round" strokeDasharray={`${L} ${L}`} strokeDashoffset={L * (1 - etat.trace)} />
      )}
      {etat.pointe > 0 ? (
        <g transform={`translate(${chemin.bout[0]} ${chemin.bout[1]}) rotate(${chemin.angle}) scale(${etat.pointe})`}>
          <path d={`M ${-pointe} ${-pointe * 0.7} L 2 0 L ${-pointe} ${pointe * 0.7} Z`} fill={c} stroke={c} strokeWidth={4} strokeLinejoin="round" />
        </g>
      ) : null}
      {etiquette && etat.pointe > 0 ? (
        <foreignObject x={chemin.milieu[0] - 400} y={chemin.milieu[1] - 60} width={800} height={120}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", opacity: etat.pointe * opaciteEtiquette }}>
            <span style={{ background: COULEURS_DUO.ivoire, padding: "6px 22px", borderRadius: 999, fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLE_DETAIL_IV * ECRAN_IV.hauteur, color: COULEURS_DUO.encre, whiteSpace: "nowrap" }}>
              {etiquette}
            </span>
          </div>
        </foreignObject>
      ) : null}
    </g>
  );
}
