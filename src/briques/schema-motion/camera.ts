/**
 * MOTION DE SCHÉMA · trajectoire de la caméra virtuelle sur la toile (plan § 5, K02 ; Q15). PUR et déterministe.
 *
 * - la caméra arrive sur le nœud 0,2 à 0,3 s AVANT son mot (avance visée 0,25 s), puis s'y tient ;
 * - courbe douce (montée et descente lentes, `doux`) entre deux poses ;
 * - vitesse apparente ≤ 1,2 écran/s (déplacement du centre mesuré en largeurs / hauteurs d'écran vues au zoom courant) ;
 * - zoom borné 0,8-1,6 : AUCUN dézoom d'ensemble (la vue d'ensemble est la scène « Ensemble », B3) ;
 * - le nœud parlé est posé entier dans la bande de contenu (`ZONE_CONTENU_IV` : de 9 % au bas de la zone utile, au-dessus
 *   des sous-titres), centré à mi-bande ;
 * - CADRAGE PROPRE (règle de la direction) : tout nœud (ou étiquette) présent à l'écran est soit ENTIER dans le cadre
 *   avec une marge ≥ 4 % de la largeur, soit entièrement hors cadre ; jamais coupé par un bord. La pose s'éloigne du
 *   centrage idéal (décalage, puis zoom jusqu'à 0,8) pour y parvenir ; l'étape précédente d'une chaîne reste dans le
 *   cadre quand c'est possible. Sinon la pose est signalée (`alertes`) et `disposerEtCadrer` essaie une autre disposition.
 * Si deux mots se suivent trop vite pour la vitesse permise, la caméra part dès qu'elle peut et le retard est signalé
 * (`alertes`) : la vitesse n'est jamais dépassée. Avec `coupeFranche` (17/10, prod : sur une toile plus large que
 * l'écran, le bloc parlé n'était pas entier sur son mot et ses voisins traversaient le bord pendant le panoramique), la
 * caméra COUPE franc à l'heure où elle aurait dû arriver : d'une pose propre à l'autre, sans rien couper entre les deux.
 * Une coupe = deux images clés au même instant ; elle ne compte pas dans la vitesse.
 */
import { ECRAN_IV, ZONE_CONTENU_IV, type BoiteNoeud, type DispositionToile, type ImageCleCamera, type MotParle, type PoseCamera, type TrajectoireCamera } from "./types";

export const BORNES_CAMERA = Object.freeze({
  zoomMin: 0.8,
  zoomMax: 1.6,
  /** Zoom préféré quand la boîte tient largement. */
  zoomPrefere: 1.25,
  /** Écrans par seconde. */
  vitesseMax: 1.2,
  avanceMin: 0.2,
  avanceMax: 0.3,
  avance: 0.25,
});

/** Pic de vitesse de la courbe douce (dérivée max de 3u² − 2u³) rapporté à la vitesse moyenne. */
const PIC_COURBE = 1.5;
/** Marge de sécurité sur la durée d'un mouvement. */
const MARGE_DUREE = 1.05;

/** Courbe douce : départ et arrivée sans à-coup. */
export function doux(u: number): number {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

const H = ECRAN_IV.hauteur;
const L = ECRAN_IV.largeur;

/**
 * Cadrage de la caméra : bande verticale où poser le nœud parlé (fractions de la hauteur ; défaut : la bande de
 * contenu `ZONE_CONTENU_IV`, réduite quand un en-tête occupe le haut de l'écran) et zoom préféré (borné 0,8-1,6).
 */
export type CadrageCamera = {
  bande?: { haut: number; bas: number };
  zoomPrefere?: number;
  /**
   * Partie de l'écran où un texte se lit en entier (fractions de la hauteur ; défaut : tout l'écran). Sous un en-tête,
   * `haut` est la ligne où la toile redevient pleinement visible : au-dessus, elle s'efface sur `FONDU_CADRE`.
   */
  cadre?: { haut: number; bas: number };
  /** Débord des décors d'un nœud hors de sa boîte (pastille d'icône, coche), pixels de toile ; uniforme ou par nœud. */
  debord?: DebordNoeud | ((id: string) => DebordNoeud);
  /** Avance d'apparition d'un nœud sur son premier mot (secondes ; défaut 0,15). */
  apparition?: number;
  /** Autres textes posés sur la toile (pastilles de part…), soumis à la même règle. */
  etiquettes?: readonly EtiquetteToile[];
  /** Coupe franche plutôt qu'un panoramique qui arriverait après le mot (voir `trajectoireCamera`). */
  coupeFranche?: boolean;
};

/**
 * Texte posé sur la toile hors des nœuds (pastille « 80 % »…) : rectangle en pixels de toile, heure d'apparition, et le
 * nœud auquel il se rattache (cadré AVEC lui quand on parle de ce nœud).
 */
export type EtiquetteToile = { id: string; noeud: string; x: number; y: number; largeur: number; hauteur: number; des: number };

export type DebordNoeud = { gauche: number; droite: number; haut: number; bas: number };

/** Marge minimale entre un texte et le bord du cadre, fraction de la LARGEUR de l'écran. */
export const MARGE_CADRE = 0.04;
/** Hauteur du fondu où la toile s'efface sous un en-tête (fraction de la hauteur), juste au-dessus de `cadre.haut`. */
export const FONDU_CADRE = 0.02;
const APPARITION = 0.15;

function bandeDe(c: CadrageCamera = {}): { hauteur: number; milieu: number } {
  const haut = c.bande?.haut ?? ZONE_CONTENU_IV.haut;
  const bas = c.bande?.bas ?? ZONE_CONTENU_IV.bas;
  return { hauteur: (bas - haut) * H, milieu: ((haut + bas) / 2) * H };
}

/** Zoom auquel la boîte entière tient dans la bande (90 % de sa place), sans borne. */
function zoomQuiTient(b: Pick<BoiteNoeud, "largeur" | "hauteur">, c?: CadrageCamera): number {
  return Math.min((L * 0.9) / b.largeur, (bandeDe(c).hauteur * 0.9) / b.hauteur);
}

/**
 * Boîte trop haute (ou trop large) pour tenir entière dans la bande même au zoom le plus faible (0,8) : le zoom reste
 * borné, donc la boîte déborde du cadre à l'heure de son mot. Signalée par `trajectoireCamera`.
 */
export function deborde(b: Pick<BoiteNoeud, "largeur" | "hauteur">, c?: CadrageCamera): boolean {
  return zoomQuiTient(b, c) < BORNES_CAMERA.zoomMin - 1e-9;
}

/** Zoom qui pose la boîte entière dans la bande (90 % de sa place), borné 0,8-1,6. */
export function zoomPour(b: Pick<BoiteNoeud, "largeur" | "hauteur">, c?: CadrageCamera): number {
  const tient = zoomQuiTient(b, c);
  const prefere = Math.min(BORNES_CAMERA.zoomMax, Math.max(BORNES_CAMERA.zoomMin, c?.zoomPrefere ?? BORNES_CAMERA.zoomPrefere));
  return Math.min(BORNES_CAMERA.zoomMax, Math.max(BORNES_CAMERA.zoomMin, Math.min(tient, prefere)));
}

/** Pose qui centre la boîte au milieu de la bande. */
export function posePour(b: BoiteNoeud, c?: CadrageCamera): PoseCamera {
  const zoom = zoomPour(b, c);
  const cx = b.x + b.largeur / 2;
  const cy = b.y + b.hauteur / 2 + (H / 2 - bandeDe(c).milieu) / zoom;
  return { cx, cy, zoom };
}

/** Rectangle de la boîte vu à l'écran pour une pose donnée (pixels d'écran). */
export function boiteALEcran(b: Pick<BoiteNoeud, "x" | "y" | "largeur" | "hauteur">, p: PoseCamera): { x: number; y: number; largeur: number; hauteur: number } {
  return {
    x: L / 2 + (b.x - p.cx) * p.zoom,
    y: H / 2 + (b.y - p.cy) * p.zoom,
    largeur: b.largeur * p.zoom,
    hauteur: b.hauteur * p.zoom,
  };
}

/** Distance apparente entre deux poses, en écrans, vue au plus fort des deux zooms. */
function distanceEcrans(a: PoseCamera, b: PoseCamera): number {
  const z = Math.max(a.zoom, b.zoom);
  return Math.hypot(((b.cx - a.cx) * z) / L, ((b.cy - a.cy) * z) / H);
}

/** Durée minimale d'un mouvement entre deux poses (vitesse de pointe ≤ vitesse max). */
export function dureeMouvement(a: PoseCamera, b: PoseCamera): number {
  const d = distanceEcrans(a, b);
  return d === 0 ? 0 : (PIC_COURBE * d * MARGE_DUREE) / BORNES_CAMERA.vitesseMax;
}

const memePose = (a: PoseCamera, b: PoseCamera) => a.cx === b.cx && a.cy === b.cy && a.zoom === b.zoom;
const arrondi = (x: number) => Math.round(x * 1000) / 1000;

/* ------------------------------------------------------------------ */
/* Cadrage propre : aucun texte coupé par un bord                       */
/* ------------------------------------------------------------------ */

type Rect = { x: number; y: number; largeur: number; hauteur: number };

/** Ce qui porte un texte sur la toile (nœud avec ses décors, ou étiquette), avec son heure d'apparition. */
export type ObjetLisible = Rect & { id: string; des: number; sorte: "noeud" | "etiquette"; noeud: string };

/** Emprise d'un nœud à l'écran : sa boîte plus ses décors (pastille d'icône à gauche, coche en haut à droite). */
export function emprise(b: Pick<BoiteNoeud, "id" | "x" | "y" | "largeur" | "hauteur">, c?: CadrageCamera): Rect {
  const brut = c?.debord;
  const d = (typeof brut === "function" ? brut(b.id) : brut) ?? { gauche: 0, droite: 0, haut: 0, bas: 0 };
  return { x: b.x - d.gauche, y: b.y - d.haut, largeur: b.largeur + d.gauche + d.droite, hauteur: b.hauteur + d.haut + d.bas };
}

/** Nœuds dits (à partir de leur premier mot, moins l'avance d'apparition) et étiquettes de la toile. PUR. */
export function objetsLisibles(toile: DispositionToile, mots: readonly MotParle[], c?: CadrageCamera): ObjetLisible[] {
  const premier = new Map<string, number>();
  for (const m of mots) premier.set(m.noeud, Math.min(premier.get(m.noeud) ?? Infinity, m.t));
  const objets: ObjetLisible[] = [];
  for (const b of toile.boites) {
    const t0 = premier.get(b.id);
    if (t0 === undefined) continue;
    objets.push({ id: b.id, noeud: b.id, sorte: "noeud", des: t0 - (c?.apparition ?? APPARITION), ...emprise(b, c) });
  }
  for (const e of c?.etiquettes ?? []) objets.push({ id: e.id, noeud: e.noeud, sorte: "etiquette", des: e.des, x: e.x, y: e.y, largeur: e.largeur, hauteur: e.hauteur });
  return objets.sort((a, b) => a.des - b.des || a.id.localeCompare(b.id));
}

/** Limites du cadre en pixels d'écran : où un texte se lit en entier, où il est entièrement caché, la marge. */
function limitesCadre(c?: CadrageCamera) {
  const haut = (c?.cadre?.haut ?? 0) * H;
  const bas = (c?.cadre?.bas ?? 1) * H;
  return { haut, bas, cacheHaut: c?.cadre ? Math.max(0, haut - FONDU_CADRE * H) : 0, marge: MARGE_CADRE * L };
}

export type EtatCadre = "entier" | "hors" | "coupe";
/** Tolérance de calcul sur les positions du cadre (pixels) et les instants. */
const EPS_CADRE = 1e-6;

/**
 * État d'un rectangle de toile pour une pose : ENTIER dans le cadre avec la marge, HORS du cadre (hors de l'écran ou
 * entièrement sous le fondu de l'en-tête), ou COUPÉ (interdit). PUR.
 */
export function etatDansCadre(r: Rect, pose: PoseCamera, c?: CadrageCamera): EtatCadre {
  const e = boiteALEcran(r, pose);
  const k = limitesCadre(c);
  if (e.x + e.largeur <= EPS_CADRE || e.x >= L - EPS_CADRE || e.y + e.hauteur <= k.cacheHaut + EPS_CADRE || e.y >= k.bas - EPS_CADRE) return "hors";
  if (e.x >= k.marge - EPS_CADRE && e.x + e.largeur <= L - k.marge + EPS_CADRE && e.y >= k.haut + k.marge - EPS_CADRE && e.y + e.hauteur <= k.bas - k.marge + EPS_CADRE) return "entier";
  return "coupe";
}

export type DefautCadrage = { t: number; id: string; ecran: Rect };

/**
 * CONTRÔLE (pur) : à chaque instant clé (images clés de la caméra, mots, apparitions ; ou `instants`), aucun objet
 * lisible présent n'est coupé par un bord du cadre. Rend la liste des défauts (vide = cadrage propre).
 */
export function controlerCadrage(
  toile: DispositionToile,
  traj: Pick<TrajectoireCamera, "images">,
  mots: readonly MotParle[],
  c?: CadrageCamera,
  instants?: readonly number[],
): DefautCadrage[] {
  const objets = objetsLisibles(toile, mots, c);
  const fin = traj.images.length ? traj.images[traj.images.length - 1].t : 0;
  const cles = instants ?? [...traj.images.map((i) => i.t), ...mots.map((m) => m.t), ...objets.map((o) => o.des)];
  const liste = [...new Set(cles.map(arrondi))].filter((t) => t >= 0 && t <= fin + EPS_CADRE).sort((a, b) => a - b);
  const defauts: DefautCadrage[] = [];
  for (const t of liste) {
    const pose = cameraA(traj, t);
    for (const o of objets) {
      if (o.des > t + EPS_CADRE) continue;
      if (etatDansCadre(o, pose, c) === "coupe") defauts.push({ t, id: o.id, ecran: boiteALEcran(o, pose) });
    }
  }
  return defauts;
}

/** Pas de la recherche du zoom (entre 0,8 et 1,6). */
const PAS_ZOOM = 0.02;
/** Poids d'un écart de zoom (log) face à un décalage (en écrans) dans le choix de la pose. */
const POIDS_ZOOM = 2;
/** Pénalité quand l'étape précédente ne peut pas rester dans le cadre. */
const SANS_PRECEDENT = 1000;

type RecherchePose = { pose: PoseCamera; propre: boolean; precedentVu: boolean };

/**
 * Pose de la caméra pour un mot : la boîte parlée entière dans la bande, ses étiquettes entières dans le cadre, l'étape
 * précédente entière si possible, et chaque autre objet présent entier OU hors cadre. Parmi les poses permises, la plus
 * proche du centrage idéal (zoom préféré, nœud centré). `propre = false` si aucune pose ne convient (pose idéale rendue).
 */
function chercherPose(cible: BoiteNoeud, attaches: Rect[], precedent: Rect | null, autres: Rect[], c?: CadrageCamera): RecherchePose {
  const ideal = posePour(cible, c);
  const k = limitesCadre(c);
  // Une boîte trop haute pour la bande (signalée) doit au moins tenir entière dans le cadre.
  const b = deborde(cible, c) ? { hauteur: k.bas - k.haut - 2 * k.marge, milieu: (k.haut + k.bas) / 2 } : bandeDe(c);
  const bandeHaut = b.milieu - b.hauteur / 2;
  const bandeBas = b.milieu + b.hauteur / 2;
  const obligatoires = [emprise(cible, c), ...attaches];
  const z0 = ideal.zoom;
  const zMax = Math.min(BORNES_CAMERA.zoomMax, b.hauteur / cible.hauteur);
  const zooms: number[] = [z0];
  for (let z = BORNES_CAMERA.zoomMin; z <= zMax + EPS_CADRE; z += PAS_ZOOM) zooms.push(Math.round(z * 1000) / 1000);
  const ordre = [...new Set(zooms)].filter((z) => z <= zMax + EPS_CADRE).sort((a, b2) => Math.abs(Math.log(a / z0)) - Math.abs(Math.log(b2 / z0)) || a - b2);
  // Centre visé : la boîte parlée centrée ; avec l'étape précédente, le couple centré dans la bande s'il y tient.
  const surveilles = precedent ? [precedent, ...autres] : autres;
  let meilleur: (RecherchePose & { score: number }) | null = null;
  for (const z of ordre) {
    const penaliteZoom = POIDS_ZOOM * Math.abs(Math.log(z / z0));
    if (meilleur && penaliteZoom >= meilleur.score) break;
    const demiL = (L / 2 - k.marge) / z;
    let xMin = -Infinity;
    let xMax = Infinity;
    let yMin = cible.y + cible.hauteur - (bandeBas - H / 2) / z;
    let yMax = cible.y - (bandeHaut - H / 2) / z;
    for (const r of obligatoires) {
      xMin = Math.max(xMin, r.x + r.largeur - demiL);
      xMax = Math.min(xMax, r.x + demiL);
      yMin = Math.max(yMin, r.y + r.hauteur - (k.bas - k.marge - H / 2) / z);
      yMax = Math.min(yMax, r.y - (k.haut + k.marge - H / 2) / z);
    }
    if (xMin > xMax + EPS_CADRE || yMin > yMax + EPS_CADRE) continue;
    const cx0 = cible.x + cible.largeur / 2;
    let cy0 = cible.y + cible.hauteur / 2 + (H / 2 - b.milieu) / z;
    if (precedent) {
      const haut = Math.min(precedent.y, cible.y);
      const bas = Math.max(precedent.y + precedent.hauteur, cible.y + cible.hauteur);
      if ((bas - haut) * z <= b.hauteur) cy0 = (haut + bas) / 2 + (H / 2 - b.milieu) / z;
    }
    const borne = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const xs = [borne(cx0, xMin, xMax)];
    const ys = [borne(cy0, yMin, yMax)];
    for (const r of surveilles) {
      // Hors cadre sur le côté : avec la marge du cadre en plus, pour qu'un panoramique qui démarre ne le fasse pas surgir.
      xs.push(r.x + demiL, r.x + r.largeur - demiL, r.x + r.largeur + (L / 2 + k.marge) / z, r.x - (L / 2 + k.marge) / z);
      ys.push(r.y - (k.haut + k.marge - H / 2) / z, r.y + r.hauteur - (k.bas - k.marge - H / 2) / z, r.y + r.hauteur - (k.cacheHaut - H / 2) / z, r.y - (k.bas - H / 2) / z);
    }
    const dansX = [...new Set(xs.filter((x) => x >= xMin - EPS_CADRE && x <= xMax + EPS_CADRE).map((x) => borne(x, xMin, xMax)))].sort((a, b2) => Math.abs(a - cx0) - Math.abs(b2 - cx0) || a - b2);
    const dansY = [...new Set(ys.filter((y) => y >= yMin - EPS_CADRE && y <= yMax + EPS_CADRE).map((y) => borne(y, yMin, yMax)))].sort((a, b2) => Math.abs(a - cy0) - Math.abs(b2 - cy0) || a - b2);
    // État de chaque objet surveillé, axe par axe : « dedans » (avec la marge), « dehors », ou entre les deux.
    const etatsX = dansX.map((cx) =>
      surveilles.map((r) => {
        const g = L / 2 + (r.x - cx) * z;
        const d = g + r.largeur * z;
        return d <= EPS_CADRE || g >= L - EPS_CADRE ? 2 : g >= k.marge - EPS_CADRE && d <= L - k.marge + EPS_CADRE ? 1 : 0;
      }),
    );
    const etatsY = dansY.map((cy) =>
      surveilles.map((r) => {
        const h = H / 2 + (r.y - cy) * z;
        const bb = h + r.hauteur * z;
        return bb <= k.cacheHaut + EPS_CADRE || h >= k.bas - EPS_CADRE ? 2 : h >= k.haut + k.marge - EPS_CADRE && bb <= k.bas - k.marge + EPS_CADRE ? 1 : 0;
      }),
    );
    for (let i = 0; i < dansX.length; i++) {
      for (let j = 0; j < dansY.length; j++) {
        const ex = etatsX[i];
        const ey = etatsY[j];
        let ok = true;
        for (let n = 0; n < surveilles.length && ok; n++) ok = ex[n] === 2 || ey[n] === 2 || (ex[n] === 1 && ey[n] === 1);
        if (!ok) continue;
        const precedentVu = precedent !== null && ex[0] === 1 && ey[0] === 1;
        const score = (precedent && !precedentVu ? SANS_PRECEDENT : 0) + penaliteZoom + Math.hypot(((dansX[i] - cx0) * z) / L, ((dansY[j] - cy0) * z) / H);
        if (!meilleur || score < meilleur.score - 1e-12) meilleur = { pose: { cx: dansX[i], cy: dansY[j], zoom: z }, propre: true, precedentVu, score };
      }
    }
  }
  // Pose gardée en pleine précision : arrondie, elle pourrait rogner un bord posé pile sur la limite du cadre.
  if (!meilleur) return { pose: ideal, propre: false, precedentVu: false };
  return { pose: meilleur.pose, propre: true, precedentVu: meilleur.precedentVu };
}

/**
 * Pose visée pour chaque mot (cadrage propre). L'étape précédente = le nœud du mot d'avant, s'il mène au nœud parlé par
 * une flèche. Les objets comptés sont ceux présents juste avant que le nœud suivant n'apparaisse (toute la tenue de la
 * pose), ceux du nœud parlé lui compris.
 */
export function posesDesMots(toile: DispositionToile, mots: readonly MotParle[], dureeSec: number, c?: CadrageCamera): { noeud: string; t: number; pose: PoseCamera; propre: boolean; precedentVu: boolean | null }[] {
  const parId = new Map(toile.boites.map((b) => [b.id, b]));
  const suite = [...mots].sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud)).filter((m) => parId.has(m.noeud));
  const objets = objetsLisibles(toile, suite, c);
  const fleches = new Set(toile.fleches.map((f) => `${f.de}>${f.vers}`));
  const apparition = c?.apparition ?? APPARITION;
  const poses = suite.map((m, i) => {
    const cible = parId.get(m.noeud)!;
    const suivant = suite.slice(i + 1).find((x) => x.noeud !== m.noeud);
    const jusque = suivant ? suivant.t - apparition - 1e-3 : dureeSec;
    const presents = objets.filter((o) => o.des <= Math.max(jusque, m.t) && !(o.sorte === "noeud" && o.id === m.noeud));
    const avant = i > 0 ? suite[i - 1].noeud : null;
    const precedentId = avant && avant !== m.noeud && fleches.has(`${avant}>${m.noeud}`) ? avant : null;
    const attaches = presents.filter((o) => o.sorte === "etiquette" && o.noeud === m.noeud);
    const precedent = precedentId ? (presents.find((o) => o.sorte === "noeud" && o.id === precedentId) ?? null) : null;
    const autres = presents.filter((o) => !attaches.includes(o) && o !== precedent);
    // Étiquettes du nœud dans le cadre si possible ; sinon elles obéissent seulement à la règle (entières ou hors cadre).
    let r = chercherPose(cible, attaches, precedent, autres, c);
    if (!r.propre && attaches.length) r = chercherPose(cible, [], precedent, [...attaches, ...autres], c);
    return { noeud: m.noeud, t: m.t, pose: r.pose, propre: r.propre, precedentVu: precedent ? r.precedentVu : null };
  });
  // Mots SERRÉS (17/10, prod) : moins de `ECART_SERRE` entre deux blocs, ou un 2e bloc avant que la caméra ait pu
  // bouger depuis le début de la séquence : ni panoramique ni coupe ne tiennent. La caméra dézoome pour cadrer tout le
  // groupe ENTIER d'une seule pose (zoom ≥ 0,8) ; si le groupe ne tient pas, chaque mot garde sa pose.
  for (const g of groupesSerres(suite)) {
    const noeuds = [...new Set(g.map((k) => suite[k].noeud))];
    const dernier = g[g.length - 1];
    const suivant = suite.slice(dernier + 1).find((x) => !noeuds.includes(x.noeud));
    const jusque = suivant ? suivant.t - apparition - 1e-3 : dureeSec;
    const presents = objets.filter((o) => o.des <= Math.max(jusque, suite[dernier].t) && !(o.sorte === "noeud" && noeuds.includes(o.id)));
    const etiquettes = presents.filter((o) => o.sorte === "etiquette" && noeuds.includes(o.noeud));
    const autres = presents.filter((o) => !etiquettes.includes(o));
    // Le bloc posé dans la bande : le premier dit qui laisse tout le groupe entier.
    for (const id of noeuds) {
      const attaches = [...noeuds.filter((x) => x !== id).map((x) => emprise(parId.get(x)!, c)), ...etiquettes];
      const r = chercherPose(parId.get(id)!, attaches, null, autres, c);
      if (!r.propre) continue;
      for (const k of g) poses[k] = { ...poses[k], pose: r.pose, propre: true, precedentVu: poses[k].precedentVu === null ? null : true };
      break;
    }
  }
  // Première image (lot F, autorisé par le chef de projet) : la première carte se pose en HAUT de la bande, juste sous
  // l'en-tête, au lieu d'en occuper le milieu (trou de 18 à 24 % entre le titre et elle) ; la suite du schéma se voit
  // dessous. Même zoom, même carte entière ; les mots suivants sur la même carte, à la même pose, la gardent.
  if (poses.length) {
    const base = poses[0].pose;
    const haute = premierePoseHaute(parId.get(poses[0].noeud)!, base, c);
    // Un groupe serré cadré d'une seule pose monte d'un bloc s'il reste entier ; sinon il garde sa pose.
    let n = 0;
    while (n < poses.length && memePose(poses[n].pose, base)) n++;
    const entiers = poses.slice(0, n).every((p) => etatDansCadre(emprise(parId.get(p.noeud)!, c), haute, c) === "entier");
    const garder = n > 0 && poses.slice(0, n).some((p) => p.noeud !== poses[0].noeud) && !entiers;
    for (let i = 0; i < n && !garder; i++) poses[i] = { ...poses[i], pose: haute };
  }
  return poses;
}

/** Écart (s) sous lequel deux mots sur deux blocs différents sont trop serrés pour que la caméra passe de l'un à l'autre. */
export const ECART_SERRE = BORNES_CAMERA.avance + 0.05;

/**
 * Groupes de mots serrés (indices dans `suite`, triée) : deux mots consécutifs sur deux blocs différents à moins de
 * `ECART_SERRE` (ou le 2e bloc dit avant `ECART_SERRE` depuis le début de la séquence). Les mots du même instant suivent
 * leur voisin. Seuls les groupes d'au moins deux blocs sont rendus.
 */
function groupesSerres(suite: readonly MotParle[]): number[][] {
  const groupes: number[][] = [];
  let g: number[] = [0];
  let serre = false;
  for (let k = 1; k < suite.length; k++) {
    const ecart = suite[k].t - suite[k - 1].t;
    const autre = suite[k].noeud !== suite[k - 1].noeud;
    const serreIci = autre && ((ecart >= 1e-9 && ecart < ECART_SERRE) || suite[k].t < ECART_SERRE);
    if (ecart < 1e-9 || serreIci) {
      g.push(k);
      if (serreIci) serre = true;
      continue;
    }
    if (serre) groupes.push(g);
    g = [k];
    serre = false;
  }
  if (serre) groupes.push(g);
  return groupes.filter((x) => new Set(x.map((k) => suite[k].noeud)).size >= 2);
}

/**
 * Pose qui monte la boîte en haut de la bande (le haut de son EMPRISE, coche comprise, sur `bande.haut`), même zoom ;
 * inchangée si elle y est déjà. 17/10 : mesurée sur la boîte seule, la coche d'un nœud « fait » dépassait le cadre.
 */
function premierePoseHaute(b: BoiteNoeud, pose: PoseCamera, c?: CadrageCamera): PoseCamera {
  const k = limitesCadre(c);
  const haut = Math.max((c?.bande?.haut ?? ZONE_CONTENU_IV.haut) * H, c?.cadre ? k.haut + k.marge : 0);
  const ecran = boiteALEcran(emprise(b, c), pose);
  if (ecran.y <= haut + 1) return pose;
  return { ...pose, cy: pose.cy + (ecran.y - haut) / pose.zoom };
}

/**
 * Trajectoire de la caméra pour une suite de mots parlés (`t` croissants ; égalités départagées par id de nœud).
 * Les nœuds inconnus de la toile sont ignorés et signalés ; une boîte qui ne tient pas entière dans le cadre même au zoom
 * 0,8 est signalée aussi (le zoom reste borné), comme un mot pour lequel aucun cadrage propre n'existe.
 */
export function trajectoireCamera(toile: DispositionToile, mots: readonly MotParle[], dureeSec: number, cadrage?: CadrageCamera): TrajectoireCamera {
  const parId = new Map(toile.boites.map((b) => [b.id, b]));
  const alertes: string[] = [];
  const suite = [...mots].sort((a, b) => a.t - b.t || a.noeud.localeCompare(b.noeud));
  const connus = suite.filter((m) => {
    if (parId.has(m.noeud)) return true;
    alertes.push(`Le bloc ${m.noeud} n'est pas sur la toile.`);
    return false;
  });
  if (connus.length === 0) return { images: [], alertes };
  for (const id of [...new Set(connus.map((m) => m.noeud))].sort()) {
    if (deborde(parId.get(id)!, cadrage)) alertes.push(`Le bloc ${id} est trop grand pour tenir entier dans le cadre : raccourcissez son texte.`);
  }
  const poses = posesDesMots(toile, connus, dureeSec, cadrage);
  for (const p of poses) {
    if (!p.propre) alertes.push(`Au mot du bloc ${p.noeud} (${p.t} s), aucun cadrage ne garde tous les blocs entiers : un bloc serait coupé par le bord.`);
  }

  const images: ImageCleCamera[] = [{ t: 0, ...poses[0].pose }];
  for (const p of poses.slice(1).map((x, i) => ({ ...x, precedent: poses[i].noeud !== x.noeud ? poses[i].t : undefined }))) {
    const derniere = images[images.length - 1];
    const vers = p.pose;
    if (memePose(derniere, vers)) continue;
    const d = dureeMouvement(derniere, vers);
    // La caméra ne quitte pas un bloc avant son mot (17/10 : partie plus tôt, elle le coupait au bord à son apparition).
    const auPlusTot = Math.max(derniere.t, p.precedent ?? 0);
    let arrivee = p.t - BORNES_CAMERA.avance;
    let depart = arrivee - d;
    if (depart < auPlusTot) {
      depart = auPlusTot;
      arrivee = depart + d;
    }
    const coupe = arrondi(p.t - BORNES_CAMERA.avance);
    if (arrivee > p.t - BORNES_CAMERA.avanceMin + 1e-9 && cadrage?.coupeFranche && coupe >= auPlusTot) {
      // Coupe franche : la pose d'avant tient jusqu'à l'heure d'arrivée visée, puis la pose du mot, au même instant.
      if (coupe > derniere.t) images.push({ t: coupe, cx: derniere.cx, cy: derniere.cy, zoom: derniere.zoom });
      images.push({ t: coupe, ...vers });
      continue;
    }
    if (arrivee > p.t - BORNES_CAMERA.avanceMin + 1e-9) {
      alertes.push(`La caméra arrive sur ${p.noeud} ${arrondi(arrivee - (p.t - BORNES_CAMERA.avance))} s trop tard : espacez ces deux mots.`);
    }
    if (depart > derniere.t) images.push({ t: arrondi(depart), cx: derniere.cx, cy: derniere.cy, zoom: derniere.zoom });
    images.push({ t: arrondi(arrivee), ...vers });
  }
  const fin = images[images.length - 1];
  if (dureeSec > fin.t) images.push({ ...fin, t: arrondi(dureeSec) });
  return { images, alertes };
}

/** Pose de la caméra à l'instant `t` (courbe douce entre deux images clés, zoom interpolé en proportion). */
export function cameraA(traj: Pick<TrajectoireCamera, "images">, t: number): PoseCamera {
  const im = traj.images;
  if (im.length === 0) return { cx: L / 2, cy: H / 2, zoom: 1 };
  if (t <= im[0].t) return { cx: im[0].cx, cy: im[0].cy, zoom: im[0].zoom };
  for (let i = 1; i < im.length; i++) {
    const a = im[i - 1];
    const b = im[i];
    if (t <= b.t) {
      const u = b.t === a.t ? 1 : doux((t - a.t) / (b.t - a.t));
      return {
        cx: a.cx + (b.cx - a.cx) * u,
        cy: a.cy + (b.cy - a.cy) * u,
        zoom: a.zoom * Math.pow(b.zoom / a.zoom, u),
      };
    }
  }
  const z = im[im.length - 1];
  return { cx: z.cx, cy: z.cy, zoom: z.zoom };
}

/** Instants des coupes franches d'une trajectoire (deux images clés au même instant, poses différentes). */
export function coupesFranches(traj: Pick<TrajectoireCamera, "images">): number[] {
  return traj.images.filter((x, k, l) => k > 0 && l[k - 1].t === x.t && !memePose(l[k - 1], x)).map((x) => x.t);
}

/**
 * Vitesse apparente maximale (écrans/s) et zooms extrêmes, mesurés par échantillonnage (pas en secondes). Un pas qui
 * enjambe une coupe franche ne compte pas dans la vitesse (la caméra ne glisse pas : l'image change d'un coup).
 */
export function mesurerTrajectoire(traj: Pick<TrajectoireCamera, "images">, pas = 1 / 50): { vitesseMax: number; zoomMin: number; zoomMax: number } {
  const im = traj.images;
  if (im.length === 0) return { vitesseMax: 0, zoomMin: 1, zoomMax: 1 };
  const fin = im[im.length - 1].t;
  const coupes = coupesFranches(traj);
  let vitesseMax = 0;
  let zoomMin = Infinity;
  let zoomMax = -Infinity;
  let avant = cameraA(traj, 0);
  for (let k = 1; k * pas <= fin + 1e-9; k++) {
    const p = cameraA(traj, k * pas);
    const z = Math.max(p.zoom, avant.zoom);
    const enjambe = coupes.some((t) => t >= (k - 1) * pas - 1e-9 && t < k * pas - 1e-9);
    if (!enjambe) vitesseMax = Math.max(vitesseMax, Math.hypot(((p.cx - avant.cx) * z) / L, ((p.cy - avant.cy) * z) / H) / pas);
    zoomMin = Math.min(zoomMin, p.zoom);
    zoomMax = Math.max(zoomMax, p.zoom);
    avant = p;
  }
  zoomMin = Math.min(zoomMin, im[0].zoom);
  zoomMax = Math.max(zoomMax, im[0].zoom);
  return { vitesseMax, zoomMin, zoomMax };
}
