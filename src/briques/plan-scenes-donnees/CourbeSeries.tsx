import { TOILES } from "../plan-scenes/toiles";
import { adoucir, avecOpacite, progression } from "../jetons-motion";
import { apparition, nombreFr, palette, RACINE, round, type ProprietesBrique } from "../plan-scenes/briques/communs";
import { DEBUT_TRACE, DUREE_TRACE, geometrie, type ParametresCourbeSeries } from "./courbe-series";

/** Opacités des tons neutres des séries non mises en avant (du plus marqué au plus discret). */
const TONS_NEUTRES = [0.62, 0.42, 0.28];

/**
 * Courbes qui se tracent série par série ; la série `enAvant` prend l'accent, les autres des tons neutres.
 * Les étiquettes de fin de courbe sont les valeurs reçues.
 */
export function CourbeSeries({ image, fond, accent, parametres: p }: ProprietesBrique<ParametresCourbeSeries>) {
  const c = palette(fond, accent);
  const { largeur, hauteur } = TOILES.graphique;
  const g = geometrie(p);
  const vedette = p.enAvant ?? 0;
  let neutre = 0;
  const couleurs = p.series.map((_, i) => (i === vedette ? c.accent : avecOpacite(c.texte, TONS_NEUTRES[Math.min(neutre++, TONS_NEUTRES.length - 1)]!)));
  const decalage = (i: number) => DEBUT_TRACE + i * DUREE_TRACE;
  return (
    <div style={RACINE}>
      <div style={{ ...apparition(image, 0), position: "absolute", left: 60, top: 20, fontSize: 36, fontWeight: 700, color: c.texte }}>{p.titre}</div>
      {/* Légende : le nom de chaque série. */}
      <div style={{ ...apparition(image, 4), position: "absolute", left: 60, top: 76, display: "flex", gap: 28, fontSize: 24, fontWeight: 600, color: c.texteDoux }}>
        {p.series.map((s, i) => (
          <span key={"g" + i} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 6, borderRadius: 3, background: couleurs[i] }} />
            <span style={{ color: i === vedette ? c.accent : c.texteDoux }}>{s.nom}</span>
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", left: g.gauche, width: g.droite - g.gauche, top: g.axeY, height: 2, background: c.filet }} />
      <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
        {g.series.map((s, i) => {
          const t = progression(image, decalage(i), DUREE_TRACE, adoucir);
          return (
            <polyline key={"s" + i} points={s.points.map((pt) => `${round(pt.x)},${round(pt.y)}`).join(" ")} fill="none" stroke={couleurs[i]} strokeWidth={i === vedette ? 8 : 5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={round(s.longueur)} strokeDashoffset={round(s.longueur * (1 - t))} />
          );
        })}
      </svg>
      {g.series.map((s, i) => {
        const fin = s.points[s.points.length - 1]!;
        const t = progression(image, decalage(i) + DUREE_TRACE - 6, 8);
        return (
          <div key={"v" + i} style={{ position: "absolute", left: round(fin.x - 90), width: 180, top: round(fin.y - 44), textAlign: "center", fontSize: 28, fontWeight: 700, color: i === vedette ? c.accent : c.texte, opacity: t }}>
            {nombreFr(fin.valeur, Number.isInteger(fin.valeur) ? 0 : 1)}
          </div>
        );
      })}
      {p.abscisses.map((a, i) => (
        <div key={"a" + i} style={{ position: "absolute", left: round(g.xs[i]! - 60), width: 120, top: g.axeY + 16, textAlign: "center", fontSize: 24, fontWeight: 600, color: c.texteDoux }}>{a}</div>
      ))}
    </div>
  );
}
