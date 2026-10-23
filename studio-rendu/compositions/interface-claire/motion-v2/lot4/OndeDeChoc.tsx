import React from "react";
/**
 * ÉLÉMENT 18 « ONDE DE CHOC » (lot 4 « Impact / énergie », standard DA v2 § D).
 *  - Emplacement E5 (halo autour de la tête), 3 anneaux concentriques SANS REMPLISSAGE (contours orange, sable et encre de
 *    0,008 L), centrés sur le visage. Rien à écrire : c'est la respiration graphique d'une affirmation forte.
 *  - Mouvement : les anneaux démarrent à 3 images d'écart, grandissent en 12 images (freinage cubique) en s'effaçant et
 *    en s'amincissant. Chaque anneau est une ELLIPSE dont l'ellipse de départ contient les 4 coins de la zone interdite Z :
 *    le tracé ne coupe donc jamais le visage (un cercle de rayon fixe aurait mordu les coins de Z).
 *  - Visage : ENTIER, jamais touché. Pas de texte. Sortie : l'onde s'éteint en s'élargissant (pas un simple fondu).
 *  - Bruitage : drop_004 grave à i0.
 */
import { COULEURS } from "../../charte";
import { BruitageMotion, borne, FPS, freinCubique, lerp, PRISE_DEFAUT, PriseVisage, zoneZ } from "./outils4";

export type DonneesOndeDeChoc = { debut: number; fin: number; prise?: PriseVisage };

export const FICHE_ONDE_DE_CHOC = Object.freeze({
  id: "onde-de-choc",
  nom: "Onde de choc",
  lot: 4,
  emplacement: "E5" as const,
  forme: "anneaux" as const,
  mouvement: "cascade" as const,
  sortie: "s'élargit en s'éteignant" as const,
  visage: "entier" as const,
  dureeMin: 0.6,
  dureeMax: 1.0,
  quandUtiliser: "Une affirmation forte, sans rien à écrire. Éviter de la placer pendant un texte à l'écran : elle respire seule.",
});

export const EXEMPLE_ONDE_DE_CHOC: DonneesOndeDeChoc = { debut: 0.2, fin: 1.3 };
export const INSTANTS_ONDE_DE_CHOC = [0, 3, 6, 10, 16] as const;

const DUREE = 12;
const DECALAGE = 3;

export function OndeDeChoc({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_ONDE_DE_CHOC }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesOndeDeChoc }) {
  const d = donnees;
  const k = (t - d.debut) * FPS;
  if (k < 0 || t >= d.fin) return null;
  const prise = d.prise ?? PRISE_DEFAUT;
  const Z = zoneZ(W, H, prise);
  // Centre = centre de Z ; l'ellipse de DÉPART passe à Z + 0,06 au-delà des coins de Z (équation de l'ellipse de même rapport).
  const cx = (Z.x0 + Z.x1) / 2;
  const cy = (Z.y0 + Z.y1) / 2;
  const hw = (Z.x1 - Z.x0) / 2 + 0.06 * W;
  const hh = (Z.y1 - Z.y0) / 2 + 0.06 * W;
  const rapport = hh / hw;
  const rx0 = Math.SQRT2 * hw;
  const ry0 = rx0 * rapport;
  const rx1 = 0.7 * W;
  const ry1 = rx1 * 1.25;
  // Orange, encre, orange (le sable disparaissait sur le mur clair). Épaisseurs 0,016 / 0,012 / 0,008 L.
  const anneaux = [
    { couleur: COULEURS.orange, epaisseur: 0.016 * W },
    { couleur: COULEURS.encre, epaisseur: 0.012 * W },
    { couleur: COULEURS.orange, epaisseur: 0.008 * W },
  ];
  // Arcs OUVERTS VERS LE BAS : tout ce qui est sous 0,58 H est coupé (jamais sur les sous-titres, bande 0,60 → 0,68 H).
  const coupe = 0.58 * H;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "hidden" }}>
      <defs>
        <clipPath id="onde-haut">
          <rect x={0} y={0} width={W} height={coupe} />
        </clipPath>
      </defs>
      <g clipPath="url(#onde-haut)">
        {anneaux.map((a, j) => {
          const kk = k - j * DECALAGE;
          if (kk < 0 || kk > DUREE) return null;
          const p = freinCubique(kk / DUREE);
          const rx = lerp(rx0, rx1, p);
          const ry = lerp(ry0, ry1, p);
          const op = borne(1 - Math.pow(kk / DUREE, 2.2), 0, 1);
          const ep = a.epaisseur * lerp(1.4, 0.8, p);
          return (
            <g key={j} opacity={op}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={COULEURS.ivoire} strokeOpacity={0.6} strokeWidth={ep + 6} />
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={a.couleur} strokeWidth={ep} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function bruitagesOndeDeChoc(d: DonneesOndeDeChoc = EXEMPLE_ONDE_DE_CHOC): BruitageMotion[] {
  return [[d.debut, "drop_004", 0.16]];
}
