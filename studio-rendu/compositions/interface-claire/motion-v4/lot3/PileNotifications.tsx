import React from "react";
/**
 * 24 — `PileNotifications` (★ gardé par Will, re-habillé v4), standard § F.24 (M7 : bas, y 0,52 → 0,70 H, zone sûre des réseaux).
 * 1 à 3 bulles de notification BLANC (contour 5, ombre S, rayon 18) : icône dans une pastille ACCENT_1 à gauche, titre Inter 800 36,
 * sous-ligne Inter 600 28 (décor). Chaque bulle arrive en E-BAS (5 i) sur son mot ; les précédentes remontent de 0,075 H (144 px) et passent à l'échelle 0,96 (titres toujours entiers : décalage 144 px) ; sortie en cascade S-COTE droite (3 i), l'icône part avec sa bulle.
 * Aucune bulle ne touche le visage (tout est sous y 0,52 H).
 */
import { Easing, useCurrentFrame } from "remotion";
import { ZONE_SURE_916 } from "../communs/zone-sure-v4";
import { accents, Anim, COULEURS, courbe, DESCENTE, H, INTER, MONTSERRAT, ombre, OMBRE, RAYON, ressort, Son, TRAIT, W } from "./commun-lot3";
import type { ClePrise, Palette } from "./commun-lot3";

export type Bulle = { titre: string; sous?: string; icone?: "avion" | "bulle" | "coche" };
export type PropsPileNotifications = {
  palette: Palette;
  bulles?: Bulle[];
  duree?: number;
  /** Images locales d'arrivée de chaque bulle (une par bulle). Défaut : 0, 14, 28. */
  mots?: number[];
  ding?: boolean;
};

const DEFAUT: Bulle[] = [
  { titre: "Relance envoyée", sous: "à l'instant", icone: "avion" },
  { titre: "Le client répond", sous: "à l'instant", icone: "bulle" },
  { titre: "Devis signé", sous: "à l'instant", icone: "coche" },
];
const arrivees = (p: PropsPileNotifications): number[] => p.mots ?? (p.bulles ?? DEFAUT).map((_, k) => 14 * k);
const EXIT_PAS = 2;
export const dureePileNotifications = (p: PropsPileNotifications): number => {
  const a = arrivees(p);
  return p.duree ?? a[a.length - 1] + 18 + EXIT_PAS * (a.length - 1) + 4;
};
export const clesPrisePileNotifications = (): ClePrise[] => [];
export function evenementsPileNotifications(p: PropsPileNotifications): number[] {
  const a = arrivees(p), d = dureePileNotifications(p), n = a.length;
  const ev: number[] = [...a];
  a.forEach((v, k) => { if (k > 0) ev.push(v + 2); });
  const iS0 = d - 4 - EXIT_PAS * (n - 1);
  for (let k = 0; k < n; k++) ev.push(iS0 + EXIT_PAS * k);
  for (let t = a[n - 1] + 9; t < iS0; t += 12) ev.push(t);
  return ev;
}

/**
 * Zone sûre TikTok / Reels / Shorts : bord bas (ombre comprise) ≤ 0,70 H (les réseaux posent leur interface dans les 0,30 H du bas) ; haut ≥ 0,52 H
 * (visage entier : il finit à 0,52 H à D0). Bulles de 116 px, décalage 0,052 H = 100 px (chevauchement de 16 px, le titre reste entier, la sous-ligne
 * n'existe que sur la dernière bulle) : la pile de 3 bulles tient entre 0,52 H et 0,70 H.
 */
export const BAS_MAX_BULLES = 1 - ZONE_SURE_916.bas;
export const HAUT_MIN_BULLES = 0.52;
const BW = 940, BH = 116, BX = (W - BW) / 2, DECAL = 0.052 * H;
const Y_BAS = BAS_MAX_BULLES * H - BH - TRAIT.MOYEN - OMBRE.S[1];
/** Haut et bas (fractions de H) de la pile de `n` bulles (1 à 3) à l'état posé, contour et ombre compris. */
export const empriseBulles = (n: number): { haut: number; bas: number } => ({ haut: (Y_BAS - DECAL * (n - 1) - TRAIT.MOYEN) / H, bas: (Y_BAS + BH + TRAIT.MOYEN + OMBRE.S[1]) / H });

function Icone({ type, couleur }: { type: Bulle["icone"]; couleur: string }) {
  const E = COULEURS.ENCRE;
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" fill="none" stroke={E} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
      {type === "avion" ? <path d="M6 24 L42 8 L32 40 L24 28 Z M24 28 L42 8" fill={couleur} /> : null}
      {type === "bulle" ? <path d="M8 10 H40 V32 H22 L12 40 V32 H8 Z" fill={couleur} /> : null}
      {type === "coche" ? <path d="M10 25 L21 35 L39 13" /> : null}
    </svg>
  );
}

export function PileNotifications(props: PropsPileNotifications) {
  const i = useCurrentFrame();
  const { palette, ding = true } = props;
  const bulles = props.bulles ?? DEFAUT;
  const { ACCENT_1 } = accents(palette);
  const E = COULEURS.ENCRE;
  const a = arrivees(props);
  const n = bulles.length;
  const d = dureePileNotifications(props);
  const iS0 = d - 4 - EXIT_PAS * (n - 1);
  const sons: React.ReactNode[] = [];
  a.forEach((v, k) => sons.push(<Son key={`v${k}`} i0={v} fichier="vibreur" volume={0.3} />));
  if (ding) sons.push(<Son key="d" i0={a[n - 1] + 2} fichier="ding-5" volume={0.35} />);
  return (
    <>
      {sons}
      {bulles.map((b, k) => {
        // rang courant : 0 pour la dernière arrivée ; chaque nouvelle arrivée décale les précédentes
        let rang = 0;
        for (let m = k + 1; m < n; m++) rang += ressort("GLISSE", i - a[m]);
        const monte = -DECAL * rang;
        const ech = 1 - 0.04 * rang;
        return (
          <Anim key={k} i={i} i0={a[k]} iSortie={iS0 + EXIT_PAS * k} entree="bas" sortie="retrecit" incl={k % 2 ? 1.5 : -1.5} x={BX} y={Y_BAS + monte} w={BW} h={BH} z={4 + k} vie={{ debut: a[k] + 8 + 3 * k }} id={`bulle-${k}`}
            extra={`scale(${ech.toFixed(4)})`}>
            <div style={{ width: BW, height: BH, boxSizing: "border-box", background: COULEURS.BLANC, border: `${TRAIT.MOYEN}px solid ${E}`, borderRadius: RAYON.CARTE, boxShadow: ombre("S"), display: "flex", alignItems: "center", gap: 28, padding: "0 30px" }}>
              <div style={{ width: 92, height: 92, borderRadius: "50%", boxSizing: "border-box", background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${E}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icone type={b.icone} couleur={COULEURS.BLANC} />
              </div>
              <div>
                <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 46, color: E, lineHeight: 1.12 }}>{b.titre}</div>
                {b.sous && rang < 0.5 ? <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 28, color: E, lineHeight: 1.2, opacity: 0.8 }}>{b.sous}</div> : null}
              </div>
            </div>
          </Anim>
        );
      })}
    </>
  );
}
