/**
 * C11-E4 (NEUF, non branché, non inscrit) : deux options ANONYMES face à face. Colonnes identiques (taille, fond, poids) : aucun gagnant,
 * ni coche, ni croix, ni score. Un texte refusé, manquant, ou plus de 4 critères : fond seul, rien d'écrit.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../../src/briques/jetons-motion";
import { entreeEcranCompose, geometrieDuel, MAX_CRITERES_DUEL } from "../../../../src/briques/motion/ecrans-couverture/ecrans-composes";
import { textesGeneriques } from "../../../../src/briques/motion/ecrans-couverture/textes-generiques";
import { chargerPoliceMarque } from "../police-marque";

/** Éteint : aucun branchement. */
export const DUEL_ACTIVE = false;

const chargerManropeDuel = chargerPoliceMarque;

export type CritereDuel = { libelle: string; gauche: string; droite: string };
export type ProprietesDuel = { gauche?: string; droite?: string; criteres?: CritereDuel[] };

const plein = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";

export function Duel({ gauche, droite, criteres = [] }: ProprietesDuel) {
  chargerManropeDuel();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const fond = <AbsoluteFill style={{ background: CHARTE_AXION.ivoire }} />;
  if (!plein(gauche) || !plein(droite) || criteres.length > MAX_CRITERES_DUEL) return fond;
  if (!criteres.every((c) => c && plein(c.libelle) && plein(c.gauche) && plein(c.droite))) return fond;
  const tous = [gauche, droite, ...criteres.flatMap((c) => [c.libelle, c.gauche, c.droite])];
  if (textesGeneriques(tous).length > 0) return fond;
  const g = geometrieDuel({ largeur: width, hauteur: height, criteres: criteres.length });
  const e = entreeEcranCompose(frame / fps, 0);
  const texte = (r: { x: number; y: number; w: number; h: number }, t: string, poids: number, taille: number) => (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 4%", boxSizing: "border-box", fontWeight: poids, fontSize: taille, lineHeight: 1.15, color: CHARTE_AXION.noir }}>{t}</div>
  );
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, fontFamily: FAMILLE_CSS_AXION }}>
      <div style={{ position: "absolute", inset: 0, opacity: e.opacite, transform: `scale(${e.echelle})` }}>
        {g.colonnes.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, borderRadius: c.rayon, background: CHARTE_AXION.gris }} />
        ))}
        {texte(g.entetes[0], gauche, 800, Math.round(height * 0.035))}
        {texte(g.entetes[1], droite, 800, Math.round(height * 0.035))}
        {criteres.map((c, i) => (
          <React.Fragment key={i}>
            {texte(g.lignes[i].gauche, `${c.libelle} : ${c.gauche}`, 600, Math.round(height * 0.024))}
            {texte(g.lignes[i].droite, `${c.libelle} : ${c.droite}`, 600, Math.round(height * 0.024))}
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
}
