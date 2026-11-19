/**
 * MOTION DU FILM DE NAVIGATION (T-EXT-44) — PUR et déterministe : même entrée = même sortie, sans horloge ni hasard, sans
 * IA. Imports RELATIFS seulement (lu tel quel par `studio-rendu`), aucun import du moteur, aucune couleur écrite ici.
 *
 * Calcule, à partir des cibles (T-EXT-03) et des instants des mots de la voix mesurée (T-EXT-02) :
 *  - la CAMÉRA : arrive sur chaque zone 250 ms avant son mot, glisse sans à-coup d'une zone à l'autre, respire (retour à 1)
 *    entre deux zones éloignées, tient la zone ENTIÈRE au-dessus des sous-titres ; bornes et vitesse du schéma (Image → vidéo) ;
 *  - le CURSEUR : trajet en arc, arrivée 150 ms avant le clic, clic sur le mot, au repos entre deux gestes ;
 *  - le PROJECTEUR : la zone montrée s'éclaire, le reste s'assombrit ;
 *  - le VOLET « avant → maintenant » : net, sans texte.
 * Ne lève jamais : une entrée illisible donne un plan vide et une alerte.
 */
import { ECHELLE_MAX, ECHELLE_MIN, profilCamera, trajetSurCourbe, type NomProfilCamera, type PointPct } from "../../motion/camera-couverture/courbes-camera";
import { progres } from "../../motion/courbes";
import { BORNES_CAMERA, MARGE_CADRE, doux } from "../../schema-motion/camera";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

/** Les quatre crans du dosage (X3-01), déclarés ici : `dosage-motion` n'est pas copié dans l'image de rendu. */
export type CranFilm = "aucun" | "sobre" | "equilibre" | "dynamique";

export interface ZoneFilm {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface CibleMotion {
  etapeId: string;
  zonePct?: ZoneFilm;
  /** Début du mot d'ancre de la voix mesurée (horloge de la voix, ms). */
  instantMs: number;
  finMs: number;
}

/** Ce que le calcul lit de `NavigationFilmee` (structurel : pas d'import du fichier voisin). */
export interface NavMotion {
  /** Taille de la page filmée, px CSS. */
  largeur: number;
  hauteur: number;
  cibles: readonly CibleMotion[];
  cran?: CranFilm;
  /** Haut de la bande des sous-titres, en % de la hauteur de l'image (défaut 72). */
  hautSousTitresPct?: number;
  /** Début de la scène « maintenant » : un volet traverse l'écran à cet instant (absent : aucun volet). */
  basculeMs?: number;
}

export interface FormatMotion {
  largeur: number;
  hauteur: number;
}

export interface ImageCleCamera {
  tMs: number;
  /** Centre de la vue, en px de l'image de sortie avant caméra. */
  cx: number;
  cy: number;
  zoom: number;
  /** Profil du mouvement qui ARRIVE sur cette image clé. */
  profil: NomProfilCamera;
}

export interface PointCurseur {
  tMs: number;
  /** En % de la capture (la page filmée) : le curseur suit la caméra. */
  x: number;
  y: number;
}

export interface Clic {
  tMs: number;
  x: number;
  y: number;
}

export interface ProjecteurPlan {
  debutMs: number;
  finMs: number;
  zone: ZoneFilm;
}

export interface VoletPlan {
  tMs: number;
  dureeMs: number;
}

export interface PlanMotionFilm {
  camera: ImageCleCamera[];
  curseur: PointCurseur[];
  clics: Clic[];
  projecteurs: ProjecteurPlan[];
  volets: VoletPlan[];
  alertes: string[];
  /** Géométrie utile à la lecture (format de l'image, page posée dedans, bande des sous-titres). */
  geometrie: { format: FormatMotion; page: PagePlacee; hautSousTitresPct: number };
}

export interface PagePlacee {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface PoseCamera {
  cx: number;
  cy: number;
  zoom: number;
}

export interface EntreeMotionFilm {
  nav: NavMotion;
  format: FormatMotion;
}

/* ------------------------------------------------------------------ */
/* Constantes (valeurs revues avec will-dc ; jamais les bornes communes) */
/* ------------------------------------------------------------------ */

/** Bornes du zoom : celles des courbes de caméra communes (re-exportées : `motion-film.ts` est leur seul consommateur). */
export { ECHELLE_MAX, ECHELLE_MIN };

/** La caméra arrive sur la zone 250 ms avant son mot (schéma : 0,2 à 0,3 s). */
export const AVANCE_CAMERA_MS = Math.round(BORNES_CAMERA.avance * 1000);
const AVANCE_CAMERA_MIN_MS = Math.round(BORNES_CAMERA.avanceMin * 1000);
/** Aucun zoom dans les 400 premières ms : le spectateur se repère. */
export const SANS_ZOOM_DEBUT_MS = 400;
/** Retour à 1 entre deux zones éloignées de plus de 0,6 écran, quand l'écart entre leurs mots dépasse 1,2 s. */
export const RESPIRATION_DISTANCE_ECRAN = 0.6;
export const RESPIRATION_ECART_MS = 1200;
/** La caméra quitte une zone 100 ms après le début de son mot (le clic a eu lieu). */
export const QUITTER_APRES_MOT_MS = 100;
/** Tenue longue sur la même zone : poussée lente. */
export const TENUE_LONGUE_MS = 2500;
const POUSSEE_PAR_SEC = 0.012;
const POUSSEE_MAX = 0.03;
/** Vitesse (écrans/s) : celle du schéma (Image → vidéo). */
export const VITESSE_MAX_ECRANS_S = BORNES_CAMERA.vitesseMax;
/** À-coup : accélération maximale de la caméra, écrans/s². */
export const ACCELERATION_MAX_ECRANS_S2 = 3;
/** Marge de sécurité sur la durée d'un mouvement (le pas de 20 ms arrondit toujours vers le haut). */
const SECURITE_DUREE = 1.1;
export const PAS_MESURE_MS = 20;
export const HAUT_SOUS_TITRES_DEFAUT_PCT = 72;

export const ARRIVEE_CURSEUR_MS = 150;
/** Pointe placée à côté du clic (2 % de la capture, vers le bas à droite) : le curseur ne cache jamais le mot dit. */
export const DECALAGE_POINTE_PCT = 2;
export const PRESSION_MS = 160;
export const ANNEAU_MS = 400;
/** Écart du point de contrôle de l'arc, en part de la longueur du trajet. */
const COURBURE_ARC = 0.1;
const DEPART_CURSEUR_PCT = { x: 85, y: 85 } as const;
const MARGE_CURSEUR_PCT = 2;

export const OPACITE_ASSOMBRI = 0.35;
export const ENTREE_PROJECTEUR_MS = 250;
export const SORTIE_PROJECTEUR_MS = 200;
export const DUREE_VOLET_MS = 500;

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

const borne = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const fini = (...n: number[]) => n.every((v) => Number.isFinite(v));

export function cranPermetCamera(cran: CranFilm | undefined): boolean {
  return cran !== "aucun";
}
export function cranPermetProjecteur(cran: CranFilm | undefined): boolean {
  return cran === undefined || cran === "equilibre" || cran === "dynamique";
}

function placementPage(nav: Pick<NavMotion, "largeur" | "hauteur">, f: FormatMotion): PagePlacee {
  const e = Math.min(f.largeur / nav.largeur, f.hauteur / nav.hauteur);
  const largeur = nav.largeur * e;
  const hauteur = nav.hauteur * e;
  return { x: (f.largeur - largeur) / 2, y: (f.hauteur - hauteur) / 2, largeur, hauteur };
}

const pagePctVersMonde = (page: PagePlacee, p: { x: number; y: number }) => ({ x: page.x + (p.x / 100) * page.largeur, y: page.y + (p.y / 100) * page.hauteur });
const mondeVersPagePct = (page: PagePlacee, p: { x: number; y: number }) => ({ x: ((p.x - page.x) / page.largeur) * 100, y: ((p.y - page.y) / page.hauteur) * 100 });

/** Centre de vue permis sur un axe : dans la page si la vue y tient, sinon centré sur la page. */
function centreDansPage(centre: number, vue: number, debutPage: number, taillePage: number): number {
  if (vue >= taillePage) return debutPage + taillePage / 2;
  return borne(centre, debutPage + vue / 2, debutPage + taillePage - vue / 2);
}

/** Monde (image de sortie avant caméra) → écran, pour une pose. */
export function mondeVersEcranPose(p: PoseCamera, f: FormatMotion, m: { x: number; y: number }): { x: number; y: number } {
  return { x: (m.x - p.cx) * p.zoom + f.largeur / 2, y: (m.y - p.cy) * p.zoom + f.hauteur / 2 };
}
function ecranVersMonde(p: PoseCamera, f: FormatMotion, e: { x: number; y: number }): { x: number; y: number } {
  return { x: (e.x - f.largeur / 2) / p.zoom + p.cx, y: (e.y - f.hauteur / 2) / p.zoom + p.cy };
}

/** Distance de deux poses, en « écrans » : déplacement du centre rapporté à la vue, et variation logarithmique du zoom. */
export function distanceVue(a: PoseCamera, b: PoseCamera, f: FormatMotion): number {
  const z = Math.max(a.zoom, b.zoom);
  return Math.hypot(((b.cx - a.cx) * z) / f.largeur, ((b.cy - a.cy) * z) / f.hauteur, Math.log(b.zoom / a.zoom));
}

/**
 * Progrès d'un mouvement : une montée douce (pente nulle aux deux bouts, `doux` du schéma) portant, pour sa part, la
 * courbe nommée de `courbes-camera` (accostage, travelling, poussée lente). Les courbes nommées seules (départ en expo)
 * ne tiennent pas 1,2 écran/s ni 3 écrans/s² sans des mouvements de plusieurs secondes ; mélangées ainsi, un déplacement
 * d'un demi-écran dure environ 1,3 s. Monotone, de 0 à 1, sans saut de vitesse au départ ni à l'arrivée.
 */
const PART_PROFIL: Record<NomProfilCamera, number> = { accostage: 0.1, travelling: 0.2, "poussee-lente": 0.2 };
function progresMouvement(nom: NomProfilCamera, u: number): number {
  const k = doux(borne(u, 0, 1));
  const m = PART_PROFIL[nom];
  return (1 - m) * k + m * profilCamera(nom, k);
}

/** Pic de vitesse et pic d'accélération du profil (dérivées du progrès sur [0, 1]), mesurés une fois. */
const PICS = (() => {
  const noms: NomProfilCamera[] = ["accostage", "travelling", "poussee-lente"];
  const sortie = {} as Record<NomProfilCamera, { v: number; a: number }>;
  const N = 2000;
  for (const nom of noms) {
    let v = 0;
    let a = 0;
    let prec = 0;
    let vPrec = 0;
    for (let k = 1; k <= N; k++) {
      const p = progresMouvement(nom, k / N);
      const vit = (p - prec) * N;
      v = Math.max(v, vit);
      if (k > 1) a = Math.max(a, Math.abs(vit - vPrec) * N);
      prec = p;
      vPrec = vit;
    }
    sortie[nom] = { v, a };
  }
  return sortie;
})();

/** Durée (ms, multiple du pas de mesure) d'un mouvement de `d` écrans : jamais plus vite que les bornes, 0 si immobile. */
export function dureeMouvementMs(d: number, nom: NomProfilCamera): number {
  if (!(d > 1e-4)) return 0;
  const parVitesse = (d * PICS[nom].v) / VITESSE_MAX_ECRANS_S;
  const parAcceleration = Math.sqrt((d * PICS[nom].a) / ACCELERATION_MAX_ECRANS_S2);
  const s = Math.max(parVitesse, parAcceleration) * SECURITE_DUREE;
  return Math.ceil((s * 1000) / PAS_MESURE_MS) * PAS_MESURE_MS;
}

/* ------------------------------------------------------------------ */
/* Pose de la caméra pour une zone                                      */
/* ------------------------------------------------------------------ */

interface Geo {
  f: FormatMotion;
  page: PagePlacee;
  hautST: number;
  /** Rang vertical (px) de la bande des sous-titres. */
  yST: number;
}

const reposDe = (f: FormatMotion): PoseCamera => ({ cx: f.largeur / 2, cy: f.hauteur / 2, zoom: 1 });

function centreZone(g: Geo, z: ZoneFilm): { x: number; y: number } {
  return pagePctVersMonde(g.page, { x: z.x + z.largeur / 2, y: z.y + z.hauteur / 2 });
}

/** Le plus grand zoom qui garde la zone ENTIÈRE, avec la marge du schéma, au-dessus des sous-titres ; borné à [1 ; 1,6]. */
function zoomQuiTient(g: Geo, z: ZoneFilm): { zoom: number; trop: boolean } {
  const m = MARGE_CADRE * g.f.largeur;
  const lz = (z.largeur / 100) * g.page.largeur;
  const hz = (z.hauteur / 100) * g.page.hauteur;
  const libre = Math.min((g.f.largeur - 2 * m) / lz, (g.yST - 2 * m) / hz);
  const max = Math.min(ECHELLE_MAX, BORNES_CAMERA.zoomMax);
  return { zoom: borne(libre, ECHELLE_MIN, max), trop: libre < ECHELLE_MIN - 1e-9 };
}

/** Pose qui amène le centre de la zone au milieu de l'espace libre au-dessus des sous-titres, sans sortir de la page. */
function poseDeZone(g: Geo, z: ZoneFilm, zoom: number): PoseCamera {
  const c = centreZone(g, z);
  const cible = { x: g.f.largeur / 2, y: g.yST / 2 };
  const cx = c.x - (cible.x - g.f.largeur / 2) / zoom;
  const cy = c.y - (cible.y - g.f.hauteur / 2) / zoom;
  return {
    zoom,
    cx: centreDansPage(cx, g.f.largeur / zoom, g.page.x, g.page.largeur),
    cy: centreDansPage(cy, g.f.hauteur / zoom, g.page.y, g.page.hauteur),
  };
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

interface Visite {
  zone: ZoneFilm;
  etapeId: string;
  debutMs: number;
  finMs: number;
  poseArrivee: PoseCamera;
  poseFin: PoseCamera;
  poussee: { debutMs: number; finMs: number } | null;
}

const memeZone = (a: ZoneFilm, b: ZoneFilm) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.largeur - b.largeur) < 1e-9 && Math.abs(a.hauteur - b.hauteur) < 1e-9;

function planVide(g: Geo, alertes: string[]): PlanMotionFilm {
  return { camera: [{ tMs: 0, ...reposDe(g.f), profil: "travelling" }], curseur: [], clics: [], projecteurs: [], volets: [], alertes, geometrie: { format: g.f, page: g.page, hautSousTitresPct: g.hautST } };
}

let derniere: { cle: string; plan: PlanMotionFilm } | null = null;

/** Calcule (et retient le dernier calcul : le rendu relit le même plan à chaque image). */
export function planMotionFilm(nav: NavMotion, format: FormatMotion): PlanMotionFilm {
  let cle = "";
  try {
    cle = JSON.stringify([nav.largeur, nav.hauteur, nav.cran ?? null, nav.hautSousTitresPct ?? null, nav.basculeMs ?? null, format.largeur, format.hauteur, nav.cibles.map((c) => [c.etapeId, c.zonePct ?? null, c.instantMs, c.finMs])]);
  } catch {
    cle = "";
  }
  if (cle && derniere && derniere.cle === cle) return derniere.plan;
  const plan = calculer(nav, format);
  if (cle) derniere = { cle, plan };
  return plan;
}

function calculer(nav: NavMotion, format: FormatMotion): PlanMotionFilm {
  const hautST = nav.hautSousTitresPct !== undefined && fini(nav.hautSousTitresPct) && nav.hautSousTitresPct > 0 && nav.hautSousTitresPct <= 100 ? nav.hautSousTitresPct : HAUT_SOUS_TITRES_DEFAUT_PCT;
  const sain = fini(nav.largeur, nav.hauteur, format.largeur, format.hauteur) && nav.largeur > 0 && nav.hauteur > 0 && format.largeur > 0 && format.hauteur > 0;
  const f: FormatMotion = sain ? format : { largeur: 1080, hauteur: 1350 };
  const g: Geo = { f, page: placementPage(sain ? nav : { largeur: 1080, hauteur: 1350 }, f), hautST, yST: (hautST / 100) * f.hauteur };
  if (!sain || !Array.isArray(nav.cibles)) return planVide(g, ["Le film ou le format est illisible : aucun mouvement n'est calculé."]);

  const cibles = nav.cibles.filter((c) => c.zonePct && fini(c.instantMs, c.finMs, c.zonePct.x, c.zonePct.y, c.zonePct.largeur, c.zonePct.hauteur) && c.zonePct.largeur > 0 && c.zonePct.hauteur > 0).sort((a, b) => a.instantMs - b.instantMs);
  const alertes: string[] = [];
  if (cibles.length === 0) return planVide(g, alertes);

  const cran = nav.cran;
  const avecCamera = cranPermetCamera(cran);
  const avecProjecteur = cranPermetProjecteur(cran);

  /* --- Visites : cibles consécutives sur la même zone = une seule tenue de la caméra --- */
  const groupes: { zone: ZoneFilm; cibles: CibleMotion[] }[] = [];
  for (const c of cibles) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && memeZone(dernier.zone, c.zonePct!)) dernier.cibles.push(c);
    else groupes.push({ zone: c.zonePct!, cibles: [c] });
  }

  const visites: Visite[] = groupes.map((gr) => {
    const debutMs = gr.cibles[0]!.instantMs;
    const finMs = Math.max(...gr.cibles.map((c) => c.finMs));
    const { zoom, trop } = zoomQuiTient(g, gr.zone);
    if (trop) alertes.push(`La zone de « ${gr.cibles[0]!.etapeId} » est plus grande que l'espace libre au-dessus des sous-titres : elle n'est pas zoomée.`);
    const poseFin = poseDeZone(g, gr.zone, avecCamera ? zoom : 1);
    return { zone: gr.zone, etapeId: gr.cibles[0]!.etapeId, debutMs, finMs, poseArrivee: poseFin, poseFin, poussee: null };
  });

  /* --- Caméra --- */
  const camera: ImageCleCamera[] = [{ tMs: 0, ...reposDe(f), profil: "travelling" }];
  if (avecCamera) {
    const repos = reposDe(f);
    let courant: PoseCamera = repos;
    let tLibre = 0;
    const poser = (tMs: number, pose: PoseCamera, profil: NomProfilCamera) => {
      const dernier = camera[camera.length - 1]!;
      if (dernier.tMs === tMs && Math.abs(dernier.zoom - pose.zoom) < 1e-9 && Math.abs(dernier.cx - pose.cx) < 1e-9 && Math.abs(dernier.cy - pose.cy) < 1e-9) return;
      camera.push({ tMs, cx: pose.cx, cy: pose.cy, zoom: pose.zoom, profil });
    };
    const profilVers = (vers: PoseCamera): NomProfilCamera => (vers.zoom > courant.zoom + 0.02 ? "accostage" : "travelling");
    /** Mouvement dont l'arrivée est voulue à `arrivee` : part plus tôt si la vitesse l'exige, jamais plus vite. */
    const aller = (vers: PoseCamera, arrivee: number, departMin: number, profil: NomProfilCamera, motMs: number | null, etapeId: string) => {
      const D = dureeMouvementMs(distanceVue(courant, vers, f), profil);
      if (D === 0) {
        courant = vers;
        return;
      }
      const depart = Math.max(arrivee - D, departMin, tLibre);
      const fin = depart + D;
      if (motMs !== null && fin > motMs - AVANCE_CAMERA_MIN_MS) alertes.push(`La caméra arrive ${Math.round(fin - (motMs - AVANCE_CAMERA_MS))} ms trop tard sur « ${etapeId} » : les mots sont trop serrés pour la vitesse permise.`);
      poser(depart, courant, camera[camera.length - 1]!.profil);
      poser(fin, vers, profil);
      courant = vers;
      tLibre = fin;
    };
    const allerSur = (vers: PoseCamera, debut: number, fin: number, profil: NomProfilCamera) => {
      poser(Math.max(debut, tLibre), courant, camera[camera.length - 1]!.profil);
      poser(fin, vers, profil);
      courant = vers;
      tLibre = fin;
    };

    // Poussée lente sur une tenue longue : arrivée un peu en retrait, puis approche douce jusqu'à la pose pleine.
    visites.forEach((v, i) => {
      const tenue = v.finMs - v.debutMs;
      if (tenue <= TENUE_LONGUE_MS || v.poseFin.zoom <= ECHELLE_MIN + 0.02) return;
      const debutPoussee = v.debutMs + 300;
      const suivante = visites[i + 1];
      const departSuivant = suivante ? suivante.debutMs - AVANCE_CAMERA_MS - dureeMouvementMs(distanceVue(v.poseFin, suivante.poseFin, f), "accostage") : v.finMs;
      const finPoussee = Math.min(v.finMs - SORTIE_PROJECTEUR_MS, departSuivant);
      if (finPoussee - debutPoussee < 800) return;
      const part = Math.min(POUSSEE_MAX, (POUSSEE_PAR_SEC * (finPoussee - debutPoussee)) / 1000);
      const zoomArrivee = Math.max(ECHELLE_MIN, v.poseFin.zoom * (1 - part));
      v.poseArrivee = poseDeZone(g, v.zone, zoomArrivee);
      v.poussee = { debutMs: debutPoussee, finMs: finPoussee };
    });

    visites.forEach((v, i) => {
      const arrivee = v.debutMs - AVANCE_CAMERA_MS;
      const precedente = visites[i - 1];
      // La caméra ne quitte jamais une zone avant d'avoir laissé dire son mot : s'il manque du temps, elle arrive plus tard (alerte).
      let departMin = i === 0 ? SANS_ZOOM_DEBUT_MS : Math.max(tLibre, precedente!.debutMs + QUITTER_APRES_MOT_MS);
      if (precedente) {
        const a = centreZone(g, precedente.zone);
        const b = centreZone(g, v.zone);
        const loin = Math.hypot((b.x - a.x) / f.largeur, (b.y - a.y) / f.hauteur) > RESPIRATION_DISTANCE_ECRAN;
        const ecart = v.debutMs - precedente.debutMs;
        if (loin && ecart > RESPIRATION_ECART_MS) {
          const retour = dureeMouvementMs(distanceVue(courant, repos, f), "travelling");
          const aller1 = dureeMouvementMs(distanceVue(repos, v.poseArrivee, f), v.poseArrivee.zoom > 1.02 ? "accostage" : "travelling");
          const quitter = Math.max(tLibre, precedente.debutMs + QUITTER_APRES_MOT_MS);
          if (quitter + retour <= arrivee - aller1) {
            aller(repos, quitter + retour, quitter, "travelling", null, v.etapeId);
            departMin = tLibre;
          }
        }
      }
      aller(v.poseArrivee, arrivee, departMin, profilVers(v.poseArrivee), v.debutMs, v.etapeId);
      if (v.poussee) allerSur(v.poseFin, v.poussee.debutMs, v.poussee.finMs, "poussee-lente");
    });
    const dernier = visites[visites.length - 1]!;
    const quitter = Math.max(tLibre, dernier.finMs);
    const retour = dureeMouvementMs(distanceVue(courant, repos, f), "travelling");
    if (retour > 0) allerSur(repos, quitter, quitter + retour, "travelling");
  }

  /* --- Zone sous les sous-titres, même après le meilleur cadrage --- */
  if (avecCamera) {
    for (const c of cibles) {
      const v = visites.find((x) => memeZone(x.zone, c.zonePct!));
      if (!v) continue;
      const z = c.zonePct!;
      const bas = mondeVersEcranPose(v.poseFin, f, pagePctVersMonde(g.page, { x: z.x, y: z.y + z.hauteur })).y;
      if (bas > g.yST + 1 && !alertes.some((a) => a.includes(`« ${c.etapeId} » passe sous`))) alertes.push(`La zone de « ${c.etapeId} » passe sous les sous-titres : la page ne peut pas être remontée davantage.`);
    }
  }

  const plan: PlanMotionFilm = { camera, curseur: [], clics: [], projecteurs: [], volets: [], alertes, geometrie: { format: f, page: g.page, hautSousTitresPct: hautST } };

  /* --- Projecteurs : jamais deux en même temps --- */
  if (avecProjecteur) {
    const brut = visites.map((v) => ({ debutMs: Math.max(0, v.debutMs - ENTREE_PROJECTEUR_MS), finMs: v.finMs, zone: v.zone }));
    for (let i = 0; i < brut.length; i++) {
      const suivant = brut[i + 1];
      const fin = suivant ? Math.min(brut[i]!.finMs, suivant.debutMs) : brut[i]!.finMs;
      if (fin - brut[i]!.debutMs >= ENTREE_PROJECTEUR_MS) plan.projecteurs.push({ debutMs: brut[i]!.debutMs, finMs: fin, zone: brut[i]!.zone });
    }
    if (typeof nav.basculeMs === "number" && fini(nav.basculeMs) && nav.basculeMs >= 0) plan.volets.push({ tMs: nav.basculeMs, dureeMs: DUREE_VOLET_MS });
  }

  /* --- Curseur --- */
  planifierCurseur(plan, g, cibles, Math.max(...nav.cibles.filter((c) => fini(c.finMs)).map((c) => c.finMs)));
  return plan;
}

/** `finMs` : fin de la dernière cible (avec ou sans zone) ; le curseur reste à l'écran jusque-là. */
function planifierCurseur(plan: PlanMotionFilm, g: Geo, cibles: CibleMotion[], finMs: number): void {
  const { page } = g;
  // Clic sur le mot : pointe à côté du centre de la zone (jamais sur le chiffre dit), dans la zone.
  const clics: Clic[] = cibles.map((c) => {
    const z = c.zonePct!;
    const x = Math.min(z.x + z.largeur / 2 + DECALAGE_POINTE_PCT, z.x + z.largeur - 0.1);
    const y = Math.min(z.y + z.hauteur / 2 + DECALAGE_POINTE_PCT, z.y + z.hauteur - 0.1);
    return { tMs: c.instantMs, x, y };
  });
  plan.clics = clics;

  interface Segment {
    debut: number;
    fin: number;
    p: [PointPct, PointPct, PointPct, PointPct];
  }
  const segments: Segment[] = [];
  let depart = DEPART_CURSEUR_PCT as { x: number; y: number };
  let libre = 0;
  clics.forEach((cl, j) => {
    const de = pagePctVersMonde(page, depart);
    const vers = pagePctVersMonde(page, cl);
    const longueur = Math.hypot(vers.x - de.x, vers.y - de.y);
    const arrivee = cl.tMs - ARRIVEE_CURSEUR_MS;
    const ideal = borne(350 + 700 * (longueur / g.f.largeur), 350, 900);
    const debut = Math.max(libre, arrivee - ideal);
    let fin = arrivee;
    if (fin - debut < 60) {
      fin = debut + 60;
      plan.alertes.push(`Le curseur n'a pas le temps d'arriver avant le clic de « ${cibles[j]!.etapeId} » : les mots sont trop serrés.`);
    }
    const sens = j % 2 === 0 ? 1 : -1;
    const dx = vers.x - de.x;
    const dy = vers.y - de.y;
    const n = longueur > 1e-9 ? { x: (-dy / longueur) * COURBURE_ARC * longueur * sens, y: (dx / longueur) * COURBURE_ARC * longueur * sens } : { x: 0, y: 0 };
    const pt = (k: number): PointPct => ({ x: de.x + dx * k + n.x, y: de.y + dy * k + n.y });
    segments.push({ debut, fin, p: [{ x: de.x, y: de.y }, pt(1 / 3), pt(2 / 3), { x: vers.x, y: vers.y }] });
    depart = cl;
    libre = cl.tMs + PRESSION_MS;
  });
  if (segments.length === 0) return;

  const brut = (t: number): { x: number; y: number } => {
    let pos = pagePctVersMonde(page, DEPART_CURSEUR_PCT);
    for (const s of segments) {
      if (t < s.debut) return pos;
      if (t <= s.fin) {
        const u = (t - s.debut) / Math.max(1, s.fin - s.debut);
        return trajetSurCourbe(s.p, progres(u, 0, 1, "anticipation"));
      }
      pos = s.p[3];
    }
    return pos;
  };

  const debutT = segments[0]!.debut;
  const finT = Math.max(finMs, clics[clics.length - 1]!.tMs + PRESSION_MS);
  const marge = (MARGE_CURSEUR_PCT / 100) * g.f.largeur;
  const instants: number[] = [];
  for (let t = debutT; t < finT; t += PAS_MESURE_MS) instants.push(t);
  instants.push(finT);
  for (const t of instants) {
    const m = brut(t);
    // Jamais hors du cadre de la caméra : si la caméra n'a pas encore rejoint (ou a déjà quitté) le curseur, il reste au bord.
    const pose = poseA(plan, t);
    const e = mondeVersEcranPose(pose, g.f, m);
    const ex = borne(e.x, marge, g.f.largeur - marge);
    const ey = borne(e.y, marge, g.f.hauteur - marge);
    const mm = ex === e.x && ey === e.y ? m : ecranVersMonde(pose, g.f, { x: ex, y: ey });
    const p = mondeVersPagePct(page, mm);
    plan.curseur.push({ tMs: t, x: p.x, y: p.y });
  }
}

/* ------------------------------------------------------------------ */
/* Lecture pour le rendu                                               */
/* ------------------------------------------------------------------ */

/** Pose de la caméra à l'instant `tMs`. */
export function poseA(plan: PlanMotionFilm, tMs: number): PoseCamera {
  const k = plan.camera;
  const premier = k[0]!;
  if (!(tMs > premier.tMs)) return { cx: premier.cx, cy: premier.cy, zoom: premier.zoom };
  let i = 0;
  while (i + 1 < k.length && k[i + 1]!.tMs <= tMs) i++;
  const a = k[i]!;
  const b = k[i + 1];
  if (!b) return { cx: a.cx, cy: a.cy, zoom: a.zoom };
  const u = (tMs - a.tMs) / Math.max(1, b.tMs - a.tMs);
  const p = progresMouvement(b.profil, u);
  return { cx: a.cx + (b.cx - a.cx) * p, cy: a.cy + (b.cy - a.cy) * p, zoom: a.zoom + (b.zoom - a.zoom) * p };
}

/** Le volet est-il à l'écran à cet instant ? Avancement 0 → 1 (courbe `glisse`), sinon `null`. */
export function voletA(plan: PlanMotionFilm, tMs: number): { progres: number } | null {
  for (const v of plan.volets) {
    if (tMs >= v.tMs && tMs <= v.tMs + v.dureeMs) return { progres: progres(tMs / 1000, v.tMs / 1000, v.dureeMs / 1000, "glisse") };
  }
  return null;
}

/** Position du curseur (en % de la capture) ; `null` avant son départ, après la fin, et pendant un volet. */
export function curseurA(plan: PlanMotionFilm, tMs: number): { x: number; y: number } | null {
  const c = plan.curseur;
  if (c.length === 0) return null;
  const premier = c[0]!;
  const dernier = c[c.length - 1]!;
  if (tMs < premier.tMs || tMs > dernier.tMs) return null;
  if (voletA(plan, tMs)) return null;
  const idx = Math.min(c.length - 1, Math.floor((tMs - premier.tMs) / PAS_MESURE_MS));
  const a = c[idx]!;
  const b = c[idx + 1];
  if (!b || b.tMs <= a.tMs) return { x: a.x, y: a.y };
  const k = (tMs - a.tMs) / (b.tMs - a.tMs);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** Pression du clic (0 → 1 → 0 sur 160 ms) et avancement de l'anneau (0 = aucun ; sinon 0 → 1 sur 400 ms). */
export function clicA(plan: PlanMotionFilm, tMs: number): { pression: number; anneau: number } {
  let pression = 0;
  let anneau = 0;
  for (const c of plan.clics) {
    const p = (tMs - c.tMs) / PRESSION_MS;
    if (p > 0 && p < 1) pression = Math.max(pression, Math.sin(Math.PI * p));
    const q = (tMs - c.tMs) / ANNEAU_MS;
    if (q > 0 && q < 1) anneau = Math.max(anneau, q);
  }
  return { pression, anneau };
}

/** Projecteur à l'instant `tMs` : la zone éclairée et l'intensité (0 → 1 : entrée 250 ms, sortie 200 ms) ; sinon `null`. */
export function projecteurA(plan: PlanMotionFilm, tMs: number): { zone: ZoneFilm; opacite: number } | null {
  for (const p of plan.projecteurs) {
    if (tMs < p.debutMs || tMs > p.finMs) continue;
    const entree = progres(tMs / 1000, p.debutMs / 1000, ENTREE_PROJECTEUR_MS / 1000, "signature");
    const sortie = 1 - progres(tMs / 1000, (p.finMs - SORTIE_PROJECTEUR_MS) / 1000, SORTIE_PROJECTEUR_MS / 1000, "douce");
    const opacite = Math.min(entree, sortie);
    return opacite > 0 ? { zone: p.zone, opacite } : null;
  }
  return null;
}

/** Haut de la bande des sous-titres (% de la hauteur) depuis le centre de la ligne basse (`positions.basPct`) : demi-bande de 7 %. */
export function hautBandeSousTitresPct(basPct: number): number | undefined {
  if (!fini(basPct) || basPct <= 0 || basPct > 100) return undefined;
  return Math.max(30, basPct - 7);
}
