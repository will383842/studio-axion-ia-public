import React from "react";
/**
 * MAT-D · plateaux en relief sous les cartes de la toile (maquette validée : plans lointains, ivoire clair, ombre large,
 * décalés vers le haut à gauche). Un plateau par colonne du schéma (tronc commun, chaque branche) : les cartes d'une
 * même colonne sont posées sur le même plateau ; un plateau n'apparaît (fondu) qu'avec la première carte de sa colonne,
 * jamais vide. Pixels de toile.
 */
import type { BoiteNoeud } from "../../../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";

const MARGE = 64;

export function plateauxDe(boites: readonly BoiteNoeud[]): { cle: string; x: number; y: number; largeur: number; hauteur: number }[] {
  const parColonne = new Map<string, BoiteNoeud[]>();
  for (const b of boites) parColonne.set(b.colonne ?? "", [...(parColonne.get(b.colonne ?? "") ?? []), b]);
  return [...parColonne.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cle, bs]) => {
      const x0 = Math.min(...bs.map((b) => b.x)) - MARGE - 60;
      const y0 = Math.min(...bs.map((b) => b.y)) - MARGE;
      const x1 = Math.max(...bs.map((b) => b.x + b.largeur)) + MARGE;
      const y1 = Math.max(...bs.map((b) => b.y + b.hauteur)) + MARGE;
      return { cle, x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
    });
}

export function Plateaux({ boites, opacite }: { boites: readonly BoiteNoeud[]; opacite: (colonne: string) => number }) {
  return (
    <>
      {plateauxDe(boites).map((p) =>
        opacite(p.cle) <= 0 ? null : (
        <div
          key={p.cle || "tronc"}
          data-plateau={p.cle || "tronc"}
          style={{ position: "absolute", left: p.x, top: p.y, width: p.largeur, height: p.hauteur, borderRadius: 60, background: COULEURS_DUO.ivoireHaut, boxShadow: `0 40px 120px ${teinte(COULEURS_DUO.encre, 0.1)}`, transform: "translate(-30px, -18px)", opacity: opacite(p.cle) }}
        />
        ),
      )}
    </>
  );
}
