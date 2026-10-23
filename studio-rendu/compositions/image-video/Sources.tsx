import React from "react";
/**
 * K18 · Sources : les icônes de sources surgissent une par mot, chacune lâche une feuille qui glisse le long d'un fil
 * pointillé jusqu'à la cible (le moteur), qui bat à chaque feuille reçue. Pixels de l'écran de référence 1080 × 1920.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, planSurgir, teinte } from "../cas-concret/plans/commun";
import { Icone } from "../interface-claire/elements";
import { Lignes, PastilleIcone } from "./CarteBenefice";
import { planSources, type SourceIV } from "./plan-objets";

export function Sources({ sources, cible, t, fond }: { sources: SourceIV[]; cible: { icone: string }; t: number; fond: Fond }) {
  const p = planSources({ sources, cible }, t);
  const c = couleursDuFond(fond);
  const sombre = fond === "sombre";
  const pointCible = (x: number, y: number) => {
    // Le fil arrive sur le bord de la cible, pas en son centre.
    const dx = p.cible.x - x;
    const dy = p.cible.y - y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.cible.x - (dx / d) * p.cible.rayon, y: p.cible.y - (dy / d) * p.cible.rayon };
  };
  const ce = planSurgir(p.cible.entree);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
        {p.sources.map((s, i) => {
          if (s.fil <= 0) return null;
          const a = { x: s.x, y: s.y + s.rayon };
          const b = pointCible(a.x, a.y);
          const L = Math.hypot(b.x - a.x, b.y - a.y);
          return (
            <g key={i}>
              <defs>
                <mask id={`fil-${i}`} maskUnits="userSpaceOnUse">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={20} strokeDasharray={`${L} ${L}`} strokeDashoffset={L * (1 - s.fil)} />
                </mask>
              </defs>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={s.arrivee ? COULEURS_DUO.orangeVif : sombre ? COULEURS_DUO.grisClair : COULEURS_DUO.gris} strokeWidth={7} strokeLinecap="round" strokeDasharray="2 20" mask={`url(#fil-${i})`} />
            </g>
          );
        })}
      </svg>
      {p.sources.map((s, i) => {
        if (!s.feuille.visible) return null;
        const a = { x: s.x, y: s.y + s.rayon };
        const b = pointCible(a.x, a.y);
        const x = a.x + (b.x - a.x) * s.feuille.avance;
        const y = a.y + (b.y - a.y) * s.feuille.avance;
        return <div key={`f${i}`} style={{ position: "absolute", left: x - 30, top: y - 38, width: 60, height: 76, borderRadius: 8, background: COULEURS_DUO.blanc, border: `3px solid ${COULEURS_DUO.grisClair}`, boxSizing: "border-box", boxShadow: `0 10px 20px ${teinte(COULEURS_DUO.encre, 0.2)}` }} />;
      })}
      {p.sources.map((s, i) => {
        if (s.entree <= 0) return null;
        const e = planSurgir(s.entree);
        return (
          <div key={`s${i}`} style={{ position: "absolute", left: s.x - s.rayon, top: s.y - s.rayon, width: 2 * s.rayon, opacity: e.opacite, transform: `scale(${e.echelle})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <PastilleIcone icone={sources[i].icone} diametre={2 * s.rayon} fond={sombre ? COULEURS_DUO.blanc : COULEURS_DUO.encre} couleur={sombre ? COULEURS_DUO.encre : COULEURS_DUO.blanc} />
            {s.nom ? (
              <div style={{ marginTop: 12, whiteSpace: "nowrap", textAlign: "center" }}>
                <Lignes texte={s.nom} couleur={c.texte} police="inter-gras" />
              </div>
            ) : null}
          </div>
        );
      })}
      {p.cible.entree > 0 ? (
        <div
          style={{
            position: "absolute",
            left: p.cible.x - p.cible.rayon,
            top: p.cible.y - p.cible.rayon,
            width: 2 * p.cible.rayon,
            height: 2 * p.cible.rayon,
            borderRadius: "50%",
            background: COULEURS_DUO.orangeVif,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: ce.opacite,
            transform: `scale(${ce.echelle * p.cible.impulsion})`,
            boxShadow: `0 0 ${50 + 20 * p.cible.recus}px ${teinte(COULEURS_DUO.orangeVif, 0.55)}`,
          }}
        >
          <Icone nom={cible.icone} taille={p.cible.rayon * 1.05} couleur={COULEURS_DUO.blanc} epaisseur={2.6} />
        </div>
      ) : null}
    </>
  );
}
