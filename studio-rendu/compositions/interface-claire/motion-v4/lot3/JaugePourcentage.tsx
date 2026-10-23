import React from "react";
/**
 * 23 — `JaugePourcentage` : le montage ou le travail qui avance, standard v4 § F.23 (M2 : carte haute, prise à D2).
 * Carte « MONTAGE · AGENT VIDÉO » : 3 pistes (vidéo ACCENT_1, texte BLANC, son GRIS), tête de lecture ENCRE qui avance, pourcentage géant
 * qui saute 12 → 38 → 69 → 100 % (CLAQUE à chaque saut), puce « PRÊT » ACCENT_2 qui déborde à la fin.
 * La valeur finale affichée est celle que Will DIT (par défaut « cent pour cent » : 100 %). Les valeurs intermédiaires sont des étapes de compteur.
 * Entrée E-CHUTE + DESCENTE D2 ; sortie S-REMONTE 3 i, la prise remonte 1 i après (clé `{ i: duree + 1, D: retour }` posée par le montage).
 */
import { useCurrentFrame } from "remotion";
import { accents, Anim, COULEURS, CoqueCarte, courbe, DESCENTE, INTER, lerp, MONTSERRAT, ombre, Plaque, pulsation, ressort, Son, TRAIT, RAYON, W } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsJaugePourcentage = {
  palette: Palette;
  titre?: string;
  valeurs?: number[];
  duree?: number;
  /** Images locales des sauts (une par valeur). Défaut : 4, 10, 16, 22. La tête de lecture va du 1ᵉʳ au dernier saut. */
  mots?: number[];
  ding?: boolean;
};

export const dureeJaugePourcentage = (p: PropsJaugePourcentage): number => p.duree ?? ((p.mots?.[p.mots.length - 1] ?? 22) + 20);
const sauts = (p: PropsJaugePourcentage): number[] => p.mots ?? [4, 10, 16, 22];
export const clesPriseJaugePourcentage = (): ClePrise[] => [{ i: 0, D: DESCENTE.D2 }];
export function evenementsJaugePourcentage(p: PropsJaugePourcentage): number[] {
  const s = sauts(p), d = dureeJaugePourcentage(p);
  const ev = [0, 2, 4, 6, ...s, s[s.length - 1] + 2];
  for (let t = s[s.length - 1] + 8; t < d - 3; t += 12) ev.push(t);
  return [...ev, d - 3];
}

const CW = 928, CH = 567, CX = (W - CW) / 2, CY = 82;
const ZONE_X = 190, ZONE_W = CW - 14 - 190 - 36; // zone des pistes (dans le corps de carte)

export function JaugePourcentage(props: PropsJaugePourcentage) {
  const i = useCurrentFrame();
  const { palette, titre = "MONTAGE · AGENT VIDÉO", valeurs = [12, 38, 69, 100], ding = true } = props;
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const E = COULEURS.ENCRE;
  const s = sauts(props);
  const duree = dureeJaugePourcentage(props);
  const iS = duree - 3;
  const dernier = s[s.length - 1];
  let k = -1;
  s.forEach((v, idx) => { if (i >= v) k = idx; });
  const pct = k >= 0 ? valeurs[k] : 0;
  const claque = k >= 0 ? 1 + 0.12 * (1 - ressort("CLAQUE", i - s[k])) : 1;
  const tete = courbe(i, s[0], dernier - s[0]);
  const pistes: { nom: string; fond: string; blocs: number[][] }[] = [
    { nom: "VIDÉO", fond: ACCENT_1, blocs: [[0, 0.3], [0.32, 0.62], [0.64, 1]] },
    { nom: "TEXTE", fond: COULEURS.BLANC, blocs: [[0.05, 0.2], [0.26, 0.48], [0.55, 0.7], [0.76, 0.96]] },
    { nom: "SON", fond: COULEURS.GRIS, blocs: [[0, 0.45], [0.48, 1]] },
  ];
  const sons: React.ReactNode[] = [<Son key="w" i0={0} fichier="whoosh-in" volume={0.45} />];
  s.forEach((v, idx) => sons.push(<Son key={`t${idx}`} i0={v} fichier={idx % 2 ? "tick_002" : "tick_001"} volume={0.45} />));
  if (ding) sons.push(<Son key="d" i0={dernier + 1} fichier="ding-2" volume={0.35} />);
  return (
    <>
      {sons}
      <Anim i={i} i0={0} iSortie={iS} entree="chute" sortie="remonte" incl={-1.5} x={CX} y={CY} w={CW} h={CH} z={4} id="carte-jauge">
        <CoqueCarte palette={palette} w={CW} h={CH} entete={106} titre={titre} debord={
          /* la puce est un enfant de la carte : elle part avec elle (plus de puce qui reste sur place à la remontée) */
          i >= dernier + 1 ? (
            <div style={{ position: "absolute", left: CW - 250, top: CH - 56, transform: `rotate(6deg) scale(${(0.3 + 0.7 * ressort("POP", i - (dernier + 1))) * pulsation(i, { debut: dernier + 9 })})`, transformOrigin: "50% 50%", zIndex: 6 }}>
              <Plaque fond={ACCENT_2} corps={50}>PRÊT</Plaque>
            </div>
          ) : null
        } droite={
          <div style={{ width: 22, height: 22, borderRadius: 11, background: i % 20 < 10 ? E : ACCENT_2, border: `${TRAIT.FIN}px solid ${E}`, boxSizing: "border-box" }} />
        }>
          <div style={{ position: "absolute", left: 36, top: 14, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 170, lineHeight: 1, color: E, fontVariantNumeric: "tabular-nums", transform: `scale(${(claque * (i >= dernier + 5 ? pulsation(i, { debut: dernier + 5, amp: 0.05 }) : 1)).toFixed(3)})`, transformOrigin: "0% 60%" }}>{pct}<span style={{ fontSize: 100 }}> %</span></div>
          {pistes.map((p, n) => (
            <div key={n} style={{ position: "absolute", left: 24, right: 24, top: 205 + n * 78, height: 62 }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: 150, height: 62, boxSizing: "border-box", border: `${TRAIT.FIN}px solid ${E}`, borderRadius: RAYON.CHAMP, background: COULEURS.IVOIRE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: INTER, fontWeight: 800, fontSize: 26, color: E }}>{p.nom}</div>
              <div style={{ position: "absolute", left: ZONE_X - 24, top: 0, width: ZONE_W, height: 62, boxSizing: "border-box", border: `${TRAIT.FIN}px solid ${E}`, borderRadius: RAYON.CHAMP, background: COULEURS.IVOIRE, overflow: "hidden" }}>
                {p.blocs.map((b, m) => {
                  const iB = lerp(s[0], dernier, b[0]) - 1;
                  const pop = courbe(i, iB, 3);
                  return <div key={m} style={{ position: "absolute", left: `${b[0] * 100}%`, width: `${(b[1] - b[0]) * 100 - 1}%`, top: 6, bottom: 6, background: p.fond, border: `${TRAIT.FIN}px solid ${E}`, borderRadius: 8, boxSizing: "border-box", transform: `scaleX(${pop})`, transformOrigin: "0% 50%" }} />;
                })}
              </div>
            </div>
          ))}
          {/* tête de lecture */}
          {i >= s[0] ? (
            <div style={{ position: "absolute", left: 24 + ZONE_X - 24 + ZONE_W * tete - 3, top: 188, width: 6, height: 270, background: E, borderRadius: 3, zIndex: 4 }}>
              <div style={{ position: "absolute", left: -11, top: -4, width: 28, height: 24, background: E, clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
            </div>
          ) : null}
        </CoqueCarte>
      </Anim>
    </>
  );
}
