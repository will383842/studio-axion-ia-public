import React from "react";
/**
 * MAQUETTES (passe « variété », designer n° 2, 15/10/2026) — décor commun aux 4 maquettes de `variantes/`.
 * Prototypes seulement : rien ici n'est lu par le moteur ni par `Racine.tsx` / `Compositions.tsx`.
 *
 *  - mode « bande »   : la prise de Will DESCEND (rebond 3-4 images) sous une carte posée sur la bande ivoire ; le visage
 *                       reste ENTIER sous la carte (yeux à bas de carte + 0,14 H) ;
 *  - mode « panneau » : la prise ne bouge pas ; un panneau ivoire tombe et couvre TOUT le visage (cheveux → menton).
 * Jamais de zoom ni de mouvement de caméra sur la prise (décision de Will du 15/10).
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img } from "remotion";
import { COULEURS, GEOMETRIE, POLICES, TEMPS, largeurTexte } from "../charte";
import { styleBoite } from "../elements";
import { rebond } from "../mouvement";

/** Yeux de la prise fixe des maquettes (`prise-fixe.jpg`, extraite de `prise-large.mp4`), en fraction de H. */
export const YEUX_PRISE = 0.305;
/** Écart yeux ↔ bas de carte : visage entier sous la carte (cheveux compris à 0,165 H au-dessus des yeux). */
const YEUX_SOUS_CARTE = 0.17;

/** Carte sur la bande : de 0,13 H à 0,50 H (hauteur maximale permise par `cadrage.ts`, CARTE.basMax). */
export const CARTE_MAQUETTE = Object.freeze({ y0: GEOMETRIE.carteY, y1: 0.5 });
/** Panneau qui couvre tout le visage : 0,045 → 0,955 L, 0,055 → 0,625 H (visage de la prise : 0,14 → 0,50 H). */
export const PANNEAU = Object.freeze({ x0: 0.045, x1: 0.955, y0: 0.055, y1: 0.625 });

export type Mot = { texte: string; a: number; fort?: boolean };

export function Scene({ t, mode, fond, mots, enfants, largeur: W, hauteur: H }: { t: number; mode: "bande" | "panneau"; fond: string; mots: Mot[]; enfants: ReactNode; largeur: number; hauteur: number }) {
  const descente = mode === "bande" ? CARTE_MAQUETTE.y1 + YEUX_SOUS_CARTE - YEUX_PRISE : 0;
  const d = descente * rebond(t, 0, TEMPS.entreeCarte, 1.3);
  return (
    <AbsoluteFill style={{ background: COULEURS.encre, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateY(${d * H}px)` }}>
        <Img src={fond} style={{ width: W, height: H, objectFit: "cover" }} />
      </AbsoluteFill>
      {/* Bande ivoire : remplit exactement le haut libéré par la descente. */}
      {mode === "bande" ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: d * H + 2, background: COULEURS.ivoire }} /> : null}
      {enfants}
      <SousTitre t={t} mots={mots} y={(mode === "bande" ? 0.86 : 0.74) * H} largeur={W} />
    </AbsoluteFill>
  );
}

/** Sous-titre mot à mot simplifié (groupes de 3 mots, mot fort sur plaque orange) : seulement pour situer la phrase. */
function SousTitre({ t, mots, y, largeur: W }: { t: number; mots: Mot[]; y: number; largeur: number }) {
  const i = mots.reduce((k, m, j) => (t >= m.a ? j : k), -1);
  if (i < 0) return null;
  const debut = i - (i % 3);
  const groupe = mots.slice(debut, Math.min(debut + 3, i + 1));
  const taille = Math.min(W * 0.062, (W * 0.9) / Math.max(1, largeurTexte(mots.slice(debut, debut + 3).map((m) => m.texte).join(" "), 1)));
  return (
    <div style={{ position: "absolute", left: 0, width: W, top: y, display: "flex", justifyContent: "center", gap: taille * 0.3, transform: "translateY(-50%)" }}>
      {groupe.map((m, j) => {
        const actif = debut + j === i;
        const s = actif ? 0.7 + 0.3 * rebond(t, m.a, 0.12, 2) : 1;
        const style: CSSProperties = m.fort
          ? { ...styleBoite(W, COULEURS.orange, taille * 0.2), padding: `0 ${taille * 0.2}px`, color: COULEURS.ivoire }
          : { color: COULEURS.ivoire, textShadow: `0 0 ${taille * 0.08}px ${COULEURS.encre}, ${taille * 0.05}px ${taille * 0.06}px 0 ${COULEURS.encre}` };
        return (
          <span key={j} style={{ fontFamily: POLICES.titre, fontSize: taille, textTransform: "uppercase", lineHeight: 1.15, whiteSpace: "nowrap", transform: `scale(${s})`, WebkitTextStroke: m.fort ? undefined : `${Math.max(2, taille * 0.05)}px ${COULEURS.encre}`, paintOrder: "stroke fill", ...style }}>
            {m.texte}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Panneau ivoire qui TOMBE du haut (0,2 s, rebond) et couvre tout le visage. En-tête orange avec titre, pastille
 * « EXEMPLE » à droite. `enfants` reçoit la place intérieure (px).
 */
export function Panneau({ t, largeur: W, hauteur: H, titre, icone, enfants }: { t: number; largeur: number; hauteur: number; titre: string; icone?: ReactNode; enfants: (l: number, h: number) => ReactNode }) {
  const x = PANNEAU.x0 * W;
  const y = PANNEAU.y0 * H;
  const l = (PANNEAU.x1 - PANNEAU.x0) * W;
  const h = (PANNEAU.y1 - PANNEAU.y0) * H;
  const e = rebond(t, 0, 0.2, 1.4);
  const hEntete = H * 0.05;
  const contour = Math.max(3, Math.round(W * 0.0045));
  const taille = hEntete * 0.52;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `translateY(${-(1 - e) * (y + h + 40)}px) rotate(${-3 * (1 - e)}deg)`, transformOrigin: "50% 0%", ...styleBoite(W, COULEURS.ivoire), overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ height: hEntete, flexShrink: 0, background: COULEURS.orange, borderBottom: `${contour}px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", gap: hEntete * 0.25, padding: `0 ${hEntete * 0.35}px` }}>
        {icone}
        <span style={{ flex: 1, fontFamily: POLICES.titre, fontSize: taille, color: COULEURS.ivoire, textTransform: "uppercase", letterSpacing: 0.6, whiteSpace: "nowrap" }}>{titre}</span>
        <span style={{ fontFamily: POLICES.titre, fontSize: taille * 0.72, color: COULEURS.ivoire, background: COULEURS.encre, borderRadius: 8, padding: `2px ${taille * 0.35}px` }}>EXEMPLE</span>
      </div>
      <div style={{ position: "relative", flex: 1 }}>{enfants(l - 2 * contour, h - hEntete - 3 * contour)}</div>
    </div>
  );
}

/** Tremblement déterministe (px ou degrés) : amplitude `amp` qui s'éteint en `duree` secondes après `a`. */
export function secousse(t: number, a: number, duree: number, amp: number, graine = 0): number {
  if (t < a || t > a + duree) return 0;
  const k = 1 - (t - a) / duree;
  return Math.sin((t - a) * 95 + graine) * amp * k * k;
}
