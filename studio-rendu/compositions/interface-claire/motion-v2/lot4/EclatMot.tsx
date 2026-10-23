import React from "react";
/**
 * ÉLÉMENT 16 « ÉCLAT-MOT » (lot 4 « Impact / énergie », standard DA v2 § D).
 *  - Emplacement E1 (haut, coin gauche : centre 0,18 L ; 0,095 H, diamètre 0,36 L soit environ 7 % de l'image ; posé incliné de −10°), forme F5 (éclat orange de 14 branches
 *    alternées longues et courtes), mot ivoire (contour encre), mouvement M1 avec rotation de −45° à 0.
 *  - Quand : une annonce ou une nouveauté DITE (« nouveau », « enfin »). Le mot est TOUJOURS un mot prononcé par Will.
 *  - Visage : ENTIER. Aucune branche n'entre dans la zone interdite Z, même au plus fort du dépassement (les branches qui
 *    visent le visage sont raccourcies : l'éclat est volontairement dissymétrique, il « part » vers le coin).
 *  - Micro-vie : rotation de 0,2°/image. Sortie : ENVOL vers le haut-gauche (anticipation de 2 images, puis départ).
 *  - Prise : jamais touchée. Bruitage : maximize_006 à i0 (+ « pop » à sourcer en CC0).
 */
import { COULEURS, largeurTexte, POLICES } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { BruitageMotion, borne, cheminEtoile, distanceBoite, FPS, lerp, PRISE_DEFAUT, PriseVisage, ressort, sortieCubique, zoneZ } from "./outils4";

export type DonneesEclatMot = {
  /** i0 : instant (s) où Will prononce le mot. */
  debut: number;
  fin: number;
  /** Mot DIT par Will (12 lettres au plus). */
  mot: string;
  prise?: PriseVisage;
};

export const FICHE_ECLAT_MOT = Object.freeze({
  id: "eclat-mot",
  nom: "Éclat-mot",
  lot: 4,
  emplacement: "E1" as const,
  forme: "F5" as const,
  mouvement: "M1" as const,
  sortie: "envol" as const,
  visage: "entier" as const,
  dureeMin: 1.0,
  dureeMax: 2.2,
  quandUtiliser: "Une annonce ou une nouveauté dite : « nouveau », « enfin ». Jamais un mot que Will n'a pas prononcé.",
});

export const EXEMPLE_ECLAT_MOT: DonneesEclatMot = { debut: 0.2, fin: 1.9, mot: "Enfin" };
/** Instants de la bande de 5 images, en images depuis i0. */
export const INSTANTS_ECLAT_MOT = [1, 3, 5, 9, 30] as const;

const N = 14;
const SURTIR = 5; // images de sortie

export function EclatMot({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_ECLAT_MOT }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesEclatMot }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const k = (t - d.debut) * FPS;
  const kFin = (d.fin - d.debut) * FPS;
  if (k < -1 || k >= kFin) return null;
  const cx = 0.18 * W;
  const cy = 0.095 * H;
  const R = 0.18 * W;
  const Z = zoneZ(W, H, d.prise ?? PRISE_DEFAUT);
  // Pré-éclat : un point orange à l'emplacement, une seule image.
  if (k < 0) return <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}><circle cx={cx} cy={cy} r={0.015 * W} fill={COULEURS.orange} /></svg>;

  const s = ressort(k, "JAILLIR");
  const rot0 = lerp(-55, -10, s);
  const rotVie = k > 14 ? (k - 14) * 0.2 : 0;
  const ouv = borne(k / 2, 0, 1);
  // Sortie : envol (anticipation 2 images à −3 %, puis départ vers le haut-gauche, hors du cadre).
  const kS = k - (kFin - SURTIR);
  const antic = kS > 0 ? Math.sin(Math.PI * borne(kS / 2, 0, 1) * 0.5) * -0.03 : 0;
  const vol = kS > 2 ? sortieCubique((kS - 2) / (SURTIR - 2)) : 0;
  const echelle = Math.max(0.0001, s * (1 + antic));
  const dx = -vol * (0.55 * W);
  const dy = -vol * (0.35 * H);

  // Branches limitées par Z (le dépassement du ressort peut atteindre ×1,17).
  const limite = (ang: number) => distanceBoite(cx, cy, ang + (rot0 + rotVie) * (Math.PI / 180), Z) / 1.17 - 4;
  const chemin = cheminEtoile(N, R, { vallee: 0.6, court: 0.84, rotation: -Math.PI / 2 + 0.11, graine: 5, limite });

  const ombre = 0.006 * W;
  const contour = 0.006 * W;
  const taille = Math.min(0.075 * W, (R * 0.6 * 2 * 0.9) / Math.max(1, largeurTexte(d.mot, 1)));
  const tailleTexte = Math.max(40, taille);
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
      <g transform={`translate(${cx + dx} ${cy + dy}) rotate(${rot0 + rotVie}) scale(${echelle})`} opacity={ouv}>
        <path d={chemin} fill={COULEURS.encre} transform={`translate(${ombre} ${ombre})`} />
        <path d={chemin} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} strokeLinejoin="round" />
        {/* reflet ivoire fin sur le bord haut-gauche (une seule direction de lumière) */}
        <path d={chemin} fill="none" stroke={COULEURS.ivoire} strokeOpacity={0.35} strokeWidth={2} strokeLinejoin="round" transform="translate(-2 -2)" />
        <g transform={`rotate(${-rot0 - rotVie - 10})`}>
          <text x={0} y={tailleTexte * 0.36} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleTexte} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={tailleTexte * 0.12} paintOrder="stroke fill" strokeLinejoin="round" letterSpacing={tailleTexte * 0.02}>
            {d.mot.toUpperCase()}
          </text>
        </g>
      </g>
    </svg>
  );
}

/** Bruitage : maximize_006 à i0 ; « pop » CC0 à sourcer (non fourni). */
export function bruitagesEclatMot(d: DonneesEclatMot = EXEMPLE_ECLAT_MOT): BruitageMotion[] {
  return [[d.debut, "maximize_006", 0.1]];
}
