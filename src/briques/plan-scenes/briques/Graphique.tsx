import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { adoucir, avecOpacite, decelerer, progression } from "../../jetons-motion";
import { apparition, nombreFr, palette, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"graphique">;

/** Barres qui poussent l'une après l'autre, ou courbe qui se trace ; la valeur mise en avant prend l'accent. */
export function Graphique({ image, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.graphique;
  const max = Math.max(...p.valeurs.map((v) => v.valeur), 1);
  const zoneH = hauteur - 220;
  const pas = (largeur - 120) / p.valeurs.length;
  const neutre = fond === "noir" ? avecOpacite(c.texte, 0.22) : c.panneauRelief;
  const points = p.valeurs.map((v, i) => ({ x: 60 + pas * (i + 0.5), y: 120 + zoneH - (v.valeur / max) * zoneH }));
  const trace = progression(image, 6, 40, adoucir);
  const longueur = points.slice(1).reduce((a, pt, i) => a + Math.hypot(pt.x - points[i]!.x, pt.y - points[i]!.y), 0);
  return (
    <div style={RACINE}>
      <div style={{ ...apparition(image, 0), position: "absolute", left: 60, top: 20, fontSize: 36, fontWeight: 700, color: c.texte }}>{p.titre}</div>
      <div style={{ position: "absolute", left: 60, right: 60, top: 120 + zoneH, height: 2, background: c.filet }} />
      {p.type === "barres"
        ? p.valeurs.map((v, i) => {
            const t = progression(image, 6 + i * 5, 22, decelerer);
            const h = (v.valeur / max) * zoneH * t;
            return (
              <div key={v.libelle + i}>
                <div style={{ position: "absolute", left: round(60 + pas * i + pas * 0.18), width: round(pas * 0.64), top: round(120 + zoneH - h), height: round(h), borderRadius: "14px 14px 4px 4px", background: i === p.enAvant ? c.accent : neutre }} />
                <div style={{ position: "absolute", left: round(60 + pas * i), width: round(pas), top: round(120 + zoneH - h - 48), textAlign: "center", fontSize: 30, fontWeight: 700, color: i === p.enAvant ? c.accent : c.texte, opacity: t }}>{nombreFr(v.valeur, 0)}</div>
              </div>
            );
          })
        : (
          <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
            <polyline points={points.map((pt) => `${round(pt.x)},${round(pt.y)}`).join(" ")} fill="none" stroke={c.accent} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={round(longueur)} strokeDashoffset={round(longueur * (1 - trace))} />
            {points.map((pt, i) => (
              <circle key={i} cx={round(pt.x)} cy={round(pt.y)} r={i === p.enAvant ? 14 : 9} fill={i === p.enAvant ? c.accent : c.fond} stroke={c.accent} strokeWidth={4} opacity={round(progression(image, 6 + (40 * i) / Math.max(1, points.length - 1), 6))} />
            ))}
          </svg>
        )}
      {p.valeurs.map((v, i) => (
        <div key={"l" + i} style={{ position: "absolute", left: round(60 + pas * i), width: round(pas), top: 140 + zoneH, textAlign: "center", fontSize: 26, fontWeight: 600, color: c.texteDoux }}>{v.libelle}</div>
      ))}
    </div>
  );
}
