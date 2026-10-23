import React from "react";
/**
 * Élément 14 `CarteCalendrier` (lot 2) : la semaine qui se remplit. Grille LUN → DIM, pastilles (icônes) qui tombent dans les cases, 1 toutes
 * les 5 i, chute de 0,05 H avec CLAQUE ; au mot « tout seuls », 3 pastilles d'un coup. `decl` = [première pastille, « tout seuls »].
 */
import { useCurrentFrame } from "remotion";
import { accents, COULEURS, CoqueCarte, Ico, PastilleEntete, pulsation, ressort, Sons, styleInter, TRAIT, vieEntre } from "./commun-lot2";
import type { NomIcone, Palette } from "./commun-lot2";

const { ENCRE, BLANC, GRIS } = COULEURS;
const JOURS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
const ICONES: NomIcone[] = ["appel", "mail", "calendrier", "personne", "doc", "horloge", "bulle", "eclair", "etoile", "avion"];
const CASES: [number, number][] = [[0, 0], [2, 1], [4, 0], [1, 2], [3, 1], [0, 2], [2, 0], [4, 2], [1, 1], [3, 0], [4, 1], [2, 2]];

export type PropsCarteCalendrier = { palette: Palette; duree: number; decl: number[]; avecSons?: boolean; /** En-tête (mot DIT) ; absent : « MA SEMAINE ». */ titre?: string; /** Pastille d'en-tête ; "" : aucune ; absent : « SEMAINE ». */ pastille?: string; /** « points » : 7 points à la place des jours LUN…DIM (mots non dits) ; défaut « texte ». */ jours?: "texte" | "points" };

/** Pastilles : { case, image locale d'arrivée }. 1 toutes les 5 i avant « tout seuls », 3 d'un coup à « tout seuls », puis 2 de plus. */
export function planPastilles(decl: number[]): { c: number; f: number }[] {
  const [d0, d1] = decl;
  const res: { c: number; f: number }[] = [];
  let c = 0;
  for (let f = d0; f < d1 - 2; f += 5) res.push({ c: c++, f });
  for (let k = 0; k < 3; k++) res.push({ c: c++, f: d1 });
  res.push({ c: c++, f: d1 + 8 }, { c: c++, f: d1 + 14 });
  return res.slice(0, CASES.length);
}
export function evenementsCalendrier(decl: number[], duree: number): number[] {
  const p = planPastilles(decl);
  return [0, ...p.map((x) => x.f).filter((f, k, a) => a.indexOf(f) === k), duree - 3];
}

export function CarteCalendrier({ palette, duree, decl, avecSons = true, titre = "MA SEMAINE", pastille = "SEMAINE", jours = "texte" }: PropsCarteCalendrier) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const plan = planPastilles(decl);
  const colL = 838 / 7;
  const vie = vieEntre(evenementsCalendrier(decl, duree), duree);
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9]];
  plan.forEach((p, k) => {
    if (k % 2 === 0 || p.f === decl[1]) sons.push([p.f + 2, `drop_00${(k % 4) + 1}`, 0.08]);
  });
  return (
    <>
      <CoqueCarte palette={palette} titre={titre} i={i} duree={duree} vie={vie} pastille={pastille ? <PastilleEntete>{pastille}</PastilleEntete> : undefined}>
        {JOURS.map((j, k) => (
          <div key={j} style={{ position: "absolute", left: 38 + k * colL, width: colL, top: 16, height: 50, display: "flex", alignItems: "center", justifyContent: "center", ...styleInter(28, 800) }}>
            {jours === "points" ? <div style={{ width: 22, height: 22, borderRadius: 999, background: k >= 5 ? GRIS : ENCRE, border: `${TRAIT.FIN}px solid ${ENCRE}`, boxSizing: "border-box" }} /> : j}
          </div>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].flatMap((col) =>
          [0, 1, 2].map((lig) => (
            <div key={`${col}-${lig}`} style={{ position: "absolute", left: 38 + col * colL + 3, top: 74 + lig * 110, width: colL - 6, height: 100, boxSizing: "border-box", background: col >= 5 ? GRIS : BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12 }} />
          ))
        )}
        {plan.map((p, k) => {
          const [col, lig] = CASES[p.c];
          const e = ressort("CLAQUE", i - p.f);
          if (i < p.f) return null;
          const fond = k % 4 === 3 ? BLANC : k % 5 === 4 ? ACCENT_2 : ACCENT_1;
          return (
            <div key={k} style={{ position: "absolute", left: 38 + col * colL + (colL - 82) / 2, top: 74 + lig * 110 + 9, width: 82, height: 82, boxSizing: "border-box", background: fond, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: 14, boxShadow: "4px 5px 0 0 " + ENCRE, display: "flex", alignItems: "center", justifyContent: "center", opacity: Math.min(1, (i - p.f + 1) / 1), transform: `translateY(${-0.05 * 1920 * (1 - e)}px) scale(${k >= plan.length - 4 ? pulsation(i, vie, 0.1) : 1})` }}>
              <Ico nom={ICONES[k % ICONES.length]} taille={44} fond={fond === BLANC ? ACCENT_1 : BLANC} />
            </div>
          );
        })}
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
