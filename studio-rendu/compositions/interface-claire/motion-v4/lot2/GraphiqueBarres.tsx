import React from "react";
/**
 * Élément 13 `GraphiqueBarres` (lot 2) : graphique qui monte. Axe ENCRE 5 px qui s'étire (4 i), 5 barres ACCENT_1 en cascade de 3 i (8 i de
 * montée), au mot fort la dernière barre grandit encore (CLAQUE) et passe ACCENT_2 ; puce « ↗ ×2 » qui déborde, SEULEMENT si « deux fois » est dit.
 * `decl` = [axe, mot fort (« doublé »), puce (« deux fois »)].
 */
import { Easing, useCurrentFrame } from "remotion";
import { accents, CARTE, CoqueCarte, COULEURS, courbe, Ico, melange, PastilleEntete, Plaque, Pop, pulsation, ressort, Sons, SONS_TICK, styleInter, TRAIT, vieEntre } from "./commun-lot2";
import type { Palette } from "./commun-lot2";

const { ENCRE, GRIS, BLANC } = COULEURS;

export type PropsGraphiqueBarres = {
  palette: Palette;
  duree: number;
  decl: number[];
  titre?: string;
  /** Hauteurs relatives (0-1) des barres ; la dernière est celle qui double. */
  barres?: number[];
  puce?: string;
  /** Pastille d'en-tête ; "" : aucune ; absent : « RÉPONSES ». */
  pastille?: string;
  avecSons?: boolean;
};

export function evenementsGraphique(decl: number[], duree: number, nBarres = 5): number[] {
  const bars = Array.from({ length: nBarres }, (_, k) => decl[0] + 4 + 3 * k);
  return [0, decl[0], ...bars, decl[1], decl[1] + 3, decl[2], decl[2] + 4, duree - 3];
}

export function GraphiqueBarres({ palette, duree, decl, titre = "TAUX DE RÉPONSE", barres = [0.46, 0.44, 0.5, 0.47, 0.48], puce = "×2", avecSons = true, pastille = "RÉPONSES" }: PropsGraphiqueBarres) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const [iAxe, iFort, iPuce] = decl;
  const n = barres.length;
  const largeur = 112;
  const ecart = 38;
  const x0 = 120;
  const yBase = 398;
  const hMax = 340;
  const vie = vieEntre(evenementsGraphique(decl, duree), duree);
  const xDernier = x0 + (n - 1) * (largeur + ecart);
  const hAvant = hMax * barres[n - 1];
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9]];
  barres.forEach((_, k) => sons.push([iAxe + 4 + 3 * k + 5, SONS_TICK[k % 3], 0.26]));
  sons.push([iFort, "ding-3", 0.2], [iPuce, "select_002", 0.2]);
  return (
    <>
      <CoqueCarte
        palette={palette}
        titre={titre}
        i={i}
        duree={duree}
        vie={vie}
        pastille={pastille ? <PastilleEntete>{pastille}</PastilleEntete> : undefined}
        debord={
          <Pop i={i} i0={iPuce} x={CARTE.largeur - 100} y={176} rotation={6} nom="CLAQUE">
            <div style={{ transform: `scale(${pulsation(i, vie, 0.1)})` }}>
              <Plaque fond={ACCENT_2} corps={46}>
                <Ico nom="fleche" taille={50} trait={ENCRE} epaisseur={3} />
              </Plaque>
            </div>
          </Pop>
        }
      >
        {/* repères en pointillés (décor) */}
        {[0.5, 1].map((r) => (
          <div key={r} style={{ position: "absolute", left: 76, width: 780 * courbe(i, iAxe, 4), top: yBase - hMax * r, height: 0, borderTop: `3px dashed ${GRIS}` }} />
        ))}
        {/* axes : E-ETIRE en 4 i */}
        <div style={{ position: "absolute", left: 70, top: yBase - (hMax + 24) * courbe(i, iAxe, 4, Easing.out(Easing.cubic)), width: 5, height: (hMax + 24) * courbe(i, iAxe, 4, Easing.out(Easing.cubic)), background: ENCRE }} />
        <div style={{ position: "absolute", left: 70, top: yBase, width: 790 * courbe(i, iAxe, 4, Easing.out(Easing.cubic)), height: 5, background: ENCRE }} />
        {/* ligne pointillée « AVANT » à la hauteur des barres 1 à 4 : se trace en 6 i, 10 i après le mot fort */}
        <div style={{ position: "absolute", left: x0 - 20, width: (xDernier + largeur - x0 + 40) * courbe(i, iFort + 10, 6), top: yBase - hAvant - 2, height: 0, borderTop: `5px dashed ${ENCRE}` }} />
        {i >= iFort + 12 && (
          <div style={{ position: "absolute", left: x0 - 20, top: yBase - hAvant - 44, ...styleInter(28, 800), opacity: i >= iFort + 14 ? 1 : 0 }}>AVANT</div>
        )}
        {barres.map((v, k) => {
          const d = iAxe + 4 + 3 * k;
          const montee = ressort("GLISSE", (i - d) * 0.9);
          const dernier = k === n - 1;
          const double = dernier ? ressort("CLAQUE", i - iFort) : 0;
          const h = Math.max(0, dernier ? hMax * (v * montee + (Math.min(0.97, v * 2) - v) * double) : hMax * v * montee);
          if (i <= d) return null;
          const couleur = dernier ? melange(ACCENT_1, ACCENT_2, courbe(i, iFort, 3)) : ACCENT_1;
          return <div key={k} style={{ position: "absolute", left: x0 + k * (largeur + ecart), top: yBase - h, width: largeur, height: h, boxSizing: "border-box", background: couleur, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderBottom: "none", borderRadius: "10px 10px 0 0", boxShadow: "5px 0 0 0 " + ENCRE }} />;
        })}
        {/* valeur de la barre, posée sur son sommet quand « deux fois » est dit */}
        {i >= iPuce && (
          <div style={{ position: "absolute", left: xDernier - 24, top: yBase - hMax * Math.min(0.97, barres[n - 1] * 2) + 6, transformOrigin: "100% 50%", transform: `translate(-100%, 0) scale(${(0.3 + 0.7 * ressort("CLAQUE", i - iPuce)) * pulsation(i, vie, 0.1)})` }}>
            <Plaque fond={BLANC} corps={48} texte={puce} />
          </div>
        )}
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
