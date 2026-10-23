import React from "react";
/**
 * 17 — `FilEtape` : le fil conducteur (motif récurrent), standard v4 § F.17.
 * (b) carte-titre « ÉTAPE 2 · LE FORMAT » (M1) avec 6 carrés : les précédents sont cochés en cascade, le carré actif passe ACCENT_1 ;
 * (a) puis la pastille « ÉTAPE 2/6 » ENCRE + 6 points, collée dans la bande IVOIRE du haut (la prise reste à D1) ;
 * (c) la barre de progression permanente est dans `BarreProgression.tsx`.
 * `i` = image locale, `i0` = mot « étape ». Sorties : la carte se réduit vers la pastille en 5 i (translation + échelle 1 → 0,35) puis la pastille pop ; pastille S-RETRECIT 3 i, aucun reste.
 * Vie : pulsation de la carte et de la pastille toutes les 12 i, jamais figée plus de 12 i.
 */
import { useCurrentFrame } from "remotion";
import { Anim, onde, Coche, COULEURS, CoqueCarte, courbe, DESCENTE, INTER, melange, MONTSERRAT, accents, ombre, ressort, Son, TRAIT, RAYON, W } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type PropsFilEtape = {
  palette: Palette;
  etape?: number; total?: number; titre?: string;
  /** Durée totale de l'élément (images). */
  duree?: number;
  /** Afficher la pastille après la carte. */
  pastille?: boolean;
  /** Images (locales) des mots déclencheurs : [carte (i0 = 0), pastille]. */
  mots?: number[];
  tick?: boolean;
};

const I_SORTIE_CARTE = 33;
/** La carte-titre se réduit vers la pastille (5 i) : c'est ce qui fait le « fil ». */
const VERS = { dx: 0, dy: 62 - (112 + 115), echelle: 0.35 };
export const dureeFilEtape = (p: PropsFilEtape): number => p.duree ?? (p.pastille === false ? 38 : 80);
export const clesPriseFilEtape = (): ClePrise[] => [{ i: 0, D: DESCENTE.D1 }];

export function evenementsFilEtape(p: PropsFilEtape): number[] {
  const n = p.total ?? 6, e = p.etape ?? 2, ev = [0];
  for (let k = 0; k < n; k++) ev.push(3 + 2 * k);
  for (let k = 0; k < e - 1; k++) ev.push(12 + 2 * k);
  ev.push(12 + 2 * (e - 1) + 2, I_SORTIE_CARTE);
  if (p.pastille !== false) { const ip = I_SORTIE_CARTE + 4; for (let t = ip; t < dureeFilEtape(p) - 3; t += 12) ev.push(t); }
  return ev;
}

export function FilEtape(props: PropsFilEtape) {
  const i = useCurrentFrame();
  const { palette, etape = 2, total = 6, titre = "LE FORMAT", pastille = true } = props;
  const { ACCENT_1 } = accents(palette);
  const duree = dureeFilEtape(props);
  const E = COULEURS.ENCRE;
  const iP = I_SORTIE_CARTE + 4;
  const wC = 864, hC = 230, xC = (W - wC) / 2;
  const sons: React.ReactNode[] = [<Son key="s0" i0={0} fichier="select_001" volume={0.25} />];
  for (let k = 0; k < etape - 1; k++) sons.push(<Son key={`t${k}`} i0={12 + 2 * k} fichier={k % 2 ? "tick_002" : "tick_001"} volume={0.45} />);
  sons.push(<Son key="ta" i0={12 + 2 * (etape - 1) + 2} fichier="tick_004" volume={0.5} />);
  if (pastille) sons.push(<Son key="sp" i0={iP} fichier="select_002" volume={0.22} />);

  const carres = Array.from({ length: total }, (_, k) => {
    const ik = 3 + 2 * k;
    const p = ressort("POP", i - ik);
    const vis = i >= ik;
    const passe = k < etape - 1, actif = k === etape - 1;
    const iC = 12 + 2 * k;
    const iA = 12 + 2 * (etape - 1) + 2;
    let fond: string = COULEURS.BLANC;
    if (passe) fond = melange(COULEURS.BLANC, E, courbe(i, iC, 2));
    if (actif) fond = melange(COULEURS.BLANC, ACCENT_1, courbe(i, iA, 3));
    const claque = actif ? 1 + 0.15 * (1 - ressort("CLAQUE", i - iA)) * (i >= iA ? 1 : 0) : 1;
    const nombre = k + 1;
    return (
      <div key={k} style={{ width: 88, height: 88, boxSizing: "border-box", border: `${TRAIT.FIN}px solid ${E}`, borderRadius: RAYON.TUILE, background: fond, display: "flex", alignItems: "center", justifyContent: "center",
        transform: `scale(${(vis ? (0.3 + 0.7 * p) * claque : 0).toFixed(3)})`, boxShadow: actif && i >= iA ? ombre("S") : "none", fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 44, color: E, position: "relative" }}>
        {passe && i >= iC + 2 ? <div style={{ transform: `scale(${(i >= iC + 6 ? 1 + 0.12 * (1 - ressort("CLAQUE", i - (iC + 6))) : 1).toFixed(3)})` }}><Coche taille={52} p={courbe(i, iC + 2, 4)} couleur={COULEURS.BLANC} /></div> : <span style={{ opacity: passe ? 0 : 1 }}>{nombre}</span>}
      </div>
    );
  });

  const pointActif = (k: number) => {
    const ik = iP + 4;
    if (k < etape - 1) return 1;
    if (k === etape - 1) return courbe(i, ik, 3);
    return 0;
  };
  const pulse = (iPulse: number) => (i >= iPulse && i < iPulse + 6 ? 1 + 0.5 * Math.sin(((i - iPulse) / 6) * Math.PI) : 1);
  const pointVie = 1 + 0.4 * onde(i - (iP + 14), 12);

  return (
    <>
      {sons}
      <Anim i={i} i0={0} iSortie={I_SORTIE_CARTE} sortie="vers" vers={VERS} incl={-3} x={xC} y={112} w={wC} h={hC} z={4} vie={{ debut: 12 + 2 * (etape - 1) + 10 }} id="carte-titre">
        <CoqueCarte palette={palette} w={wC} h={hC} entete={84} titre={`ÉTAPE ${etape} · ${titre}`} droite={null}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 40 }}>{carres}</div>
        </CoqueCarte>
      </Anim>
      {pastille ? (
        <Anim i={i} i0={iP} iSortie={duree - 3} incl={0} x={(W - 520) / 2} y={30} w={520} h={64} z={6} vie={{ debut: iP + 8 }} id="bande-pastille">
          <div style={{ width: 520, height: 64, boxSizing: "border-box", background: E, border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.PILULE, boxShadow: `0 0 0 3px ${COULEURS.IVOIRE_CLAIR}, ${ombre("S")}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 18, color: COULEURS.BLANC, fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 36, letterSpacing: "0.02em" }}>
            <span>{`ÉTAPE ${etape}/${total}`}</span>
            <span style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: INTER }}>
              {Array.from({ length: total }, (_, k) => {
                const f = pointActif(k);
                const pl = k === etape - 1 ? pulse(iP + 18) * pulse(iP + 32) * pointVie : 1;
                return <span key={k} style={{ width: 18, height: 18, borderRadius: 9, boxSizing: "border-box", background: melange(COULEURS.GRIS, ACCENT_1, f), border: `2px solid ${COULEURS.BLANC}`, transform: `scale(${pl})` }} />;
              })}
            </span>
          </div>
        </Anim>
      ) : null}
    </>
  );
}
