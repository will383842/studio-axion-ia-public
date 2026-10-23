import React from "react";
/**
 * ÉLÉMENT 30 ★ `MosaiqueVideos` (standard v4, lot 4, § F) : plein cadre M5. Une grille de tuiles vidéo (rayon 14, contour 5, ombre S) sur fond ENCRE, INCLINÉE de -8° DANS LE PLAN
 * (rotateZ seulement, aucune perspective), qui défile vers le haut à 0,6 % H par image ; 6 sources littérales différentes.
 *
 * Mouvement (i0 = mot dit) : tuiles présentes dès la 1ʳᵉ image (cascade d'apparition 1 i, `POP`) · défilement continu · au mot fort (`iHeros`) UNE TUILE SORT DE LA
 * GRILLE : échelle 1 → 1,9, rotateZ → 0 (`CLAQUE`), contour ACCENT_1 10 px, avec sa `Plaque` · sortie : la grille (et la tuile) glissent vers le haut en 4 i.
 * Visage : couvert (≥ 8 s dans une vraie vidéo) · bruitages : `whoosh-in` (i0), `select_001` (tuile qui sort), `whoosh-out` (sortie).
 */
import { Clip, Ancre, EtiquetteBord, Impact, H, L, Sons, accents, aspire, COULEURS, lerp, prog, ress, ombre, RAYON, TRAIT } from "./commun-lot4";
import type { MesuresElement, Palette } from "./commun-lot4";

export const ID_MOSAIQUE_VIDEOS = "mosaique-videos";
const ANGLE = -8;
const TW = 338;
const TH = 430;
const GAP = 26;
const PX = TW + GAP;
const PY = TH + GAP;
const VITESSE = 0.006 * H; // px par image
const SORTIE = 4;
const { ENCRE, BLANC } = COULEURS;

/** `sources[1]` est la source de la tuile qui sort de la grille (la rangée 0, colonne centrale) : y mettre la vidéo du mot fort. */
export type PropsMosaiqueVideos = { f: number; duree: number; palette: Palette; sources: readonly string[]; iHeros: number; motFort: string };

/** Position écran (x, y) du centre d'un point (px, py) du plan, `scroll` px de défilement. */
function versEcran(px: number, py: number): { x: number; y: number } {
  const t = (ANGLE * Math.PI) / 180;
  return { x: L / 2 + px * Math.cos(t) - py * Math.sin(t), y: H / 2 + px * Math.sin(t) + py * Math.cos(t) };
}

export const mesuresMosaiqueVideos = (iHeros: number): MesuresElement => ({ evenements: [0, 1, 4, 8, 12, iHeros, iHeros + 4, iHeros + 8, -SORTIE], couvre: (f, duree) => (f < duree - SORTIE + 1 ? [{ x0: 0, y0: 0, x1: L, y1: H }] : []) });

export function MosaiqueVideos(p: PropsMosaiqueVideos) {
  const { ACCENT_1 } = accents(p.palette);
  const { f, duree } = p;
  const iS = duree - SORTIE;
  const sortie = prog(f, iS, SORTIE, aspire);
  if (f < 0 || sortie >= 1) return null;
  const scroll = f * VITESSE;
  const ty = -sortie * 1.15 * H;
  // Tuile héroïne : colonne centrale, la rangée la plus proche du centre de l'écran à l'image iHeros.
  const rHeros = 0;
  const yPlanHeros = (iRow: number) => iRow * PY + 280; // centre en repère plan (avant défilement)
  const heros = versEcran(0, yPlanHeros(rHeros) - iHerosScroll(p.iHeros));
  const tuiles: React.ReactNode[] = [];
  for (let r = -4; r <= 5; r++) {
    for (let c = -1; c <= 1; c++) {
      const cx = c * PX;
      const cy = yPlanHeros(r) - scroll;
      const e = versEcran(cx, cy);
      // seules les tuiles visibles sont montées (≈ 12 flux simultanés) ; chacune démarre à son apparition
      if (e.y < -0.5 * TH - 160 || e.y > H + 0.5 * TH + 160 || e.x < -TW || e.x > L + TW) continue;
      const estHeros = r === rHeros && c === 0;
      if (estHeros && f >= p.iHeros) continue;
      const idx = indexSource(r, c, p.sources.length);
      const rang = (r + 4) * 3 + (c + 1);
      const apparition = rang % 2; // cascade d'apparition : grille complète à i1, AUCUN grossissement (tour 2)
      if (f < apparition) continue;
      tuiles.push(
        <div key={`${r}:${c}`} style={{ position: "absolute", left: e.x - TW / 2, top: e.y - TH / 2, width: TW, height: TH, transform: `rotate(${ANGLE}deg)` }}>
          <Tuile nom={p.sources[idx]} depuis={0.2 + (idx % 3) * 0.4} bord={BLANC} />
        </div>,
      );
    }
  }
  // La tuile qui sort de la grille.
  const kH = f - p.iHeros;
  const sH = kH >= 0 ? ress("CLAQUE", f, p.iHeros) : 0;
  const echelleH = lerp(1, 1.9, sH);
  const rotH = lerp(ANGLE, 0, Math.min(1, sH));
  const cible = { x: L / 2, y: 0.45 * H };
  const posH = { x: lerp(heros.x, cible.x, Math.min(1, sH)), y: lerp(heros.y, cible.y, Math.min(1, sH)) };
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: ENCRE, transform: `translateY(${ty.toFixed(2)}px)` }}>
      {tuiles}
      {kH >= 0 ? (
        <Ancre x={posH.x} y={posH.y} transform={`rotate(${rotH.toFixed(2)}deg) scale(${echelleH.toFixed(3)})`}>
          <div style={{ width: TW, height: TH }}>
            <Tuile nom={p.sources[indexSource(rHeros, 0, p.sources.length)]} depuis={0.2 + (indexSource(rHeros, 0, p.sources.length) % 3) * 0.4} bord={ACCENT_1} epaisseur={10 / echelleH} depart={p.iHeros / 30} />
          </div>
        </Ancre>
      ) : null}
      <Impact f={f} f0={p.iHeros + 5} x={posH.x + (TW * echelleH) / 2} y={posH.y - (TH * echelleH) / 2} angles={[-80, -45, -10]} r0={36} />
      {kH >= 4 ? <EtiquetteBord f={f} debut={p.iHeros + 4} fin={iS - 3} x={posH.x - 10} y={posH.y + (TH * echelleH) / 2} texte={p.motFort} fond={ACCENT_1} corps={66} inclinaison={-3} /> : null}
      <Sons
        liste={[
          { f: 0, nom: "whoosh-in" },
          { f: p.iHeros, nom: "select_001" },
          { f: iS, nom: "whoosh-out" },
        ]}
      />
    </div>
  );
}

const indexSource = (r: number, c: number, n: number): number => ((((r + 6) * 3 + (c + 1)) % n) + n) % n;
const iHerosScroll = (i: number): number => i * VITESSE;

function Tuile({ nom, depuis, bord, epaisseur, depart }: { nom: string; depuis: number; bord: string; epaisseur?: number; depart?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, borderRadius: RAYON.TUILE, overflow: "hidden", background: ENCRE, boxShadow: ombre("S"), border: `${epaisseur ?? TRAIT.MOYEN}px solid ${bord}`, boxSizing: "border-box" }}>
      <Clip nom={nom} depuisSec={depuis + (depart ?? 0)} />
    </div>
  );
}

/** Sous-titres : sous la tuile qui sort (0,82 H, § C.3). */
export const sousTitresMosaique = (): number => 0.82 * H;
