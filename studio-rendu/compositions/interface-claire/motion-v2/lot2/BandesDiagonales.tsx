/**
 * ÉLÉMENT 7 « BANDES-DIAGONALES » (standard v2, lot 2 « Géométrie franche »).
 *
 * Emplacement E6 diagonale : la ligne de jonction va de 0,97 H (à gauche) à 0,79 H (à droite), soit −18° (CORRIGÉ le 16/10 :
 * deux bandes de 0,08 H, bord haut de la bande orange à 0,71 H au plus haut = hors de la bande des sous-titres ; surface ≈ 16 % de l'image).
 * Forme F8 : deux bandes parallèles qui traversent TOUTE la largeur (orange au-dessus, encre au-dessous), un mot DIT sur
 * chacune. Mouvement M8 : la bande orange arrive du bas-gauche, la bande encre du haut-droit 3 i plus tard, avec
 * étirement de 6 % et 2 copies fantômes pendant 3 i, arrêt net avec secousse légère (0,006 L) de l'ÉLÉMENT.
 * Visage : ENTIER (rien au-dessus de 0,64 H à droite, et la bande n'entre jamais dans la zone du visage).
 * Quand : deux mots qui vont ensemble (« simple · rapide »).
 *
 * Image par image (i0 = premier mot dit) : i0-i8 bande orange glisse (GLISSER) · i3-i11 bande encre glisse · i8 secousse
 * orange · i11 secousse encre · pose : défilement de pointillés (0,2 % L par image) · sortie 7 i : la bande orange
 * s'ENVOLE vers la droite après une anticipation de 2 i, la bande encre part vers la gauche 2 i après (jamais un fondu).
 * Bruitage : `whoosh-in` à i0, `drop_001` à l'arrêt de la 2e bande.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { aspiration, borne01, courbe, FPS_V2, imageDepuis, ressort, secousse } from "./outils";
import type { BruitageMotion, FicheElementV2 } from "./outils";

export const ID_BANDES_DIAGONALES = "bandes-diagonales";
export const DUREE_BANDES = Object.freeze({ min: 1.4, max: 2.8 });

export const FICHE_BANDES_DIAGONALES: FicheElementV2 = Object.freeze({
  id: ID_BANDES_DIAGONALES,
  nom: "Bandes diagonales (deux mots qui vont ensemble)",
  emplacement: "E6 diagonale",
  forme: "F8 bandes",
  mouvement: "M8 glissement diagonal + secousse",
  visage: "entier" as const,
  quandUtiliser: "Deux mots dits qui vont ensemble (« simple · rapide »).",
  dureeMin: DUREE_BANDES.min,
  dureeMax: DUREE_BANDES.max,
});

export type BandesDiagonalesProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Les deux mots DITS par Will : [mot sur la bande orange, mot sur la bande encre]. */
  mots: [string, string];
};

const G = Object.freeze({
  gauche: 0.97,
  droite: 0.79,
  epaisseur: 0.08,
  decalageEncre: 3,
  sortieImages: 7,
  longueur: 2.6,
  depart: 1.8,
  vitesseDefilement: 0.002,
});

export function BandesDiagonales(p: BandesDiagonalesProps) {
  const { t, debut, fin, largeurImage: W, hauteurImage: H } = p;
  const i = imageDepuis(t, debut);
  if (i < 0 || t >= fin) return null;

  const theta = (Math.atan2(-(G.gauche - G.droite) * H, W) * 180) / Math.PI;
  const T = G.epaisseur * H;
  const L = G.longueur * W;
  const D = G.depart * W;
  const yM = ((G.gauche + G.droite) / 2) * H;

  // Position le long de la bande (axe local x) d'une bande donnée à l'image `k` depuis son départ.
  const arrivee = (k: number, sens: 1 | -1) => sens * D * (1 - ressort("GLISSER", k));
  const iSortie = (t - (fin - G.sortieImages / FPS_V2)) * FPS_V2;
  const sortieOrange = iSortie < 0 ? 0 : iSortie < 2 ? -0.03 * W * courbe(iSortie, 0, 2) : -0.03 * W + 1.9 * W * aspiration(courbe(iSortie, 2, 5));
  const sortieEncre = iSortie < 2 ? 0 : -1.9 * W * aspiration(courbe(iSortie, 2, 5));

  const kO = i;
  const kE = i - G.decalageEncre;
  const xO = arrivee(kO, -1) + sortieOrange + secousse(kO - 8, 0.006 * W);
  const xE = arrivee(kE, 1) + sortieEncre + secousse(kE - 8, 0.006 * W);
  const etire = (k: number) => 1 + 0.06 * (1 - borne01(k / 3)) * (k < 3 ? 1 : 0);

  // Mots : taille réglée pour tenir dans 40 % de la largeur et dans 60 % de l'épaisseur.
  const tailleMot = (mot: string) => Math.min(T * 0.62, (0.4 * W) / Math.max(1, largeurTexte(mot, 1, 0.01)));
  const defile = i * G.vitesseDefilement * W;
  const ombre = Math.round(0.007 * W);
  const contourLiseres = Math.max(3, Math.round(0.003 * W));

  const bande = (couleur: string, haut: boolean, x: number, k: number, mot: string, couleurMot: string, xMot: number, opacite = 1, cle = "") => {
    const y0 = haut ? -T : 0;
    return (
      <g key={cle} opacity={opacite} transform={`translate(${x} 0) scale(${etire(k)} 1)`}>
        <rect x={-L / 2} y={y0} width={L} height={T} fill={couleur} />
        {haut ? (
          <>
            <line x1={-L / 2} x2={L / 2} y1={-T + contourLiseres} y2={-T + contourLiseres} stroke={COULEURS.ivoire} strokeWidth={contourLiseres} opacity={0.55} />
            <line x1={-L / 2} x2={L / 2} y1={-T * 0.16} y2={-T * 0.16} stroke={COULEURS.encre} strokeWidth={contourLiseres} strokeDasharray="16 14" strokeDashoffset={-defile} opacity={0.5} />
          </>
        ) : (
          <>
            <line x1={-L / 2} x2={L / 2} y1={contourLiseres} y2={contourLiseres} stroke={COULEURS.ivoire} strokeWidth={contourLiseres} opacity={0.4} />
            <line x1={-L / 2} x2={L / 2} y1={T * 0.84} y2={T * 0.84} stroke={COULEURS.orange} strokeWidth={contourLiseres} strokeDasharray="16 14" strokeDashoffset={defile} />
          </>
        )}
        <text x={xMot} y={y0 + T / 2} textAnchor="middle" dominantBaseline="central" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleMot(mot)} letterSpacing={tailleMot(mot) * 0.01} fill={couleurMot}>
          {mot.toUpperCase()}
        </text>
      </g>
    );
  };

  const ghostsO = [1, 2].map((n) => bande(COULEURS.orange, true, arrivee(kO - n, -1), kO - n, "", COULEURS.encre, 0, k0(kO, n) * (n === 1 ? 0.3 : 0.15), `go${n}`));
  const ghostsE = [1, 2].map((n) => bande(COULEURS.encre, false, arrivee(kE - n, 1), kE - n, "", COULEURS.ivoire, 0, k0(kE, n) * (n === 1 ? 0.3 : 0.15), `ge${n}`));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, filter: `drop-shadow(${ombre}px ${ombre}px 0 ${COULEURS.encre})` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <g transform={`translate(${W / 2} ${yM}) rotate(${theta})`}>
            {i < 6 ? ghostsO : null}
            {kE > 0 && kE < 6 ? ghostsE : null}
            {bande(COULEURS.orange, true, xO, kO, p.mots[0], COULEURS.encre, -0.19 * W)}
            {kE > -1 ? bande(COULEURS.encre, false, xE, kE, p.mots[1], COULEURS.ivoire, 0.17 * W) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}

/** Un fantôme n'existe que pendant les 3 premières images de la bande (et pas avant son départ). */
function k0(k: number, n: number): number {
  return k - n >= 0 && k < 3 + n ? 1 : 0;
}

/** Bruitage : `whoosh-in` au départ de la bande orange, `drop_001` quand la bande encre s'arrête. */
export function bruitagesBandesDiagonales(p: Pick<BandesDiagonalesProps, "debut">): BruitageMotion[] {
  return [
    [p.debut, "whoosh-in", 0.07],
    [+(p.debut + 11 / FPS_V2).toFixed(3), "drop_001", 0.05],
  ];
}

/** Exemple : Will dit « simple, rapide ». */
export const EXEMPLE_BANDES_DIAGONALES = {
  phrase: "Avec nous, c'est simple et rapide.",
  proprietes: { debut: 1.0, fin: 3.2, mots: ["Simple", "Rapide"] } satisfies Omit<BandesDiagonalesProps, "t" | "largeurImage" | "hauteurImage">,
  imagesPlanche: [1, 3, 5, 9, 28],
};
