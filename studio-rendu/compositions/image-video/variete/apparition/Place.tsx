import React from "react";
/**
 * La PLACE de la carte suivante, qui attend sous la carte qu'on vient de poser (APP-B : contour en pointillé, comme la
 * carte que le feutre tracera ; APP-D : place pleine, beige éteint, un peu de travers, comme une fiche à poser). Aucun
 * texte : rien n'est montré avant d'être dit. Pixels de toile.
 */
import type { BoiteNoeud } from "../../../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";
import { Icone } from "../../../interface-claire/elements";
import { RAYON_PASTILLE } from "../../plan";
import { BEIGE_ETEINT, inclinaisonRepos, type CodeApparition } from "./apparition";

export function Place({ boite, icone, code, opacite }: { boite: BoiteNoeud; icone?: string; code: CodeApparition; opacite: number }) {
  if (opacite <= 0 || code === "APP-C") return null;
  const pointille = code === "APP-B";
  const r = RAYON_PASTILLE;
  return (
    <div
      data-place={boite.id}
      style={{ position: "absolute", left: boite.x, top: boite.y, width: boite.largeur, height: boite.hauteur, opacity: opacite, transform: pointille ? undefined : `rotate(${-inclinaisonRepos(boite.id)}deg)` }}
    >
      {pointille ? (
        <svg width={boite.largeur} height={boite.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <rect x={0} y={0} width={boite.largeur} height={boite.hauteur} rx={34} fill={teinte(COULEURS_DUO.blanc, 0.45)} stroke={teinte(COULEURS_DUO.encre, 0.45)} strokeWidth={6} strokeDasharray="2 20" strokeLinecap="round" />
        </svg>
      ) : (
        <div style={{ position: "absolute", inset: 0, borderRadius: 34, background: BEIGE_ETEINT }} />
      )}
      {icone ? (
        <div
          style={{
            position: "absolute",
            left: -2 * r + 30,
            top: boite.hauteur / 2 - r,
            width: 2 * r,
            height: 2 * r,
            borderRadius: "50%",
            boxSizing: "border-box",
            background: pointille ? COULEURS_DUO.ivoire : COULEURS_DUO.grisClair,
            border: pointille ? `5px dashed ${teinte(COULEURS_DUO.encre, 0.4)}` : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icone nom={icone} taille={r * 1.1} couleur={pointille ? teinte(COULEURS_DUO.encre, 0.45) : COULEURS_DUO.ivoire} epaisseur={2.6} />
        </div>
      ) : null}
    </div>
  );
}

/** APP-C : tous les fils du schéma, pâles et sans pointe, sous les vrais fils (ils s'allument en se dessinant par-dessus). */
export function FilsEteints({ chemins }: { chemins: { id: string; d: string }[] }) {
  return (
    <g data-fils-eteints="">
      {chemins.map((c) => (
        <path key={c.id} d={c.d} fill="none" stroke={COULEURS_DUO.grisClair} strokeWidth={7} strokeLinecap="round" />
      ))}
    </g>
  );
}
