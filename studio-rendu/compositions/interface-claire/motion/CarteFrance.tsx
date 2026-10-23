/**
 * FAMILLE « CARTE DE FRANCE QUI S'ALLUME » (`carte-france`) — motion designer n° 1, 15/10/2026 (révision 2).
 *
 * Quand : « partout en France », « à distance », « en visio », « des entreprises comme la vôtre ».
 * Visage : ENTIER (la carte vit dans la moitié basse, sous le menton : 0,54 → 0,95 H). Elle couvre le buste et les
 * mains : le réalisateur la place sur une phrase SANS geste démonstratif de Will (pas de main montrée à la caméra).
 *
 * Mouvement :
 *  - une silhouette SABLE de la France (contour encre, ombre dure, trame de points) monte du bas et se pose ; la Corse,
 *    rapprochée dans un petit cadre pointillé (convention des cartes de France), reste dans la composition ;
 *  - un point ORANGE s'allume au centre du pays ; à chaque vague (sur un mot), une ONDE ivoire balaie la carte et des
 *    points s'allument du centre vers les bords, chacun au bout d'un arc fin qui part du CENTRE (étoile : jamais de
 *    croisement), parcouru par une petite comète ; chaque point éclot avec un anneau qui s'élargit, puis pulse.
 *  - sortie : la carte redescend.
 *  12 points au plus. AUCUNE ville nommée, AUCUN chiffre, AUCUN texte. Durée bornée à 1,5-2,5 s.
 *  Bruitage : petits « ping » en cascade.
 *
 * Calque à poser AU-DESSUS de la prise (qui ne bouge jamais).
 */
import React from "react";
import { COULEURS } from "../charte";
import { mesures } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export const ID_CARTE_FRANCE = "carte-france";

export type DonneesCarteFrance = {
  debut: number;
  /** Fin souhaitée ; la durée est ramenée dans [1,5 ; 2,5] s. */
  fin: number;
  /** Instants des vagues (1 à 3), chacun sur un mot. */
  vagues: number[];
};

export const EXEMPLE_PHRASE_CARTE_FRANCE = "Petites structures, entreprises en croissance ou groupes : partout, je vois le même réflexe.";
export const EXEMPLE_CARTE_FRANCE: DonneesCarteFrance = { debut: 0.1, fin: 2.5, vagues: [0.38, 0.95, 1.5] };
export const INSTANTS_CARTE_FRANCE = Object.freeze({ construction: 1.08, complete: 2.1 });

export const FICHE_CARTE_FRANCE = Object.freeze({
  id: ID_CARTE_FRANCE,
  nom: "Carte de France qui s'allume",
  visage: "entier" as const,
  dureeMin: 1.5,
  dureeMax: 2.5,
  /** Couvre buste et mains : à poser sur une phrase sans geste démonstratif. */
  couvreLesMains: true,
  quandUtiliser: "« Partout en France », « à distance », « en visio », « des entreprises comme la vôtre ». Jamais de nom de ville.",
});

const ENTREE = 0.24;
const SORTIE = 0.16;
/** Boîte de la carte (fractions) : sous le menton (≈ 0,50 H). */
const BOITE = Object.freeze({ x0: 0.08, x1: 0.92, y0: 0.545, y1: 0.95 });

/**
 * Contour simplifié de la France métropolitaine (longitude, latitude), relevé sur les repères côtiers et frontaliers
 * réels (Dunkerque → frontière belge → pointe de Givet → Rhin → Jura → Alpes → Méditerranée → Pyrénées → Atlantique →
 * Bretagne → Cotentin → Manche). Aucun repère n'est affiché.
 */
const HEXAGONE: [number, number][] = [
  [2.37, 51.05], [2.55, 51.09], [2.9, 50.7], [3.25, 50.6], [3.7, 50.33], [4.22, 49.96], [4.85, 50.15], [4.88, 49.8], [5.45, 49.52], [5.9, 49.5],
  [6.37, 49.46], [6.73, 49.17], [7.45, 49.17], [8.22, 48.97], [7.8, 48.5], [7.58, 48.05], [7.6, 47.58], [7.05, 47.45], [6.45, 46.95], [6.12, 46.57],
  [5.97, 46.2], [6.25, 46.32], [6.8, 46.4], [6.85, 46.1], [7.04, 45.92], [6.8, 45.68], [7.08, 45.25], [6.63, 45.1], [7.0, 44.7], [6.88, 44.4],
  [7.7, 44.1], [7.52, 43.78], [7.2, 43.66], [6.93, 43.48], [6.65, 43.2], [6.15, 43.05], [5.85, 43.06], [5.35, 43.22], [4.85, 43.42], [4.4, 43.45],
  [4.0, 43.5], [3.5, 43.28], [3.05, 42.95], [3.04, 42.6], [3.17, 42.43], [2.55, 42.33], [1.95, 42.43], [1.45, 42.6], [0.7, 42.85], [0.0, 42.68],
  [-0.75, 42.92], [-1.4, 43.05], [-1.78, 43.37], [-1.52, 43.55], [-1.3, 44.1], [-1.25, 44.65], [-1.08, 45.55], [-1.2, 45.85], [-1.2, 46.18], [-1.8, 46.5],
  [-2.15, 46.85], [-2.25, 47.25], [-2.55, 47.3], [-2.8, 47.5], [-3.15, 47.55], [-3.45, 47.7], [-3.9, 47.85], [-4.37, 47.8], [-4.73, 48.03], [-4.33, 48.12],
  [-4.6, 48.25], [-4.78, 48.36], [-4.65, 48.6], [-4.0, 48.72], [-3.5, 48.84], [-3.05, 48.78], [-2.75, 48.52], [-2.3, 48.67], [-2.0, 48.65], [-1.55, 48.65],
  [-1.6, 48.85], [-1.75, 49.4], [-1.94, 49.72], [-1.6, 49.65], [-1.26, 49.68], [-1.2, 49.38], [-0.5, 49.33], [-0.2, 49.28], [0.25, 49.43], [0.1, 49.5],
  [0.35, 49.75], [1.1, 49.94], [1.55, 50.2], [1.6, 50.72], [1.85, 50.95],
];
/** Décalage de la Corse (rapprochée, dans un cadre pointillé). */
const DECALAGE_CORSE: [number, number] = [-0.95, 0.25];
const CORSE: [number, number][] = [
  [9.35, 43.0], [9.47, 42.75], [9.53, 42.4], [9.55, 42.1], [9.4, 41.75], [9.27, 41.45], [9.15, 41.38], [8.85, 41.55], [8.75, 41.7], [8.6, 41.92],
  [8.7, 42.1], [8.55, 42.3], [8.75, 42.57], [9.05, 42.68], [9.3, 42.7],
].map(([lo, la]) => [lo + DECALAGE_CORSE[0], la + DECALAGE_CORSE[1]] as [number, number]);
/** Centre du pays (point de départ de l'étoile) — anonyme. */
const CENTRE: [number, number] = [2.45, 46.85];
/** 11 points lumineux anonymes, bien répartis et en retrait des bords (aucune ville nommée ni signalée). */
const POINTS: [number, number][] = [
  [0.95, 47.65], [4.75, 47.35], [2.75, 48.85], [0.55, 45.55], [4.35, 45.35],
  [-2.95, 48.15], [0.35, 49.0], [3.05, 50.15], [6.35, 48.45], [5.95, 44.3],
  [8.1, 42.4], // Corse (déjà dans le repère décalé)
];
const COS_LAT = Math.cos((46.5 * Math.PI) / 180);

export function tempsCarteFrance(d: DonneesCarteFrance) {
  const duree = Math.min(FICHE_CARTE_FRANCE.dureeMax, Math.max(FICHE_CARTE_FRANCE.dureeMin, d.fin - d.debut));
  return { fin: d.debut + duree, sortie: d.debut + duree - SORTIE };
}

/** Projection simple (équirectangulaire corrigée) → coordonnées dans la boîte, en px. */
function projection(W: number, H: number) {
  const tous = [...HEXAGONE, ...CORSE];
  const xs = tous.map(([lo]) => lo * COS_LAT);
  const ys = tous.map(([, la]) => -la);
  const [xmin, xmax, ymin, ymax] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const lB = (BOITE.x1 - BOITE.x0) * W;
  const hB = (BOITE.y1 - BOITE.y0) * H;
  const k = Math.min(lB / (xmax - xmin), hB / (ymax - ymin));
  const ox = BOITE.x0 * W + (lB - k * (xmax - xmin)) / 2;
  const oy = BOITE.y0 * H + (hB - k * (ymax - ymin)) / 2;
  return ([lo, la]: [number, number]): [number, number] => [ox + k * (lo * COS_LAT - xmin), oy + k * (-la - ymin)];
}

type PointAllume = { x: number; y: number; a: number; vague: number };

/** Répartit les 11 points en vagues (du centre vers les bords, vagues de taille croissante). Chacun est relié au centre. */
function planifier(d: DonneesCarteFrance, proj: (p: [number, number]) => [number, number]): PointAllume[] {
  const vagues = d.vagues.slice(0, 3);
  const n = Math.max(1, vagues.length);
  const tries = [...POINTS].sort((p, q) => Math.hypot(p[0] - CENTRE[0], p[1] - CENTRE[1]) - Math.hypot(q[0] - CENTRE[0], q[1] - CENTRE[1]));
  const poids = Array.from({ length: n }, (_, i) => i + 1);
  const total = poids.reduce((s, x) => s + x, 0);
  const res: PointAllume[] = [];
  let k = 0;
  for (let v = 0; v < n; v++) {
    const taille = v === n - 1 ? tries.length - k : Math.max(1, Math.round((tries.length * poids[v]) / total));
    tries.slice(k, k + taille).forEach((p, j) => {
      const [x, y] = proj(p);
      // Cascade : 0,05 s entre deux points d'une même vague, + 0,14 s de parcours de l'arc.
      res.push({ x, y, a: (vagues[v] ?? d.debut + 0.4) + 0.14 + j * 0.05, vague: v });
    });
    k += taille;
  }
  return res;
}

const chemin = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";

/** Point d'un arc quadratique (bombé vers le haut) à la progression p. */
function surArc(a: { x: number; y: number }, b: { x: number; y: number }, p: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const long = Math.hypot(b.x - a.x, b.y - a.y);
  const cx = mx;
  const cy = my - long * 0.25;
  const q = 1 - p;
  return { x: q * q * a.x + 2 * q * p * cx + p * p * b.x, y: q * q * a.y + 2 * q * p * cy + p * p * b.y, cx, cy, long };
}

function Pastille({ t, a, x, y, r, W, i, centre }: { t: number; a: number; x: number; y: number; r: number; W: number; i: number; centre?: boolean }) {
  if (t < a) return null;
  const anneau = progression(t, a, 0.36);
  const eclot = rebond(t, a, 0.16, 2.6);
  const pulse = 1 + 0.12 * Math.sin((t - a) * 2 * Math.PI * 1.6 + i);
  return (
    <g>
      {anneau < 1 ? <circle cx={x} cy={y} r={r + W * 0.03 * anneau} fill="none" stroke={COULEURS.orange} strokeWidth={W * 0.005 * (1 - anneau) + 1} opacity={1 - anneau} /> : null}
      <circle cx={x} cy={y} r={r * 2 * eclot * pulse} fill={COULEURS.orange} opacity={0.26} />
      <circle cx={x} cy={y} r={r * eclot} fill={centre ? COULEURS.encre : COULEURS.orange} stroke={centre ? COULEURS.orange : COULEURS.encre} strokeWidth={Math.max(2.5, W * 0.0028)} />
      <circle cx={x - r * 0.3 * eclot} cy={y - r * 0.3 * eclot} r={r * 0.28 * eclot} fill={COULEURS.ivoire} opacity={0.85} />
    </g>
  );
}

export function CarteFrance({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_CARTE_FRANCE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesCarteFrance }) {
  const d = donnees;
  const { fin, sortie: debutSortie } = tempsCarteFrance(d);
  if (t < d.debut || t >= fin) return null;
  const m = mesures(W);
  const proj = projection(W, H);
  const pc = CORSE.map(proj);
  const cheminFrance = chemin(HEXAGONE.map(proj)) + " " + chemin(pc);
  const points = planifier(d, proj);
  const [cxC, cyC] = proj(CENTRE);
  const aCentre = (d.vagues[0] ?? d.debut + 0.3) - 0.02;
  // Cadre pointillé de la Corse.
  const cxs = pc.map((p) => p[0]);
  const cys = pc.map((p) => p[1]);
  const marge = W * 0.022;
  const cadre = { x: Math.min(...cxs) - marge, y: Math.min(...cys) - marge, l: Math.max(...cxs) - Math.min(...cxs) + 2 * marge, h: Math.max(...cys) - Math.min(...cys) + 2 * marge };

  const e = rebond(t, d.debut, ENTREE, 1.35);
  const s = sortie(t, debutSortie, SORTIE);
  const dy = (1 - e) * H * 0.5 + s * H * 0.55;
  const rot = 5 * (1 - e) - 4 * s;
  const rMax = Math.hypot(W, H * 0.5) * 0.6;
  const pas = Math.max(14, W * 0.017);
  const r = W * 0.0125;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, transformOrigin: `${cxC}px ${cyC}px`, transform: `translateY(${dy}px) rotate(${rot}deg)` }}>
        <defs>
          <clipPath id="carte-france-forme">
            <path d={cheminFrance} />
          </clipPath>
          <pattern id="carte-france-trame" width={pas} height={pas} patternUnits="userSpaceOnUse">
            <circle cx={pas / 2} cy={pas / 2} r={pas * 0.13} fill={COULEURS.encre} opacity={0.16} />
          </pattern>
        </defs>
        {/* Cadre de la Corse (pointillé, fond ivoire translucide). */}
        <rect x={cadre.x} y={cadre.y} width={cadre.l} height={cadre.h} rx={W * 0.012} fill="rgba(233, 220, 200, 0.55)" stroke={COULEURS.encre} strokeWidth={Math.max(2.5, W * 0.003)} strokeDasharray={`${W * 0.012} ${W * 0.008}`} />
        {/* Ombre dure, silhouette sable, trame de points. */}
        <path d={cheminFrance} transform={`translate(${m.ombre * 1.3} ${m.ombre * 1.3})`} fill={COULEURS.encre} strokeLinejoin="round" />
        <path d={cheminFrance} fill={COULEURS.sable} stroke={COULEURS.encre} strokeWidth={m.contour * 1.4} strokeLinejoin="round" />
        <path d={cheminFrance} fill="url(#carte-france-trame)" />
        {/* Ondes ivoire (une par vague), limitées à la silhouette. */}
        <g clipPath="url(#carte-france-forme)">
          {d.vagues.slice(0, 3).map((v, i) => {
            const p = progression(t, v - 0.02, 0.42);
            if (p <= 0 || p >= 1) return null;
            const rr = rMax * (1 - (1 - p) ** 2);
            return <circle key={i} cx={cxC} cy={cyC} r={rr} fill="none" stroke={COULEURS.ivoire} strokeWidth={W * 0.075 * (1 - p * 0.6)} opacity={0.75 * (1 - p)} />;
          })}
        </g>
        {/* Arcs fins en étoile depuis le centre + comète. */}
        {points.map((pt, i) => {
          const p = progression(t, pt.a - 0.14, 0.14);
          if (p <= 0) return null;
          const c = { x: cxC, y: cyC };
          const arc = surArc(c, pt, 0);
          const longueur = arc.long * 1.2;
          const tete = surArc(c, pt, p);
          return (
            <g key={`arc-${i}`}>
              <path d={`M${c.x} ${c.y} Q${arc.cx} ${arc.cy} ${pt.x} ${pt.y}`} fill="none" stroke={COULEURS.encre} strokeWidth={Math.max(3, W * 0.0032)} strokeLinecap="round" strokeDasharray={longueur} strokeDashoffset={longueur * (1 - p)} opacity={0.8} />
              {p < 1 ? <circle cx={tete.x} cy={tete.y} r={W * 0.007} fill={COULEURS.ivoire} stroke={COULEURS.encre} strokeWidth={2} /> : null}
            </g>
          );
        })}
        {/* Points : le centre d'abord, puis chaque point au bout de son arc. */}
        <Pastille t={t} a={aCentre} x={cxC} y={cyC} r={r * 1.3} W={W} i={99} centre />
        {points.map((pt, i) => (
          <Pastille key={`pt-${i}`} t={t} a={pt.a} x={pt.x} y={pt.y} r={r} W={W} i={i} />
        ))}
      </svg>
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. */
export type BruitageMotion = [number, string, number];

/** Arrivée de la carte, un « ping » par point (cascade, deux timbres alternés), départ. */
export function bruitagesCarteFrance(d: DonneesCarteFrance = EXEMPLE_CARTE_FRANCE): BruitageMotion[] {
  const { sortie: s } = tempsCarteFrance(d);
  const proj = projection(1080, 1920);
  const l: BruitageMotion[] = [[d.debut - 0.02, "whoosh-in", 0.2], [d.debut + ENTREE * 0.6, "drop_002", 0.08], [(d.vagues[0] ?? d.debut + 0.3) - 0.02, "select_002", 0.06]];
  planifier(d, proj).forEach((p, i) => l.push([p.a, i % 2 ? "select_002" : "tick_002", 0.045]));
  l.push([s, "whoosh-out", 0.16]);
  return l;
}
