/**
 * FILM DE NAVIGATION (T-EXT-38) — géométrie et lecture PURES, sans React ni import `@/…` : lu tel quel par le rendu
 * (`studio-rendu/compositions/plan-scenes/NavigationFilmee.tsx`) et par la chaîne du tutoriel. Ne lève jamais.
 * Contrat d'entrée : `navigation-filmee.v1` (T-EXT-03). Tous les instants sont sur l'horloge de la voix, en ms.
 * Le film est posé SANS rognage dans l'image de sortie ; la caméra (zoom), le curseur et la surbrillance sont calculés
 * ici, jamais dessinés ici.
 */
import type { PlanValide } from "../schema";
import { cadreDansEcran, type RectanglePx } from "./cadre-zone";
import { ECHELLE_MAX, OPACITE_ASSOMBRI, clicA, cranPermetProjecteur, curseurA as curseurDuPlan, planMotionFilm, poseA, projecteurA as projecteurDuPlan, voletA as voletDuPlan, type CranFilm } from "./motion-film";

export const VERSION_NAVIGATION = "navigation-filmee.v1" as const;

/** Provenance : `ETAPES_MAX` de G5-01 (`src/moteurs/montage-tutoriel-outil/etapes-tutoriel.ts`), recopié (pas d'import du moteur). */
export const CIBLES_MAX = 9;

// Valeurs revues avec will-dc par T-EXT-44 : le calcul du mouvement est dans `motion-film.ts` (pur, sans IA).
/** Borne du zoom : celle des courbes de caméra communes (≤ `FACTEUR_ZOOM_MAX` = 2,5 de `montage-demo-facecam/mise-en-page.ts`). */
export const ZOOM_NAVIGATION_MAX = ECHELLE_MAX;
/** Règle de Williams (AUDIT-COMPLET-18-11 § 2 bis) : jamais plus de 1,5 s d'image fixe. */
export const SEUIL_IMAGE_FIXE_MS = 1500;
/** Opacité du noir qui assombrit le reste de l'écran pendant qu'une zone est éclairée. */
export const OPACITE_PROJECTEUR = OPACITE_ASSOMBRI;

const PAS_MESURE_MS = 20;

export interface ZonePct {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface CibleFilmee {
  etapeId: string;
  zonePct?: ZonePct;
  instantMs: number;
  finMs: number;
}

export interface NavigationFilmee {
  version: typeof VERSION_NAVIGATION;
  /** Clé R2 du film : `.mp4` (T-EXT-03b) ou `.webm` (films anciens de T-EXT-03). */
  videoCle: string;
  maquette: string;
  /** Taille de la page en px CSS. */
  largeur: number;
  hauteur: number;
  /** Instant du film où la voix commence. */
  debutFilmMs: number;
  dureeVoixMs: number;
  cibles: CibleFilmee[];
  /** Écran source immobile (horloge de la voix). Absent = non mesuré. */
  figees?: { debutMs: number; finMs: number }[];
  /** T-EXT-44 : cran du dosage de motion (absent : « équilibré »). */
  cran?: CranFilm;
  /** T-EXT-44 : haut de la bande des sous-titres, en % de la hauteur de l'image (absent : 72). */
  hautSousTitresPct?: number;
  /** T-EXT-44 : début de la scène « maintenant » ; un volet sans texte traverse l'écran (absent : aucun volet). */
  basculeMs?: number;
}

export interface FormatSortie {
  largeur: number;
  hauteur: number;
}

export type ResultatNavigation = { ok: true; navigation: NavigationFilmee } | { ok: false; erreurs: string[] };

const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Lecture stricte : liste toutes les erreurs, ne lève jamais. */
export function lireNavigationFilmee(brut: unknown): ResultatNavigation {
  if (!objet(brut)) return { ok: false, erreurs: ["La navigation filmée n'est pas un objet."] };
  const erreurs: string[] = [];
  if (brut.version !== VERSION_NAVIGATION) erreurs.push(`Version inconnue (attendu ${VERSION_NAVIGATION}).`);
  const cle = typeof brut.videoCle === "string" ? brut.videoCle.trim() : "";
  if (!/\.(mp4|webm)$/i.test(cle)) erreurs.push("La clé du film doit finir par .mp4 ou .webm.");
  if (typeof brut.maquette !== "string" || !brut.maquette.trim()) erreurs.push("La maquette est absente.");
  if (!nombre(brut.largeur) || brut.largeur <= 0) erreurs.push("La largeur de la page est invalide.");
  if (!nombre(brut.hauteur) || brut.hauteur <= 0) erreurs.push("La hauteur de la page est invalide.");
  if (!nombre(brut.debutFilmMs) || brut.debutFilmMs < 0) erreurs.push("Le début du film est invalide.");
  if (!nombre(brut.dureeVoixMs) || brut.dureeVoixMs <= 0) erreurs.push("La durée de la voix est invalide.");
  const dureeVoix = nombre(brut.dureeVoixMs) ? brut.dureeVoixMs : 0;

  const cibles: CibleFilmee[] = [];
  if (!Array.isArray(brut.cibles) || brut.cibles.length < 1 || brut.cibles.length > CIBLES_MAX) {
    erreurs.push(`Il faut de 1 à ${CIBLES_MAX} cibles.`);
  } else {
    let precedent = -Infinity;
    brut.cibles.forEach((c: unknown, i: number) => {
      const nom = `Cible ${i + 1}`;
      if (!objet(c)) return void erreurs.push(`${nom} : illisible.`);
      if (typeof c.etapeId !== "string" || !c.etapeId.trim()) erreurs.push(`${nom} : étape absente.`);
      if (!nombre(c.instantMs) || !nombre(c.finMs)) return void erreurs.push(`${nom} : instants invalides.`);
      if (c.instantMs < 0 || c.instantMs <= precedent) erreurs.push(`${nom} : les instants doivent croître.`);
      if (c.instantMs >= c.finMs) erreurs.push(`${nom} : la fin doit suivre le clic.`);
      if (c.finMs > dureeVoix + 1000) erreurs.push(`${nom} : la fin dépasse la voix de plus d'une seconde.`);
      precedent = c.instantMs;
      let zonePct: ZonePct | undefined;
      if (c.zonePct !== undefined) {
        const z = c.zonePct;
        const dans = (n: unknown): n is number => nombre(n) && n >= 0 && n <= 100;
        if (!objet(z) || !dans(z.x) || !dans(z.y) || !dans(z.largeur) || !dans(z.hauteur) || z.largeur <= 0 || z.hauteur <= 0 || z.x + z.largeur > 100 || z.y + z.hauteur > 100) erreurs.push(`${nom} : zone hors de 0 à 100 %.`);
        else zonePct = { x: z.x, y: z.y, largeur: z.largeur, hauteur: z.hauteur };
      }
      cibles.push({ etapeId: String(c.etapeId ?? ""), ...(zonePct ? { zonePct } : {}), instantMs: c.instantMs, finMs: c.finMs });
    });
  }

  let figees: { debutMs: number; finMs: number }[] | undefined;
  if (brut.figees !== undefined) {
    const f = brut.figees;
    if (!Array.isArray(f) || f.some((p) => !objet(p) || !nombre(p.debutMs) || !nombre(p.finMs) || p.debutMs < 0 || p.finMs <= p.debutMs)) erreurs.push("Les plages figées sont invalides.");
    else figees = f.map((p) => ({ debutMs: (p as { debutMs: number }).debutMs, finMs: (p as { finMs: number }).finMs }));
  }
  if (erreurs.length) return { ok: false, erreurs };
  return {
    ok: true,
    navigation: {
      version: VERSION_NAVIGATION,
      videoCle: cle,
      maquette: String(brut.maquette).trim(),
      largeur: brut.largeur as number,
      hauteur: brut.hauteur as number,
      debutFilmMs: brut.debutFilmMs as number,
      dureeVoixMs: dureeVoix,
      cibles,
      ...(figees ? { figees } : {}),
    },
  };
}

/** Le film tient dans l'image de sortie sans rognage : contenu, centré (fond ivoire autour). */
export function placementFilm(nav: Pick<NavigationFilmee, "largeur" | "hauteur">, format: FormatSortie): RectanglePx & { echelle: number } {
  const echelle = Math.min(format.largeur / nav.largeur, format.hauteur / nav.hauteur);
  const largeur = nav.largeur * echelle;
  const hauteur = nav.hauteur * echelle;
  return { x: (format.largeur - largeur) / 2, y: (format.hauteur - hauteur) / 2, largeur, hauteur, echelle };
}

/** Courbe douce : 0 → 1, pente nulle aux deux bouts. */
export function easeInOut(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return t * t * (3 - 2 * t);
}

export interface Camera {
  echelle: number;
  origineXPct: number;
  origineYPct: number;
}

/** Caméra à l'instant `tMs` : échelle et origine (en % de l'image de sortie) pour `transform: scale()`. */
export function cameraA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Camera {
  const pose = poseA(planMotionFilm(nav, format), tMs);
  if (pose.zoom - 1 < 1e-6) return { echelle: 1, origineXPct: 50, origineYPct: 50 };
  // Le point de la vue en haut à gauche (vx, vy) doit arriver en (0, 0) : O (1 − 1/s) = v.
  const vx = pose.cx - format.largeur / pose.zoom / 2;
  const vy = pose.cy - format.hauteur / pose.zoom / 2;
  const k = pose.zoom / (pose.zoom - 1);
  return { echelle: pose.zoom, origineXPct: ((vx * k) / format.largeur) * 100, origineYPct: ((vy * k) / format.hauteur) * 100 };
}

/** Un point de l'image de sortie (avant caméra) → son point à l'écran, après caméra. */
export function versEcran(cam: Camera, format: FormatSortie, p: { x: number; y: number }): { x: number; y: number } {
  const ox = (cam.origineXPct / 100) * format.largeur;
  const oy = (cam.origineYPct / 100) * format.hauteur;
  return { x: ox + cam.echelle * (p.x - ox), y: oy + cam.echelle * (p.y - oy) };
}

export interface Curseur {
  xPx: number;
  yPx: number;
  /** 0 à 1 : pression du clic (160 ms). */
  clic: number;
  /** 0 = pas d'anneau ; sinon avancement (0 à 1, 400 ms) de l'anneau qui s'efface. */
  anneau: number;
}

/** Curseur à l'instant `tMs`, après la caméra ; `null` avant son départ, après la dernière cible et pendant un volet. */
export function curseurA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Curseur | null {
  const plan = planMotionFilm(nav, format);
  const p = curseurDuPlan(plan, tMs);
  if (!p) return null;
  const place = placementFilm(nav, format);
  const e = versEcran(cameraA(nav, tMs, format), format, { x: place.x + (p.x / 100) * place.largeur, y: place.y + (p.y / 100) * place.hauteur });
  const c = clicA(plan, tMs);
  return { xPx: e.x, yPx: e.y, clic: c.pression, anneau: c.anneau };
}

export interface Surbrillance extends RectanglePx {
  epaisseur: number;
  /** 0 à 1 : entrée en 250 ms, sortie en 200 ms. */
  opacite: number;
}

/** Zone éclairée (le reste de l'écran s'assombrit : `OPACITE_PROJECTEUR` × `opacite`) avec son cadre, après la caméra ; sinon `null`. */
export function projecteurA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Surbrillance | null {
  if (!cranPermetProjecteur(nav.cran)) return null;
  const pr = projecteurDuPlan(planMotionFilm(nav, format), tMs);
  if (!pr) return null;
  const cadre = cadreDansEcran(pr.zone, placementFilm(nav, format));
  if (!cadre) return null;
  const cam = cameraA(nav, tMs, format);
  const a = versEcran(cam, format, { x: cadre.x, y: cadre.y });
  const b = versEcran(cam, format, { x: cadre.x + cadre.largeur, y: cadre.y + cadre.hauteur });
  return { x: a.x, y: a.y, largeur: b.x - a.x, hauteur: b.y - a.y, epaisseur: cadre.epaisseur, opacite: pr.opacite };
}

/** Cadre de la zone active : le projecteur (même fonction, même signature qu'en T-EXT-38). */
export const surbrillanceA = projecteurA;

export interface Volet {
  /** Bord arrière et bord d'attaque du volet (px, de gauche à droite) : il couvre [arriereXPx, avantXPx]. Aucun texte. */
  arriereXPx: number;
  avantXPx: number;
  /** Largeur du filet qui borde le bord d'attaque. */
  filetPx: number;
}

/** Volet « avant → maintenant » : un panneau ivoire, bordé d'un filet terracotta, traverse l'écran en 500 ms ; sinon `null`. */
export function voletA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Volet | null {
  if (!cranPermetProjecteur(nav.cran)) return null;
  const v = voletDuPlan(planMotionFilm(nav, format), tMs);
  if (!v) return null;
  const arriere = -format.largeur + 2 * format.largeur * v.progres;
  return { arriereXPx: arriere, avantXPx: arriere + format.largeur, filetPx: Math.max(4, Math.round(format.largeur / 180)) };
}

const FORMAT_REFERENCE: FormatSortie = { largeur: 1080, hauteur: 1350 };

/**
 * Intervalles ≥ 1,5 s où, à la fois, la source est figée, la caméra est immobile et le curseur est immobile.
 * `figees` absent : `null` (non mesuré, jamais deviné). Format de référence : 4:5 (format maître).
 */
export function plagesFixesSortie(nav: NavigationFilmee, format: FormatSortie = FORMAT_REFERENCE): { debutMs: number; finMs: number }[] | null {
  const figees = nav.figees;
  if (!figees) return null;
  const sorties: { debutMs: number; finMs: number }[] = [];
  const fin = Math.max(nav.dureeVoixMs, ...nav.cibles.map((c) => c.finMs));
  let debut: number | null = null;
  const clore = (t: number) => {
    if (debut !== null && t - debut >= SEUIL_IMAGE_FIXE_MS) sorties.push({ debutMs: debut, finMs: t });
    debut = null;
  };
  for (let t = 0; t < fin; t += PAS_MESURE_MS) {
    const suivant = t + PAS_MESURE_MS;
    const figee = figees.some((f) => t >= f.debutMs && suivant <= f.finMs);
    const c0 = cameraA(nav, t, format);
    const c1 = cameraA(nav, suivant, format);
    const camImmobile = Math.abs(c0.echelle - c1.echelle) < 1e-6 && Math.abs(c0.origineXPct - c1.origineXPct) < 1e-6 && Math.abs(c0.origineYPct - c1.origineYPct) < 1e-6;
    const k0 = curseurA(nav, t, format);
    const k1 = curseurA(nav, suivant, format);
    const curImmobile = (!k0 && !k1) || (!!k0 && !!k1 && Math.abs(k0.xPx - k1.xPx) < 1e-3 && Math.abs(k0.yPx - k1.yPx) < 1e-3 && k0.clic === 0 && k1.clic === 0 && k0.anneau === 0 && k1.anneau === 0);
    if (figee && camImmobile && curImmobile) debut ??= t;
    else clore(t);
  }
  clore(fin);
  return sorties;
}

/** Ids des scènes « plein » du plan qui recouvrent un intervalle [clic, fin] d'une cible (elles cachent le film). */
export function planCacheLeFilm(plan: Pick<PlanValide, "scenes">, nav: Pick<NavigationFilmee, "cibles">): string[] {
  return plan.scenes.filter((s) => s.position === "plein" && nav.cibles.some((c) => s.debutMs < c.finMs && s.finMs > c.instantMs)).map((s) => s.id);
}
