/**
 * Pastille « logo + nom d'outil » (C8-L06) : dessin de la géométrie pure de `pastille-logo.ts`. Pièce neuve, éteinte :
 * aucun fichier existant ne l'importe, aucune constante d'allumage. Le logo est dessiné en `<path>` React seulement
 * (jamais d'image, de réseau, de transform, d'ombre, de contour ni de rotation sur le logo) ; l'ombre douce est celle
 * de la pastille. Repli texte seul : aucun `<svg>`, le nom reste écrit. Nom en Manrope Bold, couleurs de la géométrie.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE } from "../../../src/briques/charte/axion-2026";
import { PASTILLE_AXION } from "../../../src/briques/sous-titres/pastille";
import { etatPastilleLogo, type GeometriePastilleLogo } from "../../../src/briques/sous-titres/pastille-logo";
import { chargerPolices, FAMILLES } from "./polices";

export interface ProprietesPastilleLogo {
  geometrie: GeometriePastilleLogo | null;
  debutSec: number;
  finSec: number;
}

export const PastilleLogo: React.FC<ProprietesPastilleLogo> = ({ geometrie: g, debutSec, finSec }) => {
  chargerPolices(["Manrope Bold"]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!g) return null;
  const etat = etatPastilleLogo(frame / fps, debutSec, finSec);
  if (!etat.visible) return null;
  const { pastille: p, logo: l, texte: t } = g;
  const o = PASTILLE_AXION.ombre;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: etat.opacite, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, borderRadius: p.rayon,
          background: PALETTE[g.fond], transform: `translateY(${etat.monteePx}px) scale(${etat.echelle})`,
          boxShadow: `0 ${o.decalagePx}px ${o.flouPx}px color-mix(in srgb, ${PALETTE.noir} ${Math.round(o.opacite * 100)}%, transparent)`,
        }}
      />
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${etat.monteePx}px) scale(${etat.echelle})`, transformOrigin: `${p.x + p.w / 2}px ${p.y + p.h / 2}px` }}>
        {l ? (
          <svg style={{ position: "absolute", left: l.x, top: l.y, width: l.w, height: l.h }} viewBox={l.dessin.vue.join(" ")} aria-hidden="true">
            {l.dessin.noeuds.map(([, a], i) => (
              <path key={i} d={a.d} fill={a.fill ?? g.couleurTexte} />
            ))}
          </svg>
        ) : null}
        <div
          style={{
            position: "absolute", left: t.x, top: t.y, width: t.w, height: t.h, display: "flex", alignItems: "center",
            color: g.couleurTexte, fontFamily: `"${FAMILLES["Manrope Bold"]}", sans-serif`, fontSize: t.taillePx, whiteSpace: "nowrap",
          }}
        >
          {g.nom}
        </div>
      </div>
    </div>
  );
};
