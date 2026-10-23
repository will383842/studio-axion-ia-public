import React from "react";
/**
 * ÉLÉMENT 19 « TRAITS DE VITESSE » (lot 4 « Impact / énergie », standard DA v2 § D).
 *  - Emplacement E3 (droite, y 0,26 → 0,50 H), 7 barres de vitesse (épaisseurs de 0,004 à 0,014 L, encre et orange) qui
 *    jaillissent du bord droit en cascade de 1 image, puis un MOT (F11, ivoire à contour encre) arrive en glissement
 *    diagonal (M8 : étirement de 6 %, 2 copies fantômes) et freine en passant de −12° à 0.
 *  - Quand : vitesse DITE (« vite », « en un clic », « tout de suite »). Le mot est celui que Will prononce.
 *  - Visage : ENTIER. Tout reste à droite de x = 0,77 L (les barres font au plus 0,24 L) : jamais dans Z.
 *    Le mot est dimensionné pour tenir entre la zone interdite et le bord du cadre (jamais coupé) ; il vaut donc mieux un
 *    mot court (≤ 6 lettres : « VITE », « CLIC »).
 *  - Sortie : BALAYAGE INVERSE (les barres se retirent en cascade inverse, le mot repart vers la droite, étiré).
 *  - Micro-vie : les barres vibrent (±4 % de longueur, déphasées) tant qu'elles sont posées.
 *  - Prise : jamais touchée. Bruitage : whoosh-in.
 */
import { COULEURS, largeurTexte, POLICES } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { alea, BruitageMotion, FPS, lerp, ressort, secousse, sortieCubique } from "./outils4";

export type DonneesTraitsVitesse = { debut: number; fin: number; mot: string };

export const FICHE_TRAITS_VITESSE = Object.freeze({
  id: "traits-vitesse",
  nom: "Traits de vitesse",
  lot: 4,
  emplacement: "E3" as const,
  forme: "barres+F11" as const,
  mouvement: "M8" as const,
  sortie: "balayage inverse" as const,
  visage: "entier" as const,
  dureeMin: 1.0,
  dureeMax: 2.0,
  quandUtiliser: "Vitesse : « vite », « en un clic », « tout de suite ». Mot court dit par Will.",
});

export const EXEMPLE_TRAITS_VITESSE: DonneesTraitsVitesse = { debut: 0.2, fin: 1.9, mot: "Vite" };
export const INSTANTS_TRAITS_VITESSE = [0, 3, 7, 10, 24] as const;

/** Barres : [ordonnée (fraction de H), épaisseur (fraction de L), bord gauche visible (fraction de L), couleur]. Elles débordent du cadre à droite. */
const BARRES: [number, number, number, string][] = [
  [0.25, 0.012, 0.8, COULEURS.encre],
  [0.30, 0.022, 0.86, COULEURS.orange],
  [0.35, 0.008, 0.81, COULEURS.encre],
  [0.40, 0.022, 0.84, COULEURS.orange],
  [0.45, 0.014, 0.8, COULEURS.encre],
  [0.50, 0.009, 0.85, COULEURS.orange],
  [0.55, 0.018, 0.82, COULEURS.encre],
];
const SORTIE = 6; // images de la sortie
const ARRIVEE_MOT = 5; // le mot part à i5

export function TraitsVitesse({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_TRAITS_VITESSE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesTraitsVitesse }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const k = (t - d.debut) * FPS;
  const kFin = (d.fin - d.debut) * FPS;
  if (k < 0 || k >= kFin) return null;
  const kS = k - (kFin - SORTIE); // > 0 pendant la sortie

  // Le mot : taille calée pour tenir entre Z (x ≥ 0,77 L) et le bord, centre vers 0,885 L.
  const dispo = W * 0.17;
  const tailleMot = Math.min(W * 0.09, dispo / Math.max(1, largeurTexte(d.mot, 1)));
  const xMot = W * 0.9;
  const yMot = H * 0.4;
  const angle = Math.atan2(116, -320); // glissement diagonal d'environ 20°
  void angle;
  const km = k - ARRIVEE_MOT;
  const pm = ressort(km, "GLISSER");
  const off = (p: number) => ({ x: (1 - p) * W * 0.3, y: -(1 - p) * W * 0.3 * 0.364 });
  const etire = km > 0 && km < 3 ? 1.06 : 1;
  const rot = lerp(-18, -6, pm);
  const sortieMot = kS > 0 ? sortieCubique(kS / SORTIE) : 0;
  const dxSortie = sortieMot * W * 0.3;
  const choc = km > 7 ? secousse(km - 7, 0.008 * W) : 0;
  const fantomes = km > 0 && km < 3 ? [1, 2] : [];

  const Mot = ({ dx, dy, opacite, r }: { dx: number; dy: number; opacite: number; r: number }) => (
    <g transform={`translate(${xMot + dx} ${yMot + dy}) rotate(${r}) scale(${etire} 1)`} opacity={opacite}>
      <text x={tailleMot * 0.05} y={tailleMot * 0.36 + tailleMot * 0.05} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleMot} fill={COULEURS.encre}>{d.mot.toUpperCase()}</text>
      <text x={0} y={tailleMot * 0.36} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleMot} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={tailleMot * 0.16} paintOrder="stroke fill" strokeLinejoin="round">{d.mot.toUpperCase()}</text>
    </g>
  );

  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "hidden" }}>
      {BARRES.map(([y, ep, lg, couleur], j) => {
        // Entrée : cascade de 1 image ; sortie : cascade inverse.
        const kb = k - j;
        const p = ressort(kb, "GLISSER");
        const kbS = kS - (BARRES.length - 1 - j) * 0.6;
        const retrait = kbS > 0 ? sortieCubique(kbS / 3) : 0;
        if (p <= 0.001 || retrait >= 1) return null;
        const vib = 1 + 0.04 * Math.sin(k * 0.9 + alea(j) * 6) * (kb > 6 ? 1 : 0);
        const longueur = (1.04 - lg * vib) * W; // du bord gauche visible jusqu'au-delà du bord droit
        const xDroite = W + 0.04 * W;
        const avance = p - retrait * 1.3 > 0 ? p - retrait * 1.3 : 0.0001;
        const bord = xDroite - longueur * avance;
        return <line key={j} x1={bord} y1={y * H} x2={xDroite} y2={y * H} stroke={couleur} strokeWidth={ep * W} strokeLinecap="round" />;
      })}
      {fantomes.map((g) => {
        const p = ressort(km - g * 0.7, "GLISSER");
        const o = off(p);
        return <Mot key={g} dx={o.x} dy={o.y} opacite={g === 1 ? 0.3 : 0.15} r={lerp(-18, -6, p)} />;
      })}
      {km > 0 ? <Mot dx={off(pm).x + dxSortie + choc} dy={off(pm).y} opacite={1} r={rot} /> : null}
    </svg>
  );
}

export function bruitagesTraitsVitesse(d: DonneesTraitsVitesse = EXEMPLE_TRAITS_VITESSE): BruitageMotion[] {
  return [[d.debut, "whoosh-in", 0.1]];
}
