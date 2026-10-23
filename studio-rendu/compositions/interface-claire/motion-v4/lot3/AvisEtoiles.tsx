import React from "react";
/**
 * 19 — `AvisEtoiles` : note en étoiles, standard v4 § F.19. JAMAIS d'avis client ni de note de clients, et plus de pastille « 5/5 » (risque DGCCRF) :
 * c'est Will qui qualifie SON agent (« devient niveau expert »). M1 : carte IVOIRE_CLAIR 820 × 290 avec en-tête ACCENT_1 « L'AGENT » (38 px),
 * 5 étoiles grises qui POP sur « devient », libellé ENCRE « NIVEAU EXPERT » à cheval sur le bord bas, étoiles qui se remplissent une à une
 * (CLAQUE 1,2 → 1) sur « expert », pulsation de toutes les étoiles sur chaque « cinq » dit. Vie : une pulsation toutes les 12 i au plus.
 */
import { useCurrentFrame } from "remotion";
import { accents, Anim, COULEURS, courbe, DESCENTE, Etoile, lerp, melange, MONTSERRAT, onde, ombre, Plaque, ressort, RAYON, Son, TRAIT, W } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsAvisEtoiles = {
  palette: Palette;
  entete?: string;
  libelle?: string;
  note?: number;
  duree?: number;
  /** Images locales : [carte (0), « devient » (pop des étoiles grises), libellé, 1ʳᵉ étoile remplie, 1er « cinq », 2ᵉ « cinq »]. */
  mots?: number[];
  ding?: boolean;
};

export const dureeAvisEtoiles = (p: PropsAvisEtoiles): number => p.duree ?? 54;
export const clesPriseAvisEtoiles = (): ClePrise[] => [{ i: 0, D: DESCENTE.D1 }];

const tpl = (p: PropsAvisEtoiles) => {
  const m = p.mots ?? [];
  const iD = m[1] ?? 2, il = m[2] ?? iD + 8, f0 = m[3] ?? il + 10;
  const c1 = m[4] ?? f0 + 14, c2 = m[5] ?? c1 + 10;
  return { iD, il, f0, c1, c2 };
};
export function evenementsAvisEtoiles(p: PropsAvisEtoiles): number[] {
  const { iD, il, f0, c1, c2 } = tpl(p), n = p.note ?? 5;
  const ev = [0, il];
  for (let k = 0; k < 5; k++) ev.push(iD + 2 * k);
  for (let k = 0; k < n; k++) ev.push(f0 + 3 * k);
  ev.push(c1, c2);
  for (let t = c2 + 8; t < dureeAvisEtoiles(p) - 3; t += 12) ev.push(t);
  ev.push(dureeAvisEtoiles(p) - 3);
  return ev;
}

export function AvisEtoiles(props: PropsAvisEtoiles) {
  const i = useCurrentFrame();
  const { palette, entete = "L'AGENT", libelle = "NIVEAU EXPERT", note = 5, ding = true } = props;
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const E = COULEURS.ENCRE;
  const { iD, il, f0, c1, c2 } = tpl(props);
  const iSortie = dureeAvisEtoiles(props) - 3;
  const wC = 820, hC = 290, xC = (W - wC) / 2, yC = 100, hE = 78;
  const sons: React.ReactNode[] = [<Son key="s" i0={0} fichier="select_001" volume={0.25} />];
  for (let k = 0; k < note; k++) sons.push(<Son key={`t${k}`} i0={f0 + 3 * k} fichier={k % 2 ? "tick_002" : "tick_004"} volume={0.4} />);
  if (ding) sons.push(<Son key="d" i0={f0 + 3 * (note - 1) + 1} fichier="ding-4" volume={0.35} />);
  // pulsation commune des étoiles sur chaque « cinq », puis une vague toutes les 12 i (une étoile après l'autre)
  const pulseCinq = (1 + 0.1 * onde(i - c1, 100, 5)) * (1 + 0.1 * onde(i - c2, 100, 5));
  const etoiles = Array.from({ length: 5 }, (_, k) => {
    const ik = iD + 2 * k, ir = f0 + 3 * k;
    const vis = i >= ik;
    const p = ressort("POP", i - ik);
    const rempli = k < note ? courbe(i, ir, 3) : 0;
    const claque = i >= ir && k < note ? 1 + 0.2 * (1 - ressort("CLAQUE", i - ir)) : 1;
    const vague = 1 + 0.08 * onde(i - (c2 + 8 + 2 * k), 12, 4);
    return (
      <div key={k} style={{ transform: `scale(${vis ? ((0.3 + 0.7 * p) * claque * pulseCinq * vague).toFixed(3) : 0})`, position: "relative" }}>
        <Etoile taille={118} fond={melange(COULEURS.GRIS, ACCENT_2, rempli)} />
        {k === note - 1 && i >= ir && i < ir + 8 ? (
          <>
            {[0, 1, 2, 3].map((e) => {
              const a = (-60 + e * 40) * (Math.PI / 180) - Math.PI / 2 + (e > 1 ? 0.4 : 0);
              const q = courbe(i, ir, 7);
              const r = lerp(52, 100, q);
              return <div key={e} style={{ position: "absolute", left: 59 + Math.cos(a) * r * 1.2 - 6, top: 62 + Math.sin(a) * r * 1.2 - 17, width: 12, height: 34 * (1 - 0.6 * q), background: E, borderRadius: 3, transform: `rotate(${(a * 180) / Math.PI + 90}deg)` }} />;
            })}
          </>
        ) : null}
      </div>
    );
  });
  return (
    <>
      {sons}
      <Anim i={i} i0={0} iSortie={iSortie} incl={-2} x={xC} y={yC} w={wC} h={hC} z={4} id="carte-avis">
        <div style={{ position: "relative", width: wC, height: hC, boxSizing: "border-box", background: COULEURS.IVOIRE_CLAIR, border: `${TRAIT.FORT}px solid ${E}`, borderRadius: RAYON.CARTE, boxShadow: ombre("M"), overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: hE, boxSizing: "border-box", background: ACCENT_1, borderBottom: `${TRAIT.MOYEN}px solid ${E}`, display: "flex", alignItems: "center", padding: "0 30px",
            fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 38, letterSpacing: "0.04em", color: E }}>{entete}</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: hE, bottom: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>{etoiles}</div>
        </div>
      </Anim>
      <Anim i={i} i0={il} iSortie={iSortie} incl={1.5} x={xC + 120} y={yC + hC - 34} z={6} origine="50% 50%" vie={{ debut: il + 8 }} id="libelle-avis">
        <Plaque fond={E} texte={COULEURS.BLANC} corps={58}>{libelle}</Plaque>
      </Anim>
    </>
  );
}
