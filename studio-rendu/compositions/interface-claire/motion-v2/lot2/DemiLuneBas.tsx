/**
 * ÉLÉMENT 9 « DEMI-LUNE-BAS » (standard v2, lot 2 « Géométrie franche »).
 *
 * Emplacement E4 bas, DÉCENTRÉ (CORRIGÉ le 16/10) : disque ORANGE plein de 1,2 L de diamètre, anneau encre de 0,02 L, centre à
 * (0,46 L ; 1,068 H) : sommet à 0,73 H posé (0,69 H au dépassement), le mot en ivoire suit l'arc, incliné de −8° (centré à gauche du sommet). Forme F1 géant tronqué ; le mot ivoire SUIT L'ARC.
 * Mouvement M1 vertical (le dôme MONTE du bas avec JAILLIR, départ 0,18 H plus bas, il dépasse de ≈ 0,03 H puis se pose),
 * puis les lettres arrivent en cascade de 1 i le long de l'arc (chacune avec son petit jaillissement).
 * Visage : ENTIER (le dôme ne dépasse jamais 0,68 H).
 * Quand : un résultat, une conclusion (« et voilà »).
 *
 * Image par image (i0 = mot dit) : i-1 pré-éclat orange au sommet · i0-i14 le dôme monte et se pose · i5 + k : la lettre k
 * jaillit · pose : les pointillés orange du bord tournent (0,2 % L par image), deux pastilles sable encadrent le mot ·
 * sortie 7 i : anticipation vers le haut (2 i, −0,015 H) puis le dôme PLONGE hors cadre (Easing.in cubic).
 * Bruitage : `maximize_004` à i0.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { aspiration, borne01, courbe, FPS_V2, imageDepuis, ressort } from "./outils";
import type { BruitageMotion, FicheElementV2 } from "./outils";

export const ID_DEMI_LUNE_BAS = "demi-lune-bas";
export const DUREE_DEMI_LUNE = Object.freeze({ min: 1.4, max: 3 });

export const FICHE_DEMI_LUNE_BAS: FicheElementV2 = Object.freeze({
  id: ID_DEMI_LUNE_BAS,
  nom: "Demi-lune du bas (le mot suit l'arc)",
  emplacement: "E4 bas",
  forme: "F1 géant tronqué",
  mouvement: "M1 vertical + cascade de lettres sur l'arc",
  visage: "entier" as const,
  quandUtiliser: "Un résultat ou une conclusion (« et voilà »).",
  dureeMin: DUREE_DEMI_LUNE.min,
  dureeMax: DUREE_DEMI_LUNE.max,
});

export type DemiLuneBasProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Le mot ou les deux mots DITS par Will (12 lettres au plus). */
  mot: string;
};

const G = Object.freeze({ diametre: 1.2, centreY: 1.068, centreX: 0.46, inclinaison: -8, montee: 0.18, sortieImages: 7, ouvertureMax: 80 });

export function DemiLuneBas(p: DemiLuneBasProps) {
  const { t, debut, fin, largeurImage: W, hauteurImage: H } = p;
  const i = imageDepuis(t, debut);
  if (i < -1 || t >= fin) return null;
  const r = (G.diametre * W) / 2;
  const cx = G.centreX * W;
  const cyFinal = G.centreY * H;

  // Pré-éclat à i-1 : un point orange au futur sommet.
  if (i < 0) {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: cx - 0.015 * W, top: cyFinal - r - 0.015 * W, width: 0.03 * W, height: 0.03 * W, borderRadius: "50%", background: COULEURS.orange }} />
      </div>
    );
  }

  const e = ressort("JAILLIR", i);
  const iSortie = (t - (fin - G.sortieImages / FPS_V2)) * FPS_V2;
  const sortie = iSortie < 0 ? 0 : iSortie < 2 ? -0.015 * H * courbe(iSortie, 0, 2) : -0.015 * H + (0.4 * H) * aspiration(courbe(iSortie, 2, 5));
  const cy = cyFinal + G.montee * H * (1 - e) + sortie;

  // Lettres le long de l'arc (rayon de la ligne de base : r − 110 px), angle total ≤ 80°.
  const lettres = [...p.mot.toUpperCase()];
  const Rt = r - 0.13 * W;
  const parUnite = largeurTexte(p.mot, 1, 0.06);
  const taille = Math.min(0.1 * W, ((G.ouvertureMax * Math.PI) / 180) * Rt * 0.92 / Math.max(1, parUnite));
  const largeurs = lettres.map((l) => largeurTexte(l, taille, taille * 0.06));
  const total = largeurs.reduce((a, b) => a + b, 0);
  let cumul = -total / 2;
  const posLettres = lettres.map((l, k) => {
    const milieu = cumul + largeurs[k] / 2;
    cumul += largeurs[k];
    return { l, angle: (milieu / Rt) * (180 / Math.PI) + G.inclinaison };
  });
  const demiOuverture = (total / 2 / Rt) * (180 / Math.PI);

  const rBord = r - 0.032 * W;
  const defile = i * 0.002 * W;
  const sable = (sens: 1 | -1) => {
    const a = ((G.inclinaison + sens * (demiOuverture + 9)) * Math.PI) / 180;
    return <circle key={sens} cx={cx + Rt * Math.sin(a)} cy={cy - Rt * Math.cos(a)} r={0.011 * W * borne01(i / 6)} fill={COULEURS.sable} />;
  };

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill={COULEURS.encre} />
        <circle cx={cx} cy={cy} r={r - 0.02 * W} fill={COULEURS.orange} />
        <circle cx={cx} cy={cy} r={rBord} fill="none" stroke={COULEURS.ivoire} strokeWidth={0.008 * W} strokeDasharray="46 26" strokeDashoffset={-defile} opacity={0.7} />
        {sable(-1)}
        {sable(1)}
        {posLettres.map((pl, k) => {
          const s = ressort("JAILLIR", i - (5 + k));
          if (s <= 0) return null;
          return (
            <g key={k} transform={`rotate(${pl.angle} ${cx} ${cy}) translate(${cx} ${cy - Rt - (1 - Math.min(1, s)) * 0.03 * H}) scale(${s})`} opacity={borne01(s * 3)}>
              <text x={0} y={0} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={taille} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={taille * 0.05} paintOrder="stroke">
                {pl.l}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Bruitage : `maximize_004` à l'arrivée du dôme. */
export function bruitagesDemiLuneBas(p: Pick<DemiLuneBasProps, "debut">): BruitageMotion[] {
  return [[p.debut, "maximize_004", 0.08]];
}

/** Exemple : Will conclut « et voilà ». */
export const EXEMPLE_DEMI_LUNE_BAS = {
  phrase: "Vous n'avez plus rien à faire, et voilà.",
  proprietes: { debut: 1.0, fin: 3.0, mot: "Et voilà" } satisfies Omit<DemiLuneBasProps, "t" | "largeurImage" | "hauteurImage">,
  imagesPlanche: [1, 3, 5, 9, 28],
};
