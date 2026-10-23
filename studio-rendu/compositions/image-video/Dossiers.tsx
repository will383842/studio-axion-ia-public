import React from "react";
/**
 * K17 · Dossiers : 2 à 4 dossiers (grille 2 × 2) ; sur le mot de chacun, son rabat s'ouvre, une feuille vole du haut
 * jusque dedans, le rabat se referme et le nom s'allume. Pixels de l'écran de référence 1080 × 1920.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, planEntreeObjet, teinte } from "../cas-concret/plans/commun";
import { Lignes } from "./CarteBenefice";
import { planDossiers, type DossierIV } from "./plan-objets";

export function Dossiers({ dossiers, debut, t, fond }: { dossiers: DossierIV[]; debut: number; t: number; fond: Fond }) {
  const p = planDossiers({ dossiers, debut }, t);
  const c = couleursDuFond(fond);
  return (
    <>
      {p.dossiers.map((d, i) => {
        if (d.entree <= 0) return null;
        const e = planEntreeObjet(d.entree, 50);
        const l = d.cote;
        const h = l * 0.78;
        const x = d.cx - l / 2;
        const dos = d.rangee ? COULEURS_DUO.orange : COULEURS_DUO.gris;
        const face = d.rangee ? COULEURS_DUO.orangeVif : COULEURS_DUO.grisClair;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: d.y, width: l, opacity: e.opacite, transform: `translateY(${e.decalageY}px) scale(${e.echelle})` }}>
            <div style={{ position: "relative", width: l, height: h, perspective: 900 }}>
              {/* Dos du dossier, avec son onglet. */}
              <div style={{ position: "absolute", left: 0, top: h * 0.08, width: l, height: h * 0.92, borderRadius: 22, background: dos }} />
              <div style={{ position: "absolute", left: 0, top: 0, width: l * 0.42, height: h * 0.2, borderRadius: "18px 18px 0 0", background: dos }} />
              {/* Feuille déjà rangée, qui dépasse. */}
              {d.rangee ? <div style={{ position: "absolute", left: l * 0.12, top: h * 0.14, width: l * 0.76, height: h * 0.5, borderRadius: 10, background: COULEURS_DUO.blanc }} /> : null}
              {/* Rabat avant : il bascule vers l'avant pour s'ouvrir. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: h * 0.26,
                  width: l,
                  height: h * 0.74,
                  borderRadius: 22,
                  background: face,
                  transformOrigin: "50% 100%",
                  transform: `rotateX(${-58 * d.ouverture}deg)`,
                  boxShadow: `0 14px 30px ${teinte(COULEURS_DUO.encre, 0.18)}`,
                }}
              />
            </div>
            <div style={{ marginTop: 22, display: "flex", justifyContent: "center", textAlign: "center", opacity: d.rangee ? 1 : 0.55 }}>
              <Lignes texte={d.nom} couleur={c.texte} police="inter-gras" />
            </div>
          </div>
        );
      })}
      {p.dossiers.map((d, i) => {
        if (!d.feuille.visible) return null;
        const a = d.feuille.avance;
        const arrivee = { x: d.cx, y: d.y + d.cote * 0.3 };
        const x = d.feuille.depart.x + (arrivee.x - d.feuille.depart.x) * a;
        const y = d.feuille.depart.y + (arrivee.y - d.feuille.depart.y) * a - Math.sin(Math.PI * a) * 120;
        return (
          <div
            key={`f${i}`}
            style={{
              position: "absolute",
              left: x - 70,
              top: y - 90,
              width: 140,
              height: 180,
              borderRadius: 12,
              background: COULEURS_DUO.blanc,
              border: `4px solid ${COULEURS_DUO.grisClair}`,
              boxSizing: "border-box",
              transform: `rotate(${(1 - a) * (i % 2 ? 18 : -18)}deg) scale(${1 - 0.35 * a})`,
              boxShadow: `0 16px 30px ${teinte(COULEURS_DUO.encre, 0.2)}`,
            }}
          >
            {[0, 1, 2].map((k) => (
              <div key={k} style={{ margin: k === 0 ? "34px 20px 0" : "18px 20px 0", height: 12, borderRadius: 6, background: k === 0 ? COULEURS_DUO.orangeVif : COULEURS_DUO.grisClair, width: k === 2 ? "50%" : undefined }} />
            ))}
          </div>
        );
      })}
    </>
  );
}
