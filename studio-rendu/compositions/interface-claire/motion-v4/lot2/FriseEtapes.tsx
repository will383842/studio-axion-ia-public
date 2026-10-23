import React from "react";
/**
 * Élément 16 `FriseEtapes` (lot 2, gabarit M3 grande carte) : 4-5 étapes en ligne verticale reliées par un trait ENCRE 5 px ; rond numéroté à
 * gauche, libellé à droite. Chaque étape dite → rond ACCENT_1 + libellé allumé + le trait se remplit jusqu'à elle en 6 i ; un badge « ● SIGNÉ »
 * pop à droite sur la dernière. `decl[k]` = image locale du mot qui cite l'étape k.
 */
import { useCurrentFrame } from "remotion";
import { accents, CARTE, CoqueCarte, COULEURS, courbe, lerp, melange, PastilleEntete, Plaque, Pop, pulsation, ressort, Rouleau, Sons, SONS_TICK, styleInter, styleMontserrat, TRAIT, vieEntre } from "./commun-lot2";
import type { Palette } from "./commun-lot2";

const { ENCRE, BLANC, GRIS } = COULEURS;

export type PropsFriseEtapes = {
  palette: Palette;
  duree: number;
  decl: number[];
  etapes?: string[];
  badge?: string;
  avecSons?: boolean;
};

export function evenementsFrise(decl: number[], duree: number): number[] {
  const dernier = decl[decl.length - 1];
  return [0, ...decl, ...decl.map((d) => d + 6), dernier + 3, dernier + 8, duree - 3];
}

export function FriseEtapes({ palette, duree, decl, etapes = ["La demande arrive", "Le devis part", "La relance suit", "Le client signe"], badge = "SIGNÉ", avecSons = true }: PropsFriseEtapes) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const n = etapes.length;
  const y = (k: number) => 80 + k * (n === 5 ? 112 : 140);
  const xRond = 100;
  let progY = y(0);
  decl.forEach((d, k) => {
    if (k > 0) progY = i >= d ? lerp(y(k - 1), y(k), courbe(i, d, 6)) : progY;
  });
  const vie = vieEntre(evenementsFrise(decl, duree), duree);
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9]];
  decl.forEach((d, k) => sons.push([d, k === n - 1 ? "confirmation_002" : SONS_TICK[k % 3], k === n - 1 ? 0.18 : 0.28]));
  return (
    <>
      <CoqueCarte
        palette={palette}
        titre="LE PARCOURS"
        haute
        vie={vie}
        i={i}
        duree={duree}
        pastille={
          <PastilleEntete>
            <Rouleau valeurs={["0/" + n, ...etapes.map((_, k) => `${k + 1}/${n}`)]} frames={[0, ...decl]} i={i} hauteur={56} />
          </PastilleEntete>
        }
        debord={
          <Pop i={i} i0={decl[n - 1] + 4} x={CARTE.largeur - 52} y={113 + y(n - 1)} rotation={5} nom="CLAQUE">
            <div style={{ transform: `scale(${pulsation(i, vie, 0.06)})` }}>
              <Plaque fond={ACCENT_2} corps={38} texte={"● " + badge} />
            </div>
          </Pop>
        }
      >
        {/* trait de liaison + remplissage */}
        <div style={{ position: "absolute", left: xRond - 4, top: y(0), width: 8, height: y(n - 1) - y(0), background: ENCRE }} />
        <div style={{ position: "absolute", left: xRond - 9, top: y(0), width: 18, height: Math.max(0, progY - y(0)), boxSizing: "border-box", background: ACCENT_1, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 7 }} />
        {etapes.map((e, k) => {
          const d = decl[k];
          const on = i >= d;
          const pulse = on && i < d + 6 ? 1 + 0.18 * Math.sin((Math.PI * (i - d)) / 6) : on && (k === n - 1 || i < decl[k + 1]) ? pulsation(i, vie, 0.1) : 1;
          return (
            <React.Fragment key={k}>
              <div style={{ position: "absolute", left: xRond - 42, top: y(k) - 42, width: 84, height: 84, boxSizing: "border-box", borderRadius: "50%", background: melange(GRIS, ACCENT_1, courbe(i, d, 3)), border: `${TRAIT.MOYEN}px solid ${ENCRE}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pulse})`, ...styleMontserrat(42) }}>{k + 1}</div>
              <div style={{ position: "absolute", left: 170, top: y(k) - 48, height: 96, display: "flex", alignItems: "center", transform: `scale(${on ? 0.94 + 0.06 * ressort("POP", i - d) : 1})`, transformOrigin: "0% 50%" }}>
                <div style={{ position: "relative", padding: "6px 22px", ...styleInter(46, 800, { color: on ? ENCRE : GRIS }) }}>
                  <div style={{ position: "absolute", left: 0, bottom: 4, height: 18, width: `${(100 * courbe(i, d, 4)).toFixed(1)}%`, background: ACCENT_1, zIndex: 0 }} />
                  <span style={{ position: "relative", zIndex: 1 }}>{e}</span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
