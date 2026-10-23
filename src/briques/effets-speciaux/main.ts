/**
 * OBJET 3D DANS LA MAIN — suivi et ancrage (lot F3). PUR, déterministe, sans alias « @/ ».
 *
 * Entrée : les points MediaPipe Hands déjà calculés par la route `/visages` (piste json.gz, `mains[]` : centre de la
 * paume, main ouverte ou non, une image sur 6, plusieurs mains mêlées), le visage (même piste) et, pour chaque image
 * de sortie, l'instant de la prise et la fenêtre de recadrage. Sortie : une POSE par image (position, taille,
 * apparition, éclat, rotations), que la composition `EffetObjetMain` dessine telle quelle.
 *
 * Règles :
 *   - les échantillons sont regroupés en pistes (une par main) par continuité ; on garde la main qui reste ouverte le
 *     plus longtemps dans le passage demandé ;
 *   - l'objet apparaît quand la main s'ouvre (éclat), la suit (spline puis lissage aller-retour : aucun retard), et
 *     disparaît quand elle se ferme (2 échantillons fermés de suite) ou sort de l'image ;
 *   - main ouverte trouvée moins de `GARDE_FOUS_MAIN.ouverteMinSec` : effet non réussi (variante sans effet,
 *     « Effet non réussi — Réessayer ») ;
 *   - le visage n'est JAMAIS caché : l'objet est écarté (puis réduit) dès qu'il toucherait la boîte du visage.
 */
import type { EchantillonMain, EchantillonVisage } from "../realisation/piste";
import { CONSEIL_PAUME, doigtsDevant, etatPaume, orienterSurPaume, reperePaume, sensLisible, vec3, versIso, versScene, type CoteMain, type PointsMain, type ReperePaume, type Vec3 } from "./paume";
import type { BoitePx, FenetreSource, ObjetMain, PoseObjet } from "./types";

/** Un échantillon de main, avec les mesures facultatives que la route `/visages` peut ajouter (taille, angle). */
export interface EchantillonMainDetaille extends EchantillonMain {
  /** Distance poignet → base du majeur, en part de la LARGEUR de la source. */
  taille?: number;
  /** Lot I2 : les 21 points MediaPipe Hands (x, y normalisés, z en part de la largeur). Présents : l'objet REPOSE sur la paume. */
  points?: PointsMain;
  /** Lot I2 : côté de la main de la personne (MediaPipe Tasks). */
  cote?: CoteMain;
}

/** Format de la source (largeur / hauteur) supposé quand la piste ne le donne pas : prise verticale 9:16. */
export const FORMAT_SOURCE_DEFAUT = 9 / 16;

export const GARDE_FOUS_MAIN = {
  /** Main ouverte trouvée au moins ce temps (s) dans le passage, sinon « Effet non réussi ». */
  ouverteMinSec: 0.8,
  /** Au « Réessayer » : seuil assoupli. */
  ouverteMinSecReessai: 0.5,
  /** Trou toléré entre deux échantillons d'une même main (s) : au-delà, la main est sortie. */
  trouMaxSec: 0.55,
  /** Une main fermée sur un seul échantillon est un raté de MediaPipe : il en faut 2 de suite pour fermer. */
  fermeesDeSuite: 2,
  /** Écart maximal (part de la largeur) entre deux échantillons successifs d'une même main, par seconde écoulée. */
  sautMaxParSec: 0.9,
  /** Durée de l'éclat d'apparition et de la disparition (s). */
  eclatSec: 0.6,
  fuiteSec: 0.3,
  /** Durée maximale de l'objet à l'écran (s). */
  dureeMaxSec: 8,
  /** Taille de l'objet : part de la taille de la paume, bornes en part de la largeur de l'image. */
  objetSurPaume: 1.2,
  tailleMinPct: 0.11,
  tailleMaxPct: 0.36,
  /** Marge autour du visage (part de sa largeur) que l'objet ne franchit jamais. */
  margeVisage: 0.08,
} as const;

/** Paume moyenne ≈ 0,62 fois la largeur du visage (à défaut de `taille` dans la piste). */
const PAUME_SUR_VISAGE = 0.62;

/* ------------------------------------------------------------------ */
/* Pistes par main                                                     */
/* ------------------------------------------------------------------ */

/** Sépare les échantillons mêlés (2 mains au plus par instant) en pistes continues, une par main. */
export function separerMains(mains: EchantillonMainDetaille[]): EchantillonMainDetaille[][] {
  const tries = [...mains].sort((a, b) => a.t - b.t || a.x - b.x);
  const pistes: EchantillonMainDetaille[][] = [];
  let i = 0;
  while (i < tries.length) {
    // Échantillons du même instant.
    let j = i;
    while (j < tries.length && Math.abs(tries[j].t - tries[i].t) < 1e-3) j++;
    const instant = tries.slice(i, j);
    const prises = new Set<number>();
    // Affectation gloutonne par distance croissante (paire échantillon ↔ piste).
    const paires: { e: number; p: number; d: number }[] = [];
    instant.forEach((e, ei) =>
      pistes.forEach((p, pi) => {
        const der = p[p.length - 1];
        const dt = e.t - der.t;
        if (dt <= 0 || dt > GARDE_FOUS_MAIN.trouMaxSec * 2) return;
        const d = Math.hypot(e.x - der.x, e.y - der.y);
        if (d <= 0.12 + GARDE_FOUS_MAIN.sautMaxParSec * dt) paires.push({ e: ei, p: pi, d });
      }),
    );
    paires.sort((a, b) => a.d - b.d);
    const placees = new Set<number>();
    for (const c of paires) {
      if (placees.has(c.e) || prises.has(c.p)) continue;
      pistes[c.p].push(instant[c.e]);
      placees.add(c.e);
      prises.add(c.p);
    }
    instant.forEach((e, ei) => {
      if (!placees.has(ei)) pistes.push([e]);
    });
    i = j;
  }
  return pistes;
}

export interface SegmentOuvert {
  debutSec: number;
  finSec: number;
  echantillons: EchantillonMainDetaille[];
}

/** Pas d'échantillonnage d'une piste (médiane des écarts), 0,24 s par défaut (une image sur 6 à 25 i/s). */
function pasDe(p: EchantillonMainDetaille[]): number {
  const ecarts = p.slice(1).map((e, k) => e.t - p[k].t).filter((d) => d > 0).sort((a, b) => a - b);
  return ecarts.length ? ecarts[Math.floor(ecarts.length / 2)] : 0.24;
}

/**
 * Segments où la main est ouverte : une main fermée sur un seul échantillon reste ouverte (raté de détection) ; deux
 * fermées de suite, ou un trou plus long que `trouMaxSec`, terminent le segment. Bornes : un demi-pas autour des
 * échantillons ouverts extrêmes.
 */
export function segmentsOuverts(piste: EchantillonMainDetaille[], fermeesDeSuite: number = GARDE_FOUS_MAIN.fermeesDeSuite): SegmentOuvert[] {
  const pas = pasDe(piste);
  const segments: SegmentOuvert[] = [];
  let courant: EchantillonMainDetaille[] = [];
  let fermees = 0;
  const clore = () => {
    if (courant.length) segments.push({ debutSec: courant[0].t - pas / 2, finSec: courant[courant.length - 1].t + pas / 2, echantillons: courant });
    courant = [];
  };
  piste.forEach((e, k) => {
    const precedent = k ? piste[k - 1] : null;
    if (precedent && e.t - precedent.t > GARDE_FOUS_MAIN.trouMaxSec) {
      clore();
      fermees = 0;
    }
    if (e.ouverte) {
      fermees = 0;
      courant.push(e);
    } else {
      fermees++;
      if (fermees >= fermeesDeSuite) clore();
      // Une fermée isolée garde sa position (la main est là), sans compter comme ouverte.
      else if (courant.length) courant.push({ ...e, ouverte: true });
    }
  });
  clore();
  // Une fermée isolée en fin de segment n'en fait pas partie.
  return segments.map((s) => {
    const ech = [...s.echantillons];
    while (ech.length && piste.find((p) => p.t === ech[ech.length - 1].t && !p.ouverte)) ech.pop();
    return ech.length ? { debutSec: ech[0].t - pas / 2, finSec: ech[ech.length - 1].t + pas / 2, echantillons: ech } : null;
  }).filter((s): s is SegmentOuvert => s !== null);
}

export type AnalyseMain =
  | { trouvee: true; debutSec: number; finSec: number; echantillons: EchantillonMainDetaille[]; ouverteSec: number; largeurSurHauteur?: number }
  | { trouvee: false; raison: "aucune-main" | "main-trop-courte" | "main-retournee"; ouverteSec: number; conseil?: string };

/**
 * Lot I2 : avec les 21 points, une main n'est « ouverte » pour l'effet que si sa PAUME est ouverte et tournée vers le
 * haut (`etatPaume`) ; sans points, le drapeau `ouverte` de la route `/visages` fait foi (comme avant).
 */
function ouvertePourEffet(m: EchantillonMainDetaille, largeurSurHauteur: number): boolean {
  if (!m.points || m.points.length < 21) return m.ouverte;
  return etatPaume(reperePaume(versIso(m.points, largeurSurHauteur), m.cote)).ok;
}

/**
 * Cherche, dans le passage demandé (temps de la PRISE), la main ouverte le plus longtemps. `reessai` : seuil assoupli
 * (bouton « Réessayer »). Le segment est rogné au passage et à `dureeMaxSec`.
 */
export function analyserMain(mains: EchantillonMainDetaille[] | undefined, debutSec: number, finSec: number, opts: { reessai?: boolean; largeurSurHauteur?: number } = {}): AnalyseMain {
  const format = opts.largeurSurHauteur ?? FORMAT_SOURCE_DEFAUT;
  const brutes = (mains ?? []).filter((m) => m.t >= debutSec - 0.3 && m.t <= finSec + 0.3);
  if (!brutes.length) return { trouvee: false, raison: "aucune-main", ouverteSec: 0 };
  const dedans = brutes.map((m) => (m.points ? { ...m, ouverte: ouvertePourEffet(m, format) } : m));
  // Mains vues ouvertes mais jamais paume vers le haut : « main retournée » (conseil simple pour le nouvel essai).
  const retournees = brutes.filter((m, k) => m.points && m.ouverte && !dedans[k].ouverte).length;
  let meilleur: SegmentOuvert | null = null;
  let meilleureDuree = 0;
  for (const piste of separerMains(dedans)) {
    for (const s of segmentsOuverts(piste)) {
      const a = Math.max(s.debutSec, debutSec);
      const b = Math.min(s.finSec, finSec);
      if (b - a > meilleureDuree) {
        meilleureDuree = b - a;
        meilleur = { ...s, debutSec: a, finSec: b };
      }
    }
  }
  const seuil = opts.reessai ? GARDE_FOUS_MAIN.ouverteMinSecReessai : GARDE_FOUS_MAIN.ouverteMinSec;
  if (!meilleur || meilleureDuree < seuil) {
    const raison = retournees >= 2 ? "main-retournee" : meilleur ? "main-trop-courte" : "aucune-main";
    return { trouvee: false, raison, ouverteSec: +meilleureDuree.toFixed(3), ...(raison === "main-retournee" ? { conseil: CONSEIL_PAUME } : {}) };
  }
  const fin = Math.min(meilleur.finSec, meilleur.debutSec + GARDE_FOUS_MAIN.dureeMaxSec);
  return { trouvee: true, debutSec: meilleur.debutSec, finSec: fin, echantillons: meilleur.echantillons, ouverteSec: +(fin - meilleur.debutSec).toFixed(3), ...(opts.largeurSurHauteur ? { largeurSurHauteur: opts.largeurSurHauteur } : {}) };
}

/* ------------------------------------------------------------------ */
/* Interpolation et lissage                                            */
/* ------------------------------------------------------------------ */

/** Catmull-Rom uniforme sur des échantillons datés (extrapolation constante aux bords). */
export function interpolerSpline(ech: { t: number; x: number; y: number }[], t: number): { x: number; y: number } {
  if (!ech.length) return { x: 0.5, y: 0.5 };
  if (t <= ech[0].t) return { x: ech[0].x, y: ech[0].y };
  const n = ech.length;
  if (t >= ech[n - 1].t) return { x: ech[n - 1].x, y: ech[n - 1].y };
  let k = 0;
  while (k < n - 2 && ech[k + 1].t < t) k++;
  const p0 = ech[Math.max(0, k - 1)];
  const p1 = ech[k];
  const p2 = ech[k + 1];
  const p3 = ech[Math.min(n - 1, k + 2)];
  const u = (t - p1.t) / Math.max(1e-6, p2.t - p1.t);
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
}

/** Lissage exponentiel aller puis retour (aucun retard), comme la piste du visage. */
export function lisserAllerRetour(v: number[], alpha = 0.3): number[] {
  if (v.length < 3) return [...v];
  const aller = [...v];
  for (let i = 1; i < v.length; i++) aller[i] = aller[i - 1] + alpha * (v[i] - aller[i - 1]);
  const retour = [...aller];
  for (let i = v.length - 2; i >= 0; i--) retour[i] = retour[i + 1] + alpha * (aller[i] - retour[i + 1]);
  return retour;
}

/** Boîte du visage (normalisée sur la source) à un instant, interpolée. */
export function boiteVisageA(visage: EchantillonVisage[] | undefined, t: number): [number, number, number, number] | null {
  const e = (visage ?? []).filter((x) => x.confiance > 0);
  if (!e.length) return null;
  const k = e.findIndex((x) => x.t >= t);
  if (k === 0) return e[0].boite;
  if (k < 0) return e[e.length - 1].boite;
  const a = e[k - 1];
  const b = e[k];
  const r = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  return a.boite.map((v, i) => v + (b.boite[i] - v) * r) as [number, number, number, number];
}

/* ------------------------------------------------------------------ */
/* Poses de l'objet, image par image                                  */
/* ------------------------------------------------------------------ */

export interface EntreePosesObjet {
  /** Analyse réussie (`analyserMain`). */
  main: Extract<AnalyseMain, { trouvee: true }>;
  /** Instant de la PRISE de chaque image de sortie (la composition rend `instantsPrise.length` images). */
  instantsPrise: number[];
  /** Fenêtre de la source montrée (recadrage), constante ou par image. */
  cadre: FenetreSource | FenetreSource[];
  largeur: number;
  hauteur: number;
  fps: number;
  /** Échantillons du visage (piste `/visages`) : taille de repli et garde-fou. */
  visage?: EchantillonVisage[];
  objet: ObjetMain;
  /** Graine du mouvement propre (rotation). */
  graine?: number;
}

const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Ressort amorti (0 → 1 avec léger dépassement) : l'objet « jaillit » de la paume. */
function ressortApparition(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-7 * u) * Math.cos(10.5 * u) * (1 - u * 0.15);
}

const vers01 = (x: number) => borne(x, 0, 1);
const doux = (x: number) => {
  const u = vers01(x);
  return u * u * (3 - 2 * u);
};

/** Point de la source (normalisé) → pixels de sortie. */
function versPx(cadre: FenetreSource, x: number, y: number, largeur: number, hauteur: number): PointPxNum {
  return { x: ((x - cadre.x) / cadre.largeur) * largeur, y: ((y - cadre.y) / cadre.hauteur) * hauteur };
}
type PointPxNum = { x: number; y: number };

/** Boîte du visage en pixels de sortie (marge comprise). */
export function boiteVisagePx(boite: [number, number, number, number], cadre: FenetreSource, largeur: number, hauteur: number, marge: number = GARDE_FOUS_MAIN.margeVisage): BoitePx {
  const a = versPx(cadre, boite[0], boite[1], largeur, hauteur);
  const b = versPx(cadre, boite[0] + boite[2], boite[1] + boite[3], largeur, hauteur);
  const m = (b.x - a.x) * marge;
  return [a.x - m, a.y - m, b.x - a.x + 2 * m, b.y - a.y + 2 * m];
}

/** Le disque (cx, cy, r) touche-t-il la boîte ? */
export function disqueToucheBoite(cx: number, cy: number, r: number, b: BoitePx): boolean {
  const px = borne(cx, b[0], b[0] + b[2]);
  const py = borne(cy, b[1], b[1] + b[3]);
  return Math.hypot(cx - px, cy - py) < r;
}

/** Rayon « d'encombrement » de l'objet (part de sa taille apparente) utilisé par le garde-fou du visage. */
export const RAYON_OBJET = 0.55;

/**
 * Poses de l'objet pour chaque image de sortie. Pur et déterministe : mêmes entrées, mêmes poses (rendu image par
 * image, dans n'importe quel ordre, sur n'importe quel cœur).
 */
export function posesObjetMain(e: EntreePosesObjet): PoseObjet[] {
  const avecPoints = e.main.echantillons.filter((x) => x.points && x.points.length >= 21);
  if (avecPoints.length >= 2 && avecPoints.length >= e.main.echantillons.length * 0.6) return posesSurPaume(e, avecPoints);
  const { main, instantsPrise, largeur, hauteur, fps } = e;
  const cadreDe = (i: number): FenetreSource => (Array.isArray(e.cadre) ? e.cadre[Math.min(i, e.cadre.length - 1)] : e.cadre);
  const ech = main.echantillons;
  const n = instantsPrise.length;
  // 1. Position de la paume (spline sur les échantillons à ≈ 4 par seconde), en pixels, puis lissage aller-retour.
  const brutX: number[] = [];
  const brutY: number[] = [];
  const brutTaille: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = instantsPrise[i];
    const c = cadreDe(i);
    const p = interpolerSpline(ech, t);
    const px = versPx(c, p.x, p.y, largeur, hauteur);
    brutX.push(px.x);
    brutY.push(px.y);
    // Taille de la paume : mesure de la piste, sinon d'après la largeur du visage, sinon 16 % de l'image.
    const tailles = ech.filter((x) => typeof x.taille === "number" && Math.abs(x.t - t) < 0.6).map((x) => x.taille!);
    const v = boiteVisageA(e.visage, t);
    const paume = tailles.length
      ? ((tailles.reduce((a, b) => a + b, 0) / tailles.length) / c.largeur) * largeur
      : v
        ? ((v[2] * PAUME_SUR_VISAGE) / c.largeur) * largeur
        : 0.16 * largeur;
    brutTaille.push(borne(paume * GARDE_FOUS_MAIN.objetSurPaume, GARDE_FOUS_MAIN.tailleMinPct * largeur, GARDE_FOUS_MAIN.tailleMaxPct * largeur));
  }
  const paumeX = lisserAllerRetour(brutX, 0.32);
  const paumeY = lisserAllerRetour(brutY, 0.32);
  const taille = lisserAllerRetour(brutTaille, 0.12);

  // 2. Vie de l'objet : éclat à l'ouverture, disparition à la fermeture ou à la sortie.
  const vie = instantsPrise.map((t) => {
    const depuis = t - main.debutSec;
    const avantFin = main.finSec - t;
    const entree = ressortApparition(depuis / GARDE_FOUS_MAIN.eclatSec);
    const sortie = avantFin >= GARDE_FOUS_MAIN.fuiteSec ? 1 : doux(avantFin / GARDE_FOUS_MAIN.fuiteSec);
    const visible = depuis < 0 || avantFin < 0 ? 0 : Math.max(0, entree * sortie);
    return {
      visible,
      eclat: depuis >= 0 && depuis <= GARDE_FOUS_MAIN.eclatSec ? depuis / GARDE_FOUS_MAIN.eclatSec : -1,
      fuite: avantFin >= 0 && avantFin < GARDE_FOUS_MAIN.fuiteSec ? 1 - avantFin / GARDE_FOUS_MAIN.fuiteSec : avantFin < 0 && avantFin > -0.4 ? 1 : -1,
    };
  });

  // 3. L'objet flotte juste au-dessus de la paume. S'il toucherait le visage, on essaie dans l'ordre : le poser SUR
  // la paume, puis devant le bas de la main, puis le réduire ; l'écarter de côté n'est que le dernier recours (il
  // quitte alors un peu la main). Puis lissage, sans jamais revenir sur le visage.
  const decalX: number[] = [];
  const decalY: number[] = [];
  const reduction: number[] = [];
  const ecarte: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const t = instantsPrise[i];
    const c = cadreDe(i);
    const T = taille[i];
    const cx = paumeX[i];
    const cy = paumeY[i] - T * 0.42;
    const v = boiteVisageA(e.visage, t);
    let dx = 0;
    let dy = 0;
    let k = 1;
    let touche = false;
    if (v && vie[i].visible > 0) {
      const b = boiteVisagePx(v, c, largeur, hauteur);
      const r = T * RAYON_OBJET;
      if (disqueToucheBoite(cx, cy, r, b)) {
        touche = true;
        const essais: [number, number][] = [
          [T * 0.42, 1],
          [T * 0.62, 1],
          [T * 0.42, 0.78],
          [T * 0.62, 0.72],
        ];
        const libre = essais.find(([y, kk]) => !disqueToucheBoite(cx, cy + y, r * kk, b));
        if (libre) [dy, k] = libre;
        else {
          // Dernier recours : posé sur la paume, réduit, et décalé du côté de la main juste assez.
          dy = T * 0.42;
          k = 0.72;
          const r2 = r * k;
          const versDroite = cx >= b[0] + b[2] / 2;
          dx = (versDroite ? b[0] + b[2] + r2 : b[0] - r2) - cx;
        }
      }
    }
    decalX.push(dx);
    decalY.push(dy);
    reduction.push(k);
    ecarte.push(touche);
  }
  // Lissage des écarts SANS jamais revenir sur le visage : on garde, image par image, l'écart le plus fort des deux.
  const dxLisse = lisserAllerRetour(decalX, 0.35).map((d, i) => (Math.abs(d) >= Math.abs(decalX[i]) && Math.sign(d) === Math.sign(decalX[i] || d) ? d : decalX[i]));
  const dyLisse = lisserAllerRetour(decalY, 0.3).map((d, i) => Math.max(d, decalY[i]));
  const kLisse = lisserAllerRetour(reduction, 0.3).map((k, i) => Math.min(k, reduction[i]));

  // 4. Rotations : rotation propre lente, élan de l'éclat, inclinaison selon la vitesse de la main.
  const graine = e.graine ?? 0;
  const vitesseRot = 2.1;
  const poses: PoseObjet[] = [];
  for (let i = 0; i < n; i++) {
    const t = instantsPrise[i];
    const depuis = Math.max(0, t - main.debutSec);
    const vx = i > 0 ? (paumeX[i] - paumeX[i - 1]) * fps : n > 1 ? (paumeX[1] - paumeX[0]) * fps : 0;
    const vy = i > 0 ? (paumeY[i] - paumeY[i - 1]) * fps : n > 1 ? (paumeY[1] - paumeY[0]) * fps : 0;
    // Élan : un tour complet qui s'amortit pendant l'éclat, puis l'objet se pose FACE à la caméra et oscille
    // doucement (la pièce, elle, continue de tourner sur elle-même).
    const elan = 2 * Math.PI * (1 - Math.exp(-depuis * 5.5));
    const oscille = Math.sin(depuis * 1.7 + graine) * (e.objet === "telephone" ? 0.28 : 0.4);
    const flotte = Math.sin(depuis * 2.2 + graine) * 0.06;
    const tailleI = taille[i] * kLisse[i];
    poses.push({
      x: +(paumeX[i] + dxLisse[i]).toFixed(2),
      y: +(paumeY[i] - taille[i] * 0.42 + dyLisse[i] + Math.sin(depuis * 2.6 + graine) * tailleI * 0.035).toFixed(2),
      taille: +tailleI.toFixed(2),
      paumeX: +paumeX[i].toFixed(2),
      paumeY: +paumeY[i].toFixed(2),
      visible: +vie[i].visible.toFixed(4),
      eclat: +vie[i].eclat.toFixed(4),
      fuite: +vie[i].fuite.toFixed(4),
      rotY: +(elan + (e.objet === "piece" ? depuis * vitesseRot : oscille)).toFixed(4),
      rotX: +(-0.18 + flotte + borne(vy / (largeur * 1.6), -0.35, 0.35)).toFixed(4),
      rotZ: +borne(-vx / (largeur * 1.4), -0.4, 0.4).toFixed(4),
      ecarte: ecarte[i] || Math.abs(dxLisse[i]) > 0.5 || dyLisse[i] > 0.5,
    });
  }
  return poses;
}

/**
 * Contrôle : sur aucune image l'objet visible ne touche la boîte du visage (marge comprise). Rend les images fautives
 * (vide = conforme). Sert aux tests et au contrôle avant rendu.
 */
export function imagesObjetSurVisage(poses: PoseObjet[], instantsPrise: number[], visage: EchantillonVisage[] | undefined, cadre: FenetreSource | FenetreSource[], largeur: number, hauteur: number): number[] {
  const fautives: number[] = [];
  poses.forEach((p, i) => {
    if (p.visible <= 0.02) return;
    const v = boiteVisageA(visage, instantsPrise[i]);
    if (!v) return;
    const c = Array.isArray(cadre) ? cadre[Math.min(i, cadre.length - 1)] : cadre;
    // Marge réduite de moitié pour le contrôle (le placement en garde une entière).
    const b = boiteVisagePx(v, c, largeur, hauteur, GARDE_FOUS_MAIN.margeVisage / 2);
    if (disqueToucheBoite(p.x, p.y, p.taille * RAYON_OBJET * Math.min(1, p.visible), b)) fautives.push(i);
  });
  return fautives;
}

/* ------------------------------------------------------------------ */
/* Lot I2 : objet POSÉ sur la paume (21 points)                        */
/* ------------------------------------------------------------------ */

/** Pose de chaque objet sur la paume : à plat (téléphone) ou debout sur son socle (logo et les autres). */
export const OBJETS_SUR_PAUME: Record<ObjetMain, { mode: "a-plat" | "debout"; surPaume: number; demiEpaisseur: number }> = {
  // Un téléphone ≈ 1,1 fois la longueur de la paume ; dos sur la paume (demi-épaisseur 0,028 de sa hauteur).
  telephone: { mode: "a-plat", surPaume: 1.1, demiEpaisseur: 0.028 },
  "logo-axion": { mode: "debout", surPaume: 0.72, demiEpaisseur: 0.5 },
  cube: { mode: "debout", surPaume: 0.6, demiEpaisseur: 0.5 },
  sphere: { mode: "debout", surPaume: 0.6, demiEpaisseur: 0.5 },
  piece: { mode: "debout", surPaume: 0.55, demiEpaisseur: 0.5 },
  etoile: { mode: "debout", surPaume: 0.65, demiEpaisseur: 0.5 },
  coeur: { mode: "debout", surPaume: 0.65, demiEpaisseur: 0.5 },
};

/**
 * Élévation du centre de l'objet au-dessus du point de contact, le long de la normale de la paume (part de la taille
 * de l'objet) : demi-épaisseur, plus le bord relevé quand le téléphone est incliné vers la caméra (il s'appuie sur
 * les doigts repliés). Partagée avec la composition.
 */
export function elevationSurPaume(objet: ObjetMain, inclinaison: number): number {
  const o = OBJETS_SUR_PAUME[objet];
  return o.demiEpaisseur + (o.mode === "a-plat" ? Math.sin(inclinaison) * 0.22 : 0);
}

/** Catmull-Rom sur des vecteurs datés (extrapolation constante aux bords). */
function splineVecteurs(ts: number[], valeurs: number[][], t: number): number[] {
  const n = ts.length;
  if (t <= ts[0]) return [...valeurs[0]];
  if (t >= ts[n - 1]) return [...valeurs[n - 1]];
  let k = 0;
  while (k < n - 2 && ts[k + 1] < t) k++;
  const a = valeurs[Math.max(0, k - 1)];
  const b = valeurs[k];
  const c = valeurs[k + 1];
  const d = valeurs[Math.min(n - 1, k + 2)];
  const u = (t - ts[k]) / Math.max(1e-6, ts[k + 1] - ts[k]);
  return b.map((_, i) => 0.5 * (2 * b[i] + (-a[i] + c[i]) * u + (2 * a[i] - 5 * b[i] + 4 * c[i] - d[i]) * u * u + (-a[i] + 3 * b[i] - 3 * c[i] + d[i]) * u * u * u));
}

/**
 * Poses de l'objet posé sur la paume, image par image : les 21 points sont interpolés (spline) puis lissés aller-retour
 * (aucun retard), le repère de la paume donne la position (contact au milieu de la paume), l'orientation (roulis,
 * tangage, lacet), la taille (d'après la longueur de la paume) et les doigts qui passent devant.
 */
function posesSurPaume(e: EntreePosesObjet, ech: EchantillonMainDetaille[]): PoseObjet[] {
  const { main, instantsPrise, largeur, hauteur } = e;
  const n = instantsPrise.length;
  const cadreDe = (i: number): FenetreSource => (Array.isArray(e.cadre) ? e.cadre[Math.min(i, e.cadre.length - 1)] : e.cadre);
  const cotes = ech.map((x) => x.cote).filter((c): c is CoteMain => !!c);
  const cote = cotes.length ? (cotes.filter((c) => c === "droite").length * 2 >= cotes.length ? "droite" : "gauche") : undefined;
  const ts = ech.map((x) => x.t);
  const plats = ech.map((x) => x.points!.slice(0, 21).flat());
  // 1. Points interpolés à chaque image, puis lissés aller-retour (coordonnée par coordonnée).
  const brut = instantsPrise.map((t) => splineVecteurs(ts, plats, t));
  const lisses = brut.length ? brut[0].map((_, k) => lisserAllerRetour(brut.map((v) => v[k]), 0.34)) : [];
  const pointsA = (i: number): PointsMain => Array.from({ length: 21 }, (_, j) => [lisses[j * 3][i], lisses[j * 3 + 1][i], lisses[j * 3 + 2][i]] as Vec3);
  const formats = Array.from({ length: n }, (_, i) => {
    const c = cadreDe(i);
    return largeur / c.largeur / (hauteur / c.hauteur);
  });
  const isos = Array.from({ length: n }, (_, i) => versIso(pointsA(i), formats[i]));
  const reperes: (ReperePaume | null)[] = isos.map((iso) => reperePaume(iso, cote));
  // Un repère incertain reprend le plus proche (la main ne se retourne pas en une image : la fin du segment le dit).
  const proche = (i: number): ReperePaume | null => {
    for (let d = 0; d < n; d++) {
      const a = reperes[i - d];
      if (a && a.sur) return a;
      const b = reperes[i + d];
      if (b && b.sur) return b;
    }
    return reperes[i];
  };
  const finaux = reperes.map((_, i) => proche(i));
  const valides = finaux.filter((r): r is ReperePaume => !!r);
  const config = OBJETS_SUR_PAUME[e.objet];
  const sens = sensLisible(valides);
  // 2. Taille d'après la longueur de la paume (lissée fort : une paume ne change pas de taille).
  const tailles = lisserAllerRetour(
    finaux.map((r, i) => {
      const c = cadreDe(i);
      const pxParIso = hauteur / c.hauteur;
      const L = r ? r.longueur * pxParIso * config.surPaume : GARDE_FOUS_MAIN.tailleMinPct * largeur;
      return borne(L, GARDE_FOUS_MAIN.tailleMinPct * largeur, GARDE_FOUS_MAIN.tailleMaxPct * largeur * 1.4);
    }),
    0.1,
  );
  const vie = vieObjet(main, instantsPrise);
  const graine = e.graine ?? 0;
  const poses: PoseObjet[] = [];
  let precedent: { x: number; y: number } | null = null;
  for (let i = 0; i < n; i++) {
    const r = finaux[i];
    const c = cadreDe(i);
    const format = formats[i];
    const pxParIso = hauteur / c.hauteur;
    const versPxIso = (p: Vec3) => ({ x: ((p[0] / format - c.x) / c.largeur) * largeur, y: ((p[1] - c.y) / c.hauteur) * hauteur });
    if (!r) {
      poses.push({ x: largeur / 2, y: hauteur / 2, taille: tailles[i], paumeX: largeur / 2, paumeY: hauteur / 2, visible: 0, eclat: -1, fuite: -1, rotX: 0, rotY: 0, rotZ: 0, ecarte: false });
      continue;
    }
    const o = orienterSurPaume(r, config.mode, sens);
    const contact = versPxIso(r.creux);
    // Centre de l'objet (iso) : au-dessus du contact, le long de la normale ; plan de sa face pour les doigts devant.
    const tailleIso = tailles[i] / pxParIso;
    const elevation = elevationSurPaume(e.objet, o.inclinaison) * tailleIso;
    const centreIso = vec3.plus(r.creux, vec3.fois(r.normale, elevation));
    const faceIso = versScene(o.face);
    const doigts = doigtsDevant(isos[i], r, centreIso, faceIso, format).map((d) => {
      const a = versPxIso([d.x1 * format, d.y1, 0]);
      const b = versPxIso([d.x2 * format, d.y2, 0]);
      return { x1: +a.x.toFixed(1), y1: +a.y.toFixed(1), x2: +b.x.toFixed(1), y2: +b.y.toFixed(1), r: +(d.r * pxParIso).toFixed(1) };
    });
    const vx = precedent ? contact.x - precedent.x : 0;
    const vy = precedent ? contact.y - precedent.y : 0;
    precedent = contact;
    // Garde-fou du visage : centre apparent de l'objet ; s'il touche le visage, l'objet s'efface (il ne quitte pas la paume).
    const centre = versPxIso(centreIso);
    const v = boiteVisageA(e.visage, instantsPrise[i]);
    const touche = !!v && vie[i].visible > 0 && disqueToucheBoite(centre.x, centre.y, tailles[i] * RAYON_OBJET, boiteVisagePx(v, c, largeur, hauteur));
    // Micro-oscillation naturelle (la main n'est jamais parfaitement immobile), très faible.
    const t = Math.max(0, instantsPrise[i] - main.debutSec);
    poses.push({
      x: +contact.x.toFixed(2),
      y: +contact.y.toFixed(2),
      taille: +tailles[i].toFixed(2),
      paumeX: +contact.x.toFixed(2),
      paumeY: +contact.y.toFixed(2),
      visible: +vie[i].visible.toFixed(4),
      eclat: +vie[i].eclat.toFixed(4),
      fuite: +vie[i].fuite.toFixed(4),
      rotX: +(0.012 * Math.sin(t * 1.9 + graine) + 0.006 * Math.sin(t * 4.3 + graine * 2)).toFixed(4),
      rotY: +(0.014 * Math.sin(t * 1.3 + graine * 3)).toFixed(4),
      rotZ: +(0.01 * Math.sin(t * 2.4 + graine * 5)).toFixed(4),
      ecarte: touche,
      surPaume: {
        quaternion: o.quaternion.map((q) => +q.toFixed(5)) as [number, number, number, number],
        normale: o.normalePaume.map((q) => +q.toFixed(5)) as [number, number, number],
        inclinaison: o.inclinaison,
        doigts,
        vitesseX: +vx.toFixed(2),
        vitesseY: +vy.toFixed(2),
      },
    });
  }
  // L'objet qui toucherait le visage s'efface en fondu (jamais posé sur le visage, jamais de saut).
  const libre = poses.map((p) => (p.ecarte ? 0 : 1));
  const fondu = lisserAllerRetour(libre, 0.3).map((k, i) => Math.min(k, libre[i]));
  return poses.map((p, i) => (fondu[i] < 1 ? { ...p, visible: +(p.visible * fondu[i]).toFixed(4) } : p));
}

/** Vie de l'objet posé : fondu à l'ouverture de la paume (avec un léger éclat), fondu à la fermeture ou au retournement. */
function vieObjet(main: Extract<AnalyseMain, { trouvee: true }>, instantsPrise: number[]) {
  const FONDU = 0.35;
  return instantsPrise.map((t) => {
    const depuis = t - main.debutSec;
    const avantFin = main.finSec - t;
    if (depuis < 0 || avantFin < 0) return { visible: 0, eclat: -1, fuite: avantFin < 0 && avantFin > -0.4 ? 1 : -1 };
    const entree = doux(depuis / FONDU);
    const sortie = avantFin >= GARDE_FOUS_MAIN.fuiteSec ? 1 : doux(avantFin / GARDE_FOUS_MAIN.fuiteSec);
    return {
      visible: Math.min(entree, sortie),
      eclat: depuis <= GARDE_FOUS_MAIN.eclatSec ? depuis / GARDE_FOUS_MAIN.eclatSec : -1,
      fuite: avantFin < GARDE_FOUS_MAIN.fuiteSec ? 1 - avantFin / GARDE_FOUS_MAIN.fuiteSec : -1,
    };
  });
}
