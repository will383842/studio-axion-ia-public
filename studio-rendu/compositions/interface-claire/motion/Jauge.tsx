/**
 * FAMILLE « JAUGE » (motion design hors cartes, designer n° 3, 15/10/2026) — demi-jauge façon compteur de vitesse.
 *
 * Quand : une charge, un niveau, une urgence ou une priorité, à la place d'une carte « graphique » ou « statuts ».
 * Visage : ENTIER. Peut OUVRIR une vidéo (le visage reste libre).
 *
 *  - La jauge se DESSINE comme un balayage d'essuie-glace, de gauche à droite (0,34 s) : la plaque ivoire en demi-lune,
 *    ses 5 segments (SABLE calme → ORANGE alerte), ses 11 traits et ses deux pictogrammes apparaissent ENSEMBLE derrière
 *    le front du balayage. À aucun instant on ne voit une plaque vide ou un segment qui flotte. Aucune graduation
 *    chiffrée.
 *  - L'aiguille n'apparaît qu'une fois la jauge dessinée (pop au pivot), puis à `aMonte` elle file de `de` vers `vers`
 *    (0,7 s, dépassement puis retour) ; dans la zone orange elle VIBRE (tension) et la plaque flashe orange 4 images à
 *    l'arrivée ; si elle redescend, la plaque flashe sable et l'aiguille se pose sans vibrer.
 *  - Le MOT D'ÉTAT dit par Will (« saturée », « urgent », « sous contrôle »…) s'imprime À L'INTÉRIEUR du cadran, sur
 *    l'axe du pivot, comme un tampon (sans plaque), à son mot. Rien d'autre n'est écrit.
 * Sortie : la jauge redescend hors de l'image (0,18 s), finie à `fin`. Dure 1,2 à 2 s.
 *
 * PLACEMENT : tiers bas, sous la zone des sous-titres (haut de la plaque ≈ 0,705 H), sur le buste et les mains
 * (≈ 22 % de la hauteur). Le réalisateur ne la pose pas pendant un geste de Will qui porte le sens.
 * Bruitage : souffle d'entrée, montée de tension (tics qui se resserrent pendant la course), choc à l'arrivée.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { mesures } from "../elements";
import { progression, rebond, sortie } from "../mouvement";
import { Easing, interpolate } from "remotion";

export const ID_JAUGE = "jauge";
export const DUREE_JAUGE = Object.freeze({ min: 1.2, max: 2 });

export const FICHE_JAUGE = Object.freeze({
  id: ID_JAUGE,
  nom: "Jauge et cadran de niveau",
  visage: "entier" as const,
  /** Garde le visage libre : peut servir dans les premières secondes de la vidéo. */
  ouvertureAutorisee: true,
  dureeMin: DUREE_JAUGE.min,
  dureeMax: DUREE_JAUGE.max,
  quandUtiliser: "Une charge, un niveau, une urgence ou une priorité DITE (« saturée », « urgent », « sous contrôle »), à la place d'une carte « graphique » ou « statuts ».",
});

export type JaugeProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Position de départ de l'aiguille (0 = tout à gauche, zone sable ; 1 = tout à droite, zone orange). */
  de: number;
  /** Position d'arrivée (monte si `vers` > `de`, redescend sinon). */
  vers: number;
  /** Instant où l'aiguille part (par défaut : `debut + 0,45`, une fois la jauge dessinée). */
  aMonte?: number;
  /** Mot d'état DIT par Will, affiché à son instant. */
  etat?: { texte: string; a: number };
};

const G = Object.freeze({
  /** Pivot de l'aiguille (fractions de L et H). */
  pivotX: 0.5,
  pivotY: 0.885,
  /** Rayon extérieur de la plaque (fraction de la LARGEUR). */
  rayon: 0.32,
  /** Balayage de construction (s). */
  balayage: 0.34,
  sortie: 0.18,
  course: 0.7,
  /** Seuil de la zone « alerte ». */
  alerte: 0.7,
});

/** Couleurs des 5 segments, du calme à l'alerte (sable → orange, dérivés intermédiaires). */
const SEGMENTS = ["#BFA88B", "#BC967A", "#BA8063", "#B76746", COULEURS.orange];

/** Point sur l'arc : v = 0 à gauche, 0,5 en haut, 1 à droite (v < 0 : sous l'horizontale à gauche). */
const sur = (cx: number, cy: number, r: number, v: number) => [cx - r * Math.cos(Math.PI * v), cy - r * Math.sin(Math.PI * v)] as const;

function arc(cx: number, cy: number, r0: number, r1: number, v0: number, v1: number): string {
  const [ax, ay] = sur(cx, cy, r1, v0);
  const [bx, by] = sur(cx, cy, r1, v1);
  const [c0x, c0y] = sur(cx, cy, r0, v1);
  const [d0x, d0y] = sur(cx, cy, r0, v0);
  return `M ${ax} ${ay} A ${r1} ${r1} 0 0 1 ${bx} ${by} L ${c0x} ${c0y} A ${r0} ${r0} 0 0 0 ${d0x} ${d0y} Z`;
}

/** Instant de départ de l'aiguille. */
const depart = (p: Pick<JaugeProps, "debut" | "aMonte">) => p.aMonte ?? p.debut + 0.45;

/** Position de l'aiguille à l'instant `t` (0 → 1, peut dépasser légèrement pendant le rebond). */
function niveau(p: Pick<JaugeProps, "t" | "debut" | "de" | "vers" | "aMonte">): number {
  const a = depart(p);
  const monte = p.vers >= p.de;
  const u = interpolate(p.t, [a, a + G.course], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.back(monte ? 1.6 : 1.1)) });
  // Petit frémissement d'attente avant le départ.
  const attente = p.t < a ? Math.sin(p.t * 38) * 0.008 : 0;
  return p.de + (p.vers - p.de) * u + attente;
}

export function Jauge(p: JaugeProps) {
  const { t, debut, fin } = p;
  if (t < debut || t >= fin) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const { contour, ombre } = mesures(W);
  const R = G.rayon * W;
  const cx = G.pivotX * W;
  const cy = G.pivotY * H;
  const basPlaque = cy + H * 0.04;

  // Construction : léger soulèvement + balayage angulaire (front de -0,1 à 1,1).
  const leve = rebond(t, debut, 0.3, 1.3);
  const bal = Easing.out(Easing.cubic)(progression(t, debut, G.balayage));
  const front = -0.1 + 1.2 * bal;
  const s = sortie(t, fin - G.sortie, G.sortie);
  const decalage = (1 - leve) * H * 0.035 + s * (H - (cy - R) + ombre * 2);

  const a = depart(p);
  const monte = p.vers >= p.de;
  let v = niveau(p);
  // Tension : l'aiguille vibre dans la zone d'alerte (une fois la course faite).
  const enAlerte = monte && t >= a + G.course * 0.6 && p.vers >= G.alerte;
  if (enAlerte) v += Math.sin(t * 115) * 0.012 + Math.sin(t * 47) * 0.006;
  v = Math.max(-0.04, Math.min(1.04, v));
  const arrivee = a + G.course * 0.55;
  const flash = t >= arrivee && t < arrivee + 0.16;
  const fondPlaque = flash ? (monte && p.vers >= G.alerte ? COULEURS.orange : COULEURS.sable) : COULEURS.ivoire;

  const r1 = R * 0.86;
  const r0 = R * 0.62;
  const plaque = `M ${cx - R} ${basPlaque} L ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy} L ${cx + R} ${basPlaque} Z`;
  // Découpe du balayage : secteur depuis le pivot jusqu'au front (déborde sous l'horizontale aux deux bouts).
  const pas = 24;
  const pointsBalayage: string[] = [`${cx},${basPlaque + ombre * 3}`];
  for (let k = 0; k <= pas; k++) {
    const [x, y] = sur(cx, cy, R * 1.6, -0.1 + ((front + 0.1) * k) / pas);
    pointsBalayage.push(`${x},${y}`);
  }
  const idDecoupe = `jauge-balayage-${Math.round(cx)}-${Math.round(cy)}`;
  const traits = Array.from({ length: 11 }, (_, i) => i / 10);

  const [nx, ny] = sur(cx, cy, R * 0.8, v);
  const angleAiguille = Math.atan2(ny - cy, nx - cx);
  const largeurBase = R * 0.06;
  const bx = Math.cos(angleAiguille + Math.PI / 2) * largeurBase;
  const by = Math.sin(angleAiguille + Math.PI / 2) * largeurBase;
  const [qx, qy] = sur(cx, cy, -R * 0.12, v);
  // L'aiguille et le pivot apparaissent une fois la jauge dessinée.
  const aiguilleVisible = rebond(t, debut + G.balayage * 0.85, 0.14, 2.2);
  // La zone active (segment sous l'aiguille) gonfle quand l'aiguille y entre.
  const segmentActif = Math.max(0, Math.min(4, Math.floor(Math.max(0, Math.min(0.999, v)) * 5)));

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${decalage}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <defs>
            <clipPath id={idDecoupe}>
              <polygon points={pointsBalayage.join(" ")} />
            </clipPath>
          </defs>
          <g clipPath={front < 1.1 ? `url(#${idDecoupe})` : undefined}>
            <path d={plaque} transform={`translate(${ombre} ${ombre})`} fill={COULEURS.encre} />
            <path d={plaque} fill={fondPlaque} stroke={COULEURS.encre} strokeWidth={contour * 1.3} strokeLinejoin="round" />
            {/* Segments sable → orange. */}
            {SEGMENTS.map((couleur, i) => {
              const v0 = i / 5 + 0.006;
              const v1 = v0 + 1 / 5 - 0.012;
              const actif = i === segmentActif && t >= a;
              const extra = actif ? R * 0.05 : 0;
              return <path key={i} d={arc(cx, cy, r0 - extra * 0.4, r1 + extra, v0, v1)} fill={flash && actif ? COULEURS.ivoire : couleur} stroke={COULEURS.encre} strokeWidth={contour} strokeLinejoin="round" />;
            })}
            {/* Traits (sans chiffres). */}
            {traits.map((f, i) => {
              const [x0, y0] = sur(cx, cy, r0 * (i % 5 === 0 ? 0.8 : 0.87), f);
              const [x1, y1] = sur(cx, cy, r0 * 0.95, f);
              return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={COULEURS.encre} strokeWidth={contour * (i % 5 === 0 ? 1.4 : 0.8)} strokeLinecap="round" />;
            })}
            {/* Pictogrammes aux extrémités : calme (sable) et alerte (orange), sans texte. */}
            <Pictogramme x={cx - R * 0.74} y={cy + H * 0.012} r={R * 0.075} couleur={COULEURS.sable} contour={contour} type="calme" />
            <Pictogramme x={cx + R * 0.74} y={cy + H * 0.012} r={R * 0.075} couleur={COULEURS.orange} contour={contour} type="alerte" />
          </g>
          {/* Front du balayage : un trait orange qui passe, comme une aiguille de radar. */}
          {front > -0.05 && front < 1.05 ? (
            <line x1={cx} y1={cy} x2={sur(cx, cy, R, front)[0]} y2={sur(cx, cy, R, front)[1]} stroke={COULEURS.orange} strokeWidth={contour * 1.6} strokeLinecap="round" />
          ) : null}
          {p.etat && t >= p.etat.a ? <Tampon t={t} a={p.etat.a} texte={p.etat.texte} cx={cx} cy={cy} R={R} contour={contour} alerte={monte && p.vers >= G.alerte} /> : null}
          {aiguilleVisible > 0 ? (
            <g transform={`translate(${cx} ${cy}) scale(${aiguilleVisible}) translate(${-cx} ${-cy})`}>
              <polygon points={`${qx + bx},${qy + by} ${nx},${ny} ${qx - bx},${qy - by}`} transform={`translate(${ombre * 0.7} ${ombre * 0.7})`} fill={COULEURS.encre} opacity={0.35} />
              <polygon points={`${qx + bx},${qy + by} ${nx},${ny} ${qx - bx},${qy - by}`} fill={COULEURS.encre} stroke={COULEURS.encre} strokeWidth={contour * 0.6} strokeLinejoin="round" />
              <circle cx={cx} cy={cy} r={R * 0.1} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour * 1.2} />
              <circle cx={cx} cy={cy} r={R * 0.035} fill={COULEURS.ivoire} />
            </g>
          ) : null}
        </svg>
      </div>
    </div>
  );
}

function Pictogramme({ x, y, r, couleur, contour, type }: { x: number; y: number; r: number; couleur: string; contour: number; type: "calme" | "alerte" }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={couleur} stroke={COULEURS.encre} strokeWidth={contour} />
      {type === "calme" ? (
        <line x1={x - r * 0.45} y1={y} x2={x + r * 0.45} y2={y} stroke={COULEURS.encre} strokeWidth={contour * 1.1} strokeLinecap="round" />
      ) : (
        <>
          <line x1={x} y1={y - r * 0.5} x2={x} y2={y + r * 0.12} stroke={COULEURS.ivoire} strokeWidth={contour * 1.2} strokeLinecap="round" />
          <circle cx={x} cy={y + r * 0.45} r={contour * 0.7} fill={COULEURS.ivoire} />
        </>
      )}
    </g>
  );
}

/**
 * Mot d'état imprimé DANS le cadran, sur l'axe du pivot, comme un tampon : il arrive grand et de travers, s'écrase
 * en 3 images et reste légèrement incliné. Pas de plaque : lettres orange (alerte) ou encre, liseré ivoire.
 */
function Tampon({ t, a, texte, cx, cy, R, contour, alerte }: { t: number; a: number; texte: string; cx: number; cy: number; R: number; contour: number; alerte: boolean }) {
  // Fenêtre disponible au-dessus du pivot, sous les traits intérieurs (rayon 0,49 R).
  const bas = R * 0.15;
  let taille = R * 0.16;
  const largeurMax = (h: number) => 2 * Math.sqrt(Math.max(0, (R * 0.49) ** 2 - h ** 2));
  for (let k = 0; k < 4; k++) {
    const l = largeurTexte(texte, taille, taille * 0.03);
    const dispo = largeurMax(bas + taille * 0.74) * 0.96;
    if (l <= dispo) break;
    taille *= dispo / l;
  }
  const e = interpolate(t, [a, a + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const echelle = 1.7 - 0.7 * e;
  const tourne = -4 - 10 * (1 - e);
  const y = cy - bas;
  return (
    <g transform={`translate(${cx} ${y}) rotate(${tourne}) scale(${echelle})`} opacity={Math.min(1, e * 2.5)}>
      <text
        x={0}
        y={0}
        textAnchor="middle"
        fontFamily={POLICES.titre}
        fontSize={taille}
        letterSpacing={taille * 0.03}
        fill={alerte ? COULEURS.orange : COULEURS.encre}
        stroke={COULEURS.ivoire}
        strokeWidth={contour * 1.2}
        strokeLinejoin="round"
        paintOrder="stroke fill"
      >
        {texte.toUpperCase()}
      </text>
      {/* Deux filets sous le mot, comme l'encre d'un tampon. */}
      <line x1={-largeurTexte(texte, taille, taille * 0.03) * 0.42} y1={taille * 0.2} x2={largeurTexte(texte, taille, taille * 0.03) * 0.42} y2={taille * 0.2} stroke={alerte ? COULEURS.orange : COULEURS.encre} strokeWidth={contour * 0.9} strokeLinecap="round" />
    </g>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. Aucune musique. */
export type BruitageMotion = [number, string, number];

/** Souffle d'entrée ; montée de tension (son qui monte + tics qui se resserrent) ; choc à l'arrivée ; pop du mot. */
export function bruitagesJauge(p: Pick<JaugeProps, "debut" | "fin" | "de" | "vers" | "aMonte" | "etat">): BruitageMotion[] {
  const a = depart(p);
  const monte = p.vers >= p.de;
  const s: BruitageMotion[] = [[p.debut, "whoosh-in", 0.2]];
  s.push([a, monte ? "maximize_004" : "minimize_004", 0.07]);
  let pas = 0.12;
  for (let x = a; x < a + G.course * 0.55 - 1e-6; x += pas, pas = Math.max(0.035, pas * 0.75)) s.push([+x.toFixed(3), "tick_002", 0.04]);
  s.push([+(a + G.course * 0.55).toFixed(3), monte ? "drop_004" : "drop_002", 0.05]);
  if (p.etat) s.push([p.etat.a, "select_002", 0.04]);
  s.push([p.fin - G.sortie, "whoosh-out", 0.18]);
  return s;
}

export const EXEMPLE_JAUGE = {
  phrase: "Votre équipe est à bout : elle est saturée.",
  duree: 2.2,
  mots: [
    { texte: "Votre", a: 0.0 },
    { texte: "équipe", a: 0.14 },
    { texte: "est", a: 0.5 },
    { texte: "à", a: 0.6 },
    { texte: "bout :", a: 0.66 },
    { texte: "elle", a: 1.15 },
    { texte: "est", a: 1.28 },
    { texte: "saturée.", a: 1.38 },
  ],
  proprietes: { debut: 0.1, fin: 2.05, de: 0.12, vers: 0.93, aMonte: 0.55, etat: { texte: "Saturée", a: 1.38 } } satisfies Omit<JaugeProps, "t" | "largeurImage" | "hauteurImage">,
  /** Instants de contrôle : balayage de construction en cours, puis état complet (aiguille dans l'orange, mot imprimé). */
  instantConstruction: 0.28,
  instantComplet: 1.6,
};
