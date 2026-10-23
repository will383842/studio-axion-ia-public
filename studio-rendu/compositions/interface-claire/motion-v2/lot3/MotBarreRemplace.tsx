/**
 * ÉLÉMENT 15 — « MOT BARRÉ, MOT REMPLACÉ » (v2 énergie, lot 3, designer n° 3, 16/10/2026).
 * Standard : § D lot 3, ligne 15 ; E1 HAUT ; F11 + petite bande ; mouvements M6 (tracé de feutre) puis M1 (jaillissement).
 *
 * Quand : une CORRECTION dite par Will : « pas X, mais Y » (« vous n'avez pas un problème, vous avez une fuite »).
 * Visage : ENTIER. Tout vit dans la bande du haut (de 0,02 H au haut de Z) : l'élément mesure moins de 0,10 H, il n'a donc pas
 * besoin de la descente de la prise (la prise ne bouge pas) ; il ne touche jamais Z (taille réduite à chaque rendu si besoin).
 *
 * Chorégraphie (30 i/s ; i0 = Will dit le mot A, `tBarre` = Will dit « mais » / le mot B) :
 *  - i0 → i5       : la petite BANDE sable-clair (parallélogramme, bouts coupés en biais) est balayée de gauche à droite (M2) ; le mot A, encre, est dessus ;
 *  - tBarre → +6   : le FEUTRE barre le mot A (M6) : deux traits orange de 0,013 L à main levée (tremblement fixé par `random(seed)`), le 2e démarre 2 images après le 1er ;
 *  - tBarre + 9    : le mot B JAILLIT (M1) 3 images après la fin du barré : pré-éclat de 1 image, échelle 0 → 1 et rotation de −28° à −8° avec `JAILLIR`,
 *                    orange, contour encre, ombre dure, légère texture d'encre ; micro-vie : oscillation de ±1° ;
 *  - sortie        : ASPIRATION (5 dernières images) : tout l'ensemble rétrécit vers le coin haut-droit en tournant de +60° (`Easing.in(cubic)`).
 * Bruitage : `feutre` au début du barré, `select_001` à l'arrivée du mot B.
 * Mots A et B = mots DITS par Will (aucun chiffre inventé).
 */
import React from "react";
import { random } from "remotion";
import { borne, Cadre, courbe, dimensionsMot, entrant, FiltreEncre, FPS, lin, MotSvg, N3, PRISE_DEFAUT_LOT, ressort, TAILLE_MIN, usePoliceLot3, zonePx } from "./outils3";
import type { FicheLot3, PriseLot } from "./outils3";

export const ID_MOT_BARRE_REMPLACE = "mot-barre-remplace";
export const DUREE_MOT_BARRE = Object.freeze({ min: 1.4, max: 2.8 });

export const FICHE_MOT_BARRE_REMPLACE: FicheLot3 = Object.freeze({
  id: ID_MOT_BARRE_REMPLACE,
  numero: 15,
  nom: "Mot barré, mot remplacé",
  emplacement: "E1 haut (y 0,02 H → haut de Z), moins de 0,10 H",
  forme: "F11 : mot A encre sur bande sable-clair en biais, mot B orange incliné à −8°, chevauchant A de 0,05 L",
  mouvement: "M2 (bande), M6 (feutre barre A en 6 i), M1 (mot B 3 i plus tard)",
  sortie: "aspiration vers le coin haut-droit",
  visage: "entier" as const,
  ouvertureAutorisee: true,
  dureeMin: DUREE_MOT_BARRE.min,
  dureeMax: DUREE_MOT_BARRE.max,
  quandUtiliser: "Une correction : « pas X, mais Y ». Au plus une par vidéo.",
  sons: [
    { k: 14, fichier: "feutre" },
    { k: 23, fichier: "select_001" },
  ],
});

export type MotBarreRemplaceProps = {
  t: number;
  /** Instant où Will dit le mot A. */
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Mot barré (dit par Will). */
  motA: string;
  /** Mot de remplacement (dit par Will). */
  motB: string;
  /** Instant (s, absolu) où Will dit « mais » : début du barré. Par défaut 0,47 s après `debut`. */
  tBarre?: number;
  prise?: PriseLot;
};

const BEZ = [0.83, 0, 0.17, 1] as const;

export function MotBarreRemplace(p: MotBarreRemplaceProps) {
  usePoliceLot3();
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const k = (t - debut) * FPS;
  const kFin = (fin - debut) * FPS;
  const kB0 = Math.max(8, Math.round(((p.tBarre ?? debut + 0.47) - debut) * FPS));
  const kB1 = kB0 + 9;
  const kS = kFin - 5;
  const A = p.motA.toUpperCase();
  const B = p.motB.toUpperCase();

  // Bande du haut : de 0,02 H au haut de Z (marge comprise) ; centre vertical de la bande.
  const Z = zonePx(p.prise ?? PRISE_DEFAUT_LOT, W, H);
  const haut = 0.02 * H;
  const bas = Z.y0 - 0.004 * H;
  const cy = (haut + bas) / 2;
  const hDispo = bas - haut;

  // Tailles (critique du 16/10) : étiquette A de 0,42 L de large inclinée de +4°, mot B de 0,42 L incliné de −8° qui CHEVAUCHE de 0,05 L
  // le coin droit de A (effet collage). On réduit ensemble jusqu'à tenir en largeur et dans la bande du haut.
  const marge = 0.04 * W;
  const remplissageBande = 0.03 * W;
  const chevauche = 0.05 * W;
  const rotA = 4;
  const rotB = -8;
  const largeurDe = (t: string, s: number) => (dimensionsMot(t, 100).w / 100) * s; // mesure à 100 px (le canvas arrondit à 1 px)
  let sA = (0.42 * W - 2 * remplissageBande - 0.03 * W) / (largeurDe(A, 1) || 1);
  let sB = (0.44 * W) / (largeurDe(B, 1) || 1);
  const mesure = () => {
    const dA = dimensionsMot(A, sA);
    const dB = dimensionsMot(B, sB);
    const bandeL = dA.w + 2 * remplissageBande + 0.03 * W; // + les biais de la bande
    const total = bandeL + dB.w - chevauche;
    const hauteurA = Math.min(hDispo, sA * 1.55) + Math.sin((rotA * Math.PI) / 180) * bandeL;
    const hauteurB = dB.h + Math.sin((Math.abs(rotB) * Math.PI) / 180) * dB.w;
    return { dA, dB, bandeL, total, hauteurB, hauteurA };
  };
  let m = mesure();
  for (let i = 0; i < 40 && (m.total > W - 2 * marge || m.hauteurB > hDispo * 0.98 || m.hauteurA > hDispo * 0.98) && sA > TAILLE_MIN(W) && sB > TAILLE_MIN(W); i++) {
    sA *= 0.96;
    sB *= 0.96;
    m = mesure();
  }
  const x0Tout = (W - m.total) / 2;
  const bandeX0 = x0Tout;
  const bandeX1 = bandeX0 + m.bandeL;
  const bandeH = Math.min(hDispo * 0.8, sA * 1.55);
  const xA = bandeX0 + m.bandeL / 2;
  const xB = bandeX1 - chevauche + m.dB.w / 2;
  const yB = cy + 0.006 * H;
  const rotationA = `rotate(${rotA} ${xA} ${cy})`;

  const ombre = Math.max(4, 0.005 * W);
  const contourPx = Math.max(3, 0.004 * W);

  // M2 : balayage de la bande et du mot A, de gauche à droite (5 images).
  const balaye = courbe(k, 0, 5, BEZ);
  const xClip = bandeX0 - 0.03 * W + (m.bandeL + 0.08 * W) * balaye;

  // Parallélogramme (bouts coupés en biais de 0,02 L).
  const biais = 0.02 * W;
  const polyBande = (dx = 0, dy = 0) =>
    [
      [bandeX0 + biais + dx, cy - bandeH / 2 + dy],
      [bandeX1 + dx, cy - bandeH / 2 + dy],
      [bandeX1 - biais + dx, cy + bandeH / 2 + dy],
      [bandeX0 + dx, cy + bandeH / 2 + dy],
    ]
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

  // M6 : deux traits de feutre (tremblement fixé).
  const hA = m.dA.h;
  const trait = (idx: number, de: [number, number], vers: [number, number], k0: number, k1: number) => {
    const j = (s: string) => (random(`barre-${idx}-${s}`) - 0.5) * 0.012 * W;
    const [x0, y0] = de;
    const [x1, y1] = vers;
    const d = `M ${x0} ${y0} C ${x0 + (x1 - x0) * 0.33} ${y0 + (y1 - y0) * 0.33 + j("a")}, ${x0 + (x1 - x0) * 0.66} ${y0 + (y1 - y0) * 0.66 + j("b")}, ${x1} ${y1}`;
    const u = courbe(k, k0, k1, [0.33, 0, 0.2, 1]);
    if (u <= 0) return null;
    return <path key={idx} d={d} fill="none" stroke={N3.orange} strokeWidth={Math.max(8, 0.016 * W)} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - u} />;
  };
  // Le trait de feutre (0,016 L) déborde de 0,04 L de chaque côté du mot A.
  const xa0 = xA - m.dA.w / 2 - 0.04 * W;
  const xa1 = xA + m.dA.w / 2 + 0.04 * W;
  const traits = [trait(1, [xa0, cy + hA * 0.38], [xa1, cy - hA * 0.42], kB0, kB0 + 4), trait(2, [xa1, cy - hA * 0.05], [xa0 + 0.02 * W, cy + hA * 0.3], kB0 + 2, kB0 + 6)];

  // M1 : mot B (pré-éclat 1 image avant, puis ressort JAILLIR).
  const eB = ressort(k - kB1, "JAILLIR");
  const rB = rotB + -20 * (1 - eB) + (k > kB1 + 14 ? Math.sin((2 * Math.PI * (k - kB1 - 14)) / 48) : 0);
  const preEclat = k >= kB1 - 1 && k < kB1;

  // Sortie : aspiration vers le coin haut-droit, rotation de +60°.
  const e = entrant(k, kS, kFin);
  const centre = { x: W / 2, y: cy };
  const cible = { x: 0.96 * W, y: 0.025 * H };
  const groupe = k >= kS ? `translate(${centre.x + (cible.x - centre.x) * e} ${centre.y + (cible.y - centre.y) * e}) rotate(${60 * e}) scale(${Math.max(0.001, 1 - e)}) translate(${-centre.x} ${-centre.y})` : undefined;

  return (
    <Cadre W={W} H={H}>
      <defs>
        <FiltreEncre id="encre-mot-barre" seed={4} trou={0.03} grain={0.04} />
        <clipPath id="balayage-barre">
          <rect x={0} y={0} width={Math.max(0, xClip)} height={H} />
        </clipPath>
      </defs>
      <g transform={groupe}>
        <g transform={rotationA}>
          <g clipPath="url(#balayage-barre)">
            <polygon points={polyBande(ombre, ombre)} fill={N3.encre} />
            <polygon points={polyBande()} fill={N3.sableClair} stroke={N3.encre} strokeWidth={contourPx} strokeLinejoin="round" />
            <MotSvg texte={A} cx={xA} cy={cy} taille={sA} remplissage={N3.encre} contour={N3.encre} contourPx={0} />
          </g>
          {traits}
        </g>
        {preEclat ? <circle cx={xB} cy={yB} r={0.015 * W} fill={N3.orange} /> : null}
        {k >= kB1 ? <MotSvg texte={B} cx={xB} cy={yB} taille={sB} rot={rB} echelle={Math.max(0.001, eB)} remplissage={N3.orange} contour={N3.encre} contourPx={contourPx} ombrePx={ombre} opacite={borne(lin(k, kB1, kB1 + 2), 0, 1)} filtre="url(#encre-mot-barre)" /> : null}
      </g>
    </Cadre>
  );
}

