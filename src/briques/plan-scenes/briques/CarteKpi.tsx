import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { decelerer, progression } from "../../jetons-motion";
import { apparition, nombreFr, ombre, palette, RACINE, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"carte-kpi">;

/** Chiffre clé qui monte jusqu'à sa valeur (décélération douce), libellé et tendance. */
export function CarteKpi({ image, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES["carte-kpi"];
  const t = progression(image, 6, 36, decelerer);
  const fleche = p.tendance === "hausse" ? "↗" : p.tendance === "baisse" ? "↘" : "→";
  return (
    <div style={{ ...RACINE, ...apparition(image, 0, 12, 30) }}>
      <div style={{ position: "absolute", left: 20, top: 20, width: largeur - 40, height: hauteur - 40, borderRadius: 32, background: c.panneau, boxShadow: `${ombre(fond)}, 0 0 0 2px ${c.filet}`, padding: "44px 52px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ fontSize: 34, fontWeight: 600, color: c.texteDoux }}>{p.libelle}</div>
        <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em", color: c.texte }}>
          {p.prefixe}
          {nombreFr(p.valeur * t, p.decimales)}
          <span style={{ color: c.accent }}>{p.suffixe}</span>
        </div>
        <div style={{ ...apparition(image, 30), display: "flex", gap: 14, alignItems: "center", fontSize: 28, fontWeight: 600, color: c.accent }}>
          <span>{fleche}</span>
          <span style={{ color: c.texteDoux }}>{p.variation}</span>
        </div>
      </div>
    </div>
  );
}
