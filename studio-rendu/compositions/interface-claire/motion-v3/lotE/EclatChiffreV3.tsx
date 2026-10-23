import React, { useId } from "react";
/**
 * ÉLÉMENT 22 « ÉCLAT-CHIFFRE » (standard v3, lot E ; `eclat-chiffre` v2 rhabillé).
 *
 * Emplacement E7 plein écran · aplat encre en DÉGRADÉ RADIAL (encreDouce au centre → encre) · éclat orange de 16 branches en
 * dégradé (1,3 L, déborde du cadre) avec un HALO doux et une facette de lumière · grain de 3 % VISIBLE · le chiffre DIT défile
 * puis claque, en relief, l'unité dite glisse depuis la droite (flou directionnel) · 10 éclats étirés dans le sens de leur
 * vitesse (flou de mouvement bon marché).
 * UNIQUEMENT pour un chiffre DIT par Will (`valeur`, `unite`). Jamais avant 10 s. Visage : COUVERT (coupe franche à l'entrée).
 * Sortie par ASPIRATION : le tout est aspiré en iris vers un point hors de la zone du visage (bas-droit), rotation +90°, en 4 i.
 *
 * Chorégraphie (images depuis i0) : i0 coupe franche, éclat 0,3 → 1 (JAILLIR, rotation -30° → 0 puis 1°/i) · i0-i12 compteur
 * qui défile · i12 arrivée (1,15 → 1 CLAQUER, secousse de l'élément 0,012 L, 10 éclats) · i14-i19 l'unité glisse (flou
 * directionnel) · pose · i31-i35 aspiration.
 * Profondeur (V6) : halo + facette de l'éclat, relief du chiffre (3 ombres + ombre portée), flou de mouvement des éclats et de l'unité.
 * Bruitage : `drop_002` + `eclats` à l'arrivée (i12).
 */
import {
  alea,
  alpha,
  aspiration,
  BruitageMotion,
  borne,
  chargerPoliceMontserrat,
  courbe,
  FPS,
  freinCubique,
  GrainPlein,
  imageDepuis,
  lerp,
  NUANCES,
  POLICES,
  PropsElementE,
  ressort,
  secousse,
} from "./commun-lotE";

export const ID_ECLAT_CHIFFRE_V3 = "eclat-chiffre";
export const DUREE_ECLAT_V3 = Object.freeze({ min: 1.0, max: 1.4 });

export const FICHE_ECLAT_CHIFFRE_V3 = Object.freeze({
  id: ID_ECLAT_CHIFFRE_V3,
  nom: "Éclat-chiffre (coup de poing)",
  emplacement: "E7 plein écran",
  forme: "aplat encre radial + éclat orange à halo + grain 3 %",
  mouvement: "compteur qui défile, CLAQUER, 10 éclats, aspiration vers le bas-droit",
  visage: "couvert" as const,
  video: false,
  ressorts: ["JAILLIR", "CLAQUER"],
  quandUtiliser: "Un chiffre dit et important (« 45 minutes »). Jamais sans chiffre dit ; jamais avant 10 s.",
});

export type EclatChiffreV3Props = PropsElementE & {
  debut: number;
  /** Fin de l'aspiration (s). Durée conseillée : 1 à 1,4 s. */
  fin: number;
  /** Le chiffre DIT par Will. */
  valeur: number;
  /** Unité dite (« min », « h »). */
  unite?: string;
};

const ARRIVEE = 12;
const SORTIE = 31;
const DUREE_SORTIE = 4;

export function EclatChiffreV3(p: EclatChiffreV3Props) {
  chargerPoliceMontserrat();
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { t, largeurImage: W, hauteurImage: H } = p;
  const k = imageDepuis(t, p.debut);
  if (k < 0 || k >= SORTIE + DUREE_SORTIE + 0.5) return null;
  const cx = W / 2;
  const cy = H * 0.5;

  // Sortie : aspiration en iris vers le bas-droit (hors de la zone du visage), rotation +90°.
  const u = courbe(k, SORTIE, DUREE_SORTIE, aspiration);
  const sortant = k >= SORTIE;
  const rIris = (1 - u) ** 1.6 * Math.hypot(W, H) * 0.6;
  const ix = lerp(cx, 0.88 * W, u);
  const iy = lerp(cy, 0.84 * H, u);
  const contenu = 1 - 0.85 * u;
  const rotSortie = 90 * u;

  // Éclat : 0,3 → 1 (JAILLIR), rotation -30° → 0, puis 1°/i.
  const sE = ressort("JAILLIR", k + 1);
  const echelleEclat = lerp(0.3, 1, sE);
  const rotEclat = lerp(-30, 0, sE) + Math.max(0, k - 6);

  // Compteur : défile de 0 à la valeur dite (ralentit), arrivée CLAQUER à i12.
  const defil = freinCubique(borne(k / ARRIVEE));
  const aff = k >= ARRIVEE ? p.valeur : Math.round(p.valeur * defil);
  const m = k - ARRIVEE;
  const claque = m >= 0 ? lerp(1.15, 1, ressort("CLAQUER", m)) : 1;
  const sh = secousse(m, 0.012 * W);
  const texteChiffre = String(aff);
  const tailleChiffre = Math.min((W * 0.78) / Math.max(1.2, texteChiffre.length * 0.66), H * 0.34);
  const tailleUnite = tailleChiffre * 0.42;
  const unite = p.unite?.toUpperCase();

  // Unité : glisse depuis la droite i14 → i19, flou directionnel pendant le glissement.
  const kU = k - 14;
  const pU = kU <= 0 ? 0 : 1 - (1 - borne(kU / 5)) ** 3;
  const flouU = kU > 0 && kU < 5 ? 0.03 * W * (1 - pU) : 0;

  // Dix éclats (frein 0,86, gravité 0,002 H/i²) étirés dans le sens de la vitesse.
  const eclats =
    m >= 0 && m < 14
      ? Array.from({ length: 10 }, (_, j) => {
          const ang = (j / 10) * 2 * Math.PI + alea(j + 3) * 0.5;
          const v = (0.028 + 0.022 * alea(j * 2.3 + 1)) * W;
          const dist = (v * (1 - Math.pow(0.86, m + 1))) / (1 - 0.86);
          const x = cx + Math.cos(ang) * dist;
          const y = cy - H * 0.02 + Math.sin(ang) * dist + 0.5 * 0.002 * H * m * m;
          const vit = v * Math.pow(0.86, m);
          const r = (0.012 + 0.016 * alea(j * 5.1)) * W;
          const etire = 1 + Math.min(4, vit / (0.008 * W));
          const op = m <= 8 ? 1 : 1 - borne((m - 8) / 6);
          const dir = (Math.atan2(y - (cy - H * 0.02), x - cx) * 180) / Math.PI;
          return (
            <g key={j} transform={`translate(${x} ${y}) rotate(${dir}) scale(${etire} 1)`} opacity={op}>
              <polygon points={`${-r},0 ${r * 0.6},${-r * 0.7} ${r * 1.1},0 ${r * 0.6},${r * 0.7}`} fill={j % 3 === 0 ? NUANCES.ivoire : j % 3 === 1 ? NUANCES.sable : NUANCES.orangeChaud} />
            </g>
          );
        })
      : null;

  const respire = k > 14 ? 1 + 0.015 * Math.sin((k - 14) * 0.42) : 1;
  const flotte = k > 14 ? Math.sin((k - 14) * 0.3) * 0.004 * H : 0;
  const gX = cx + sh;
  const baseY = cy + tailleChiffre * 0.08;
  const pas = tailleChiffre * 0.018;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <clipPath id={`iris${id}`}>
          <circle cx={ix} cy={iy} r={Math.max(0.01, rIris)} />
        </clipPath>
        <radialGradient id={`fond${id}`} cx="50%" cy="46%" r="75%">
          <stop offset="0%" stopColor={NUANCES.encreDouce} />
          <stop offset="38%" stopColor="#1B120B" />
          <stop offset="100%" stopColor={NUANCES.encre} />
        </radialGradient>
        <radialGradient id={`ec${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={NUANCES.orangeChaud} stopOpacity="0.95" />
          <stop offset="62%" stopColor={NUANCES.orange} stopOpacity="0.85" />
          <stop offset="100%" stopColor={NUANCES.orangeProfond} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`an${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NUANCES.ivoire} />
          <stop offset="50%" stopColor={NUANCES.orangeChaud} />
          <stop offset="100%" stopColor={NUANCES.orange} />
        </linearGradient>
        <linearGradient id={`fa${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={NUANCES.ivoire} stopOpacity="0.28" />
          <stop offset="55%" stopColor={NUANCES.ivoire} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`ch${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4EBDC" />
          <stop offset="100%" stopColor={NUANCES.ivoire} />
        </linearGradient>
        <filter id={`halo${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={0.075 * W} />
        </filter>
        <filter id={`fu${id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={`${flouU.toFixed(2)} 0`} />
        </filter>
        <filter id={`om${id}`} x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation={tailleChiffre * 0.045} />
        </filter>
      </defs>
      <g clipPath={sortant ? `url(#iris${id})` : undefined}>
        <rect x={0} y={0} width={W} height={H} fill={`url(#fond${id})`} />
        <g transform={`translate(${cx} ${cy}) rotate(${rotSortie}) scale(${contenu}) translate(${-cx} ${-cy})`}>
          <g transform={`translate(${sh} 0)`}>
            <g transform={`translate(${cx} ${cy}) rotate(${rotEclat}) scale(${echelleEclat})`}>
              {/* Anneau de lumière : disque radial de 1,16 L, anneau en dégradé avec halo, anneau en tirets qui tourne. */}
              <circle r={0.58 * W * respire} fill={`url(#ec${id})`} />
              <circle r={0.47 * W * respire} fill="none" stroke={NUANCES.orangeChaud} strokeWidth={0.03 * W} opacity={0.75} filter={`url(#halo${id})`} />
              <circle r={0.47 * W * respire} fill="none" stroke={`url(#an${id})`} strokeWidth={0.014 * W} />
              <circle r={0.54 * W * respire} fill="none" stroke={alpha(NUANCES.ivoire, 0.55)} strokeWidth={0.005 * W} strokeDasharray={`${0.05 * W} ${0.04 * W}`} transform={`rotate(${k * 2.2})`} />
              {m >= 0 && m < 12 ? <circle r={lerp(0.3, 0.75, 1 - (1 - m / 12) ** 3) * W} fill="none" stroke={alpha(NUANCES.ivoire, 0.5 * (1 - m / 12))} strokeWidth={0.012 * W} /> : null}
            </g>
          </g>
          {eclats}
          {/* Chiffre : extrusion de 3 ombres, ombre portée floue, face en dégradé ivoire. */}
          <g transform={`translate(0 ${flotte}) translate(${gX} ${baseY}) rotate(-4) scale(${claque}) translate(${-gX} ${-baseY})`}>
            <text x={gX} y={baseY + tailleChiffre * 0.1} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleChiffre} fill={NUANCES.encre} opacity={0.55} filter={`url(#om${id})`} style={{ fontVariantNumeric: "tabular-nums" }}>
              {texteChiffre}
            </text>
            {[].map((n: number) => (
              <text key={n} x={gX} y={baseY + n * pas} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleChiffre} fill={n === 3 ? NUANCES.encre : NUANCES.orangeProfond} style={{ fontVariantNumeric: "tabular-nums" }}>
                {texteChiffre}
              </text>
            ))}
            <text x={gX} y={baseY} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleChiffre} fill={`url(#ch${id})`} style={{ fontVariantNumeric: "tabular-nums" }}>
              {texteChiffre}
            </text>
          </g>
          {unite && kU > -0.5 ? (
            <g transform={`translate(${cx + lerp(W * 0.62, 0, pU)} ${baseY + tailleChiffre * 0.78})`} filter={flouU > 0.1 ? `url(#fu${id})` : undefined}>
              <text x={0} y={tailleUnite * 0.1} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleUnite} fill={NUANCES.encre} opacity={0.45}>
                {unite}
              </text>
              <text x={0} y={0} textAnchor="middle" fontFamily={POLICES.titre} fontWeight={800} fontSize={tailleUnite} fill={`url(#ch${id})`} letterSpacing={tailleUnite * 0.04}>
                {unite}
              </text>
            </g>
          ) : null}
        </g>
      </g>
    </svg>
    <div style={{ position: "absolute", inset: 0, clipPath: sortant ? `circle(${Math.max(0.01, rIris).toFixed(1)}px at ${ix.toFixed(1)}px ${iy.toFixed(1)}px)` : undefined }}>
      <GrainPlein W={W} H={H} opacite={0.12} graine={9} clair />
    </div>
    </div>
  );
}

/** Bruitage : `whoosh-in` au départ, `drop_002` + `eclats` à l'arrivée du chiffre (i12). */
export function bruitagesEclatChiffreV3(p: Pick<EclatChiffreV3Props, "debut">): BruitageMotion[] {
  const a = p.debut + ARRIVEE / FPS;
  return [
    [p.debut, "whoosh-in", 0.08],
    [a, "drop_002", 0.14],
    [+(a + 0.02).toFixed(3), "eclats", 0.1],
  ];
}

/** Exemple : « 45 minutes » (Will le dit déjà dans la vidéo 1). */
export const EXEMPLE_ECLAT_CHIFFRE_V3 = { phrase: "Quarante-cinq minutes.", debut: 0.3, fin: 0.3 + (SORTIE + DUREE_SORTIE) / FPS, valeur: 45, unite: "min" };
