import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { adoucir, progression } from "../../jetons-motion";
import { apparition, ombre, palette, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"tableau-de-bord">;

/** Écran de synthèse : tuiles de chiffres qui arrivent en cascade, petite courbe qui se trace. */
export function TableauDeBord({ image, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur } = TOILES["tableau-de-bord"];
  const n = p.kpis.length;
  const ecart = 24;
  const lt = (largeur - 80 - ecart * (n - 1)) / n;
  const max = Math.max(...p.serie, 1);
  const lc = largeur - 80;
  const hc = 260;
  const pts = p.serie.map((v, i) => ({ x: (i / (p.serie.length - 1)) * lc, y: hc - (v / max) * (hc - 20) }));
  const longueur = pts.slice(1).reduce((a, pt, i) => a + Math.hypot(pt.x - pts[i]!.x, pt.y - pts[i]!.y), 0);
  const trace = progression(image, 20, 40, adoucir);
  return (
    <div style={RACINE}>
      <div style={{ ...apparition(image, 0), position: "absolute", left: 40, top: 20, fontSize: 40, fontWeight: 800, color: c.texte }}>{p.titre}</div>
      {p.kpis.map((k, i) => (
        <div key={k.libelle + i} style={{ ...apparition(image, 6 + i * 6, 12, 30), position: "absolute", left: round(40 + i * (lt + ecart)), top: 110, width: round(lt), height: 230, borderRadius: 28, background: c.panneau, boxShadow: `${ombre(fond)}, 0 0 0 2px ${c.filet}`, padding: "30px 32px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: 26, fontWeight: 600, color: c.texteDoux }}>{k.libelle}</span>
          <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", color: i === 0 ? c.accent : c.texte }}>{k.valeur}</span>
        </div>
      ))}
      <div style={{ ...apparition(image, 16), position: "absolute", left: 40, top: 380, width: lc, height: hc + 80, borderRadius: 28, background: c.panneau, boxShadow: `0 0 0 2px ${c.filet}` }}>
        <svg width={lc} height={hc + 40} style={{ position: "absolute", left: 0, top: 20 }}>
          <polyline points={pts.map((pt) => `${round(pt.x * 0.9 + lc * 0.05)},${round(pt.y + 10)}`).join(" ")} fill="none" stroke={c.accent} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={round(longueur)} strokeDashoffset={round(longueur * (1 - trace))} />
        </svg>
      </div>
    </div>
  );
}
