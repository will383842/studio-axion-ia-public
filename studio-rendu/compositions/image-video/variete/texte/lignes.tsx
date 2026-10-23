import React from "react";
/**
 * TYP-C · Lignes qui glissent (maquette `prototypes/d2-recit-chiffres-typo/typo.tsx`, TYP-C-2) : chaque rangée est un
 * cache ; chaque mot en sort et glisse en place, de bas en haut, À L'HEURE DE SON MOT DIT ; le bord du cache est un
 * filet qui se trace à mesure que les mots arrivent (point du feutre au bout). Le mot orange a sa propre rangée, plus
 * grande. Aucun JSX ni calcul au niveau module.
 */
import { largeurAnton } from "../../../../../src/briques/schema-motion/chasse-anton";
import { accentDe, encreDe, styleAnton, teinteA, type FondTexte } from "./commun";
import { avancee, heureGlissadeTypC, partVisibleTypC, type LigneEcrite, type Rangee } from "./donnees";

/** Arrivée d'une rangée : son premier mot (la première rangée, dès l'écran si elle est dite tôt). */
const arriveeDe = (lignes: readonly LigneEcrite[], r: Rangee, premiere = false) => Math.min(...r.mots.map((i) => heureGlissadeTypC(lignes[r.ligne].mots[i], premiere)));

/**
 * Décalage vertical du bloc des rangées déjà arrivées : centré dans la zone (haut → bas) ; quand une rangée arrive, le
 * bloc glisse vers le haut pour lui faire place. Toutes arrivées : décalage nul (mise en page finale).
 */
function decalage(lignes: readonly LigneEcrite[], rangees: readonly Rangee[], t: number, haut: number, bas: number): number {
  if (!rangees.length) return 0;
  const centre = (v: number) => {
    const dessus = rangees[0].y - haut;
    const dessous = bas - (rangees[v].y + rangees[v].taille);
    return Math.max(0, (dessous - dessus) / 2);
  };
  const arrivees = rangees.map((r, k) => arriveeDe(lignes, r, k === 0));
  let v = 0;
  arrivees.forEach((a, k) => {
    if (a <= t + 1e-6) v = k;
  });
  if (v === 0) return centre(0);
  return centre(v - 1) + (centre(v) - centre(v - 1)) * avancee(t, arrivees[v], 0.35);
}

export function RangeesGlissantes({ lignes, rangees, fond, t, haut, bas, x = 72 }: { lignes: readonly LigneEcrite[]; rangees: readonly Rangee[]; fond: FondTexte; t: number; haut: number; bas: number; x?: number }) {
  const encre = encreDe(fond);
  const accent = accentDe(fond);
  const dy = decalage(lignes, rangees, t, haut, bas);
  return (
    <>
      {rangees.map((r0, k) => {
        const r = { ...r0, y: r0.y + dy };
        const mots = r.mots.map((i) => lignes[r.ligne].mots[i]);
        const p = mots.map((m) => partVisibleTypC(t, heureGlissadeTypC(m, k === 0)));
        const trace = p.reduce((s, v) => s + v, 0) / Math.max(1, p.length);
        // Marge haute de 0,25 em dans le cache : les accents d'Anton (Ê, À) dépassent la boîte de ligne.
        const marge = r.taille * 0.25;
        const espace = largeurAnton(" ", r.taille);
        const filet = Math.min(r.largeur + 10, 936);
        return (
          <React.Fragment key={k}>
            <div style={{ position: "absolute", left: x - 6, top: r.y - marge, width: 948, height: r.taille + marge + 4, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 6, top: marge, display: "flex", gap: espace }}>
                {mots.map((m, i) => (
                  <div key={i} style={{ ...styleAnton(r.taille, m.orange ? accent : encre), transform: `translateY(${(1 - p[i]) * r.taille * 1.4}px)`, opacity: p[i] > 0 ? 1 : 0 }}>
                    {m.mot}
                  </div>
                ))}
              </div>
            </div>
            {trace > 0 ? <div style={{ position: "absolute", left: x, top: r.y + r.taille + 12, width: filet * trace, height: 6, borderRadius: 3, background: teinteA(encre, 0.85) }} /> : null}
            {trace > 0 && trace < 0.999 ? <div style={{ position: "absolute", left: x + filet * trace - 11, top: r.y + r.taille + 4, width: 22, height: 22, borderRadius: "50%", background: encre }} /> : null}
          </React.Fragment>
        );
      })}
    </>
  );
}
