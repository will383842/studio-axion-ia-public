import React from "react";
/**
 * 22 — `CarrouselFeuillete` : un vrai carrousel feuilleté, standard v4 § F.22 (M4 : fenêtre sur le visage).
 * Publication LinkedIn (pastille « AX », nom « Axion-IA », « · 1 j ») contenant des pages carrées qui se feuillettent à ≈ 3 pages/s
 * (glissement 4 i, une page toutes les 10 i) ; points de pagination ; étiquettes successives en E-POP qui chevauchent le bord bas.
 * Les pages sont des mises en page FACTICES sans texte inventé (grand chiffre de page + blocs de lignes + pictogramme).
 * E-COTE droite ; sortie S-COTE gauche 4 i. Palette : pages ACCENT_1 / IVOIRE / ENCRE / BLANC en alternance.
 */
import { Easing, useCurrentFrame } from "remotion";
import { accents, Anim, COULEURS, courbe, DESCENTE, INTER, MONTSERRAT, melange, ombre, Plaque, RAYON, Son, TRAIT } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsCarrouselFeuillete = {
  palette: Palette;
  etiquettes?: string[];
  pages?: number;
  duree?: number;
  /** Images locales : [fenêtre (0), étiquette 1, étiquette 2, étiquette 3] ; le feuilletage démarre à 12 i et fait 1 page / 10 i.
   *  Chaque étiquette sortante fait son S-RETRECIT (3 i) AVANT le pop de la suivante : jamais de chevauchement. */
  mots?: number[];
};

export const dureeCarrouselFeuillete = (p: PropsCarrouselFeuillete): number => p.duree ?? 80;
export const clesPriseCarrouselFeuillete = (): ClePrise[] => [{ i: 0, D: 0 }];
const I_FEUILLE = 12, PAS = 10, GLISSE = 4;

export function evenementsCarrouselFeuillete(p: PropsCarrouselFeuillete): number[] {
  const n = (p.pages ?? 6) - 1, ev = [0, 3];
  for (let k = 0; k < n; k++) ev.push(I_FEUILLE + PAS * k);
  (p.mots ?? [0, 6, 28, 50]).slice(1).forEach((m) => ev.push(m - 3, m));
  ev.push(dureeCarrouselFeuillete(p) - 4);
  return ev;
}

const X = 80, Y = 173, LF = 920, HF = 1037, ENTETE = 112, PAGE = 840, GAP = 24;

export function CarrouselFeuillete(props: PropsCarrouselFeuillete) {
  const i = useCurrentFrame();
  const { palette, pages = 6, etiquettes = ["CARROUSEL ENTIER", "À MA CHARTE", "PRÊT À PUBLIER"] } = props;
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const E = COULEURS.ENCRE;
  const mots = props.mots ?? [0, 6, 28, 50];
  const duree = dureeCarrouselFeuillete(props);
  const iS = duree - 4;
  // position de défilement en nombre de pages
  let n = 0;
  for (let k = 0; k < pages - 1; k++) n += courbe(i, I_FEUILLE + PAS * k, GLISSE, Easing.out(Easing.cubic));
  const sons: React.ReactNode[] = [<Son key="w" i0={0} fichier="whoosh-in" volume={0.45} />];
  for (let k = 0; k < pages - 1; k += 2) sons.push(<Son key={`p${k}`} i0={I_FEUILLE + PAS * k} fichier="select_002" volume={0.22} />);
  const fonds = [ACCENT_1, COULEURS.IVOIRE, E, COULEURS.BLANC, ACCENT_2, ACCENT_1];
  const textes = [E, E, COULEURS.BLANC, E, E, E];
  const page = (k: number) => (
    <div key={k} style={{ position: "absolute", left: 48 + k * (PAGE + GAP) - 0, top: 0, width: PAGE, height: PAGE, boxSizing: "border-box", background: fonds[k % fonds.length], border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.CARTE, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 50, top: 30, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 380, lineHeight: 1, color: textes[k % textes.length] }}>{Array.from({ length: (k % 3) + 1 }, (_, m) => <span key={m} style={{ display: "inline-block", width: 90, height: 90, borderRadius: m % 2 ? 20 : 45, background: textes[k % textes.length], marginRight: 26, marginTop: 120 }} />)}</div>
      <div style={{ position: "absolute", left: 50, top: 470, width: 480, height: 34, borderRadius: 8, background: textes[k % textes.length] }} />
      <div style={{ position: "absolute", left: 50, top: 540, width: 640, height: 22, borderRadius: 6, background: textes[k % textes.length], opacity: 1 }} />
      <div style={{ position: "absolute", left: 50, top: 590, width: 560, height: 22, borderRadius: 6, background: textes[k % textes.length] }} />
      <div style={{ position: "absolute", right: 50, top: 60, width: 190, height: 190, borderRadius: k % 2 ? 36 : 95, background: fonds[(k + 2) % fonds.length], border: `${TRAIT.MOYEN}px solid ${E}`, boxSizing: "border-box" }} />
      <div style={{ position: "absolute", right: 50, bottom: 50, width: 110, height: 110, borderRadius: 55, background: E, display: "flex", alignItems: "center", justifyContent: "center", color: COULEURS.BLANC, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 60 }}>→</div>
    </div>
  );
  const actif = Math.min(pages - 1, Math.round(n));
  const paires = etiquettes.map((txt, k) => ({ txt, i0: mots[k + 1] ?? 6 + 22 * k, iFin: k + 1 < etiquettes.length ? (mots[k + 2] ?? 6 + 22 * (k + 1)) - 3 : iS }));
  return (
    <>
      {sons}
      <Anim i={i} i0={0} iSortie={iS} sortie="coteG" entree="coteD" incl={2} x={X} y={Y} w={LF} h={HF} z={4} id="fenetre-carrousel">
        <div style={{ position: "relative", width: LF, height: HF, boxSizing: "border-box", border: `${TRAIT.FORT}px solid ${E}`, borderRadius: RAYON.FENETRE, boxShadow: ombre("L"), background: COULEURS.IVOIRE_CLAIR, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: ENTETE, display: "flex", alignItems: "center", gap: 22, padding: "0 34px", boxSizing: "border-box", borderBottom: `${TRAIT.FIN}px solid ${E}`, background: COULEURS.BLANC }}>
            <div style={{ width: 70, height: 70, borderRadius: 35, background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${E}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 30, color: E }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={E} strokeWidth={2.6} strokeLinecap="round"><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.6-4.2 3.5-6.2 7.5-6.2s6.9 2 7.5 6.2z" /></svg></div>
            <div style={{ width: 230, height: 24, borderRadius: 12, background: E }} />
            <div style={{ width: 90, height: 18, borderRadius: 9, background: E, opacity: 0.45 }} />
          </div>
          <div style={{ position: "absolute", left: 0, top: ENTETE + 20, width: LF, height: PAGE, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: -n * (PAGE + GAP), top: 0, width: 10000, height: PAGE }}>{Array.from({ length: pages }, (_, k) => page(k))}</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", gap: 16 }}>
            {Array.from({ length: pages }, (_, k) => <div key={k} style={{ width: 24, height: 24, borderRadius: 12, boxSizing: "border-box", border: `${TRAIT.FIN}px solid ${E}`, background: k === actif ? ACCENT_1 : COULEURS.BLANC }} />)}
          </div>
        </div>
      </Anim>
      {paires.map((q, k) => (
        <Anim key={k} i={i} i0={q.i0} iSortie={q.iFin} incl={k % 2 ? 3 : -3} x={70 + k * 40} y={Y + HF - 36} z={8} vie={{ debut: q.i0 + 8 }} id={`etiquette-${k}`}>
          <Plaque fond={k === 1 ? COULEURS.BLANC : ACCENT_1} corps={58}>{q.txt}</Plaque>
        </Anim>
      ))}
    </>
  );
}
