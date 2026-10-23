import React from "react";
/**
 * TYP-B · Un mot géant à la fois (maquette TYP-B-2) : le mot DIT en dernier, seul, en très grand, sur un panneau qui
 * claque à chaque mot (battement) ; le mot orange de l'écran passe sur le panneau orange, en encre. Les battements
 * (un par mot de l'écran) sont au-dessus. Aucun JSX ni calcul au niveau module.
 */
import { C, styleAnton, teinteA, type FondTexte } from "./commun";
import { motCourant, motsDansLOrdre, tailleMotGeant, type DonneesTexte } from "./donnees";

/** Battements : le courant est long et plein, les passés pleins, les suivants pâles. */
function Battements({ n, courant, couleur, y }: { n: number; courant: number; couleur: string; y: number }) {
  const l = Math.min(56, (800 - 120) / Math.max(1, n) - 16);
  return (
    <div style={{ position: "absolute", left: 72, top: y, display: "flex", gap: 16 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ width: i === courant ? 120 : l, height: 14, borderRadius: 7, background: i <= courant ? couleur : teinteA(couleur, 0.35) }} />
      ))}
    </div>
  );
}

export function MotGeant({ d, t, haut, bas }: { d: DonneesTexte; t: number; haut: number; bas: number }) {
  const ordre = motsDansLOrdre(d);
  const k = motCourant(ordre, t);
  const fond: FondTexte = d.fond;
  const courant = k >= 0 ? ordre[k].m : null;
  // Panneau : orange pour le mot orange, sinon le contraire du fond (ivoire sur nuit, encre sur ivoire).
  const panneau = courant?.orange ? C.orangeVif : fond === "sombre" ? C.ivoire : C.encre;
  const ecrit = courant?.orange ? C.encre : fond === "sombre" ? C.encre : C.ivoire;
  const y0 = haut + 56;
  const h = bas - y0;
  // Battement : le panneau claque (léger rebond d'échelle) et penche d'un côté puis de l'autre à chaque mot.
  const depuis = courant ? Math.max(0, t - courant.t) : 1;
  const claque = 1 + 0.05 * Math.exp(-depuis * 14) * Math.cos(depuis * 30);
  const penche = k >= 0 ? (k % 2 === 0 ? -2 : 2) : 0;
  const taille = courant ? tailleMotGeant(courant.mot, 860, Math.min(620, h * 0.78)) : 0;
  return (
    <>
      <Battements n={ordre.length} courant={k} couleur={fond === "sombre" ? C.ivoire : C.encre} y={haut} />
      {courant ? (
        <div style={{ position: "absolute", left: 60, top: y0, width: 960, height: h, borderRadius: 48, background: panneau, transform: `rotate(${penche}deg) scale(${claque})`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ ...styleAnton(taille, ecrit), paddingTop: taille * 0.06 }}>{courant.mot}</div>
        </div>
      ) : null}
    </>
  );
}
