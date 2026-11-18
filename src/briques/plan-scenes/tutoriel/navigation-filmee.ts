/**
 * FILM DE NAVIGATION (T-EXT-38) — géométrie et lecture PURES, sans React ni import `@/…` : lu tel quel par le rendu
 * (`studio-rendu/compositions/plan-scenes/NavigationFilmee.tsx`) et par la chaîne du tutoriel. Ne lève jamais.
 * Contrat d'entrée : `navigation-filmee.v1` (T-EXT-03). Tous les instants sont sur l'horloge de la voix, en ms.
 * Le film est posé SANS rognage dans l'image de sortie ; la caméra (zoom), le curseur et la surbrillance sont calculés
 * ici, jamais dessinés ici.
 */
import type { PlanValide } from "../schema";
import { cadreDansEcran, type RectanglePx } from "./cadre-zone";

export const VERSION_NAVIGATION = "navigation-filmee.v1" as const;

/** Provenance : `ETAPES_MAX` de G5-01 (`src/moteurs/montage-tutoriel-outil/etapes-tutoriel.ts`), recopié (pas d'import du moteur). */
export const CIBLES_MAX = 9;

// Valeurs de départ, revues avec will-dc par T-EXT-44.
/** Borne du zoom (≤ `FACTEUR_ZOOM_MAX` = 2,5 de `montage-demo-facecam/mise-en-page.ts`). */
export const ZOOM_NAVIGATION_MAX = 1.6;
/** La zone occupe au plus 80 % du cadre zoomé. */
export const MARGE_ZONE = 0.8;
export const ENTREE_ZOOM_MS = 500;
export const DEPLACEMENT_CURSEUR_MS = 500;
/** Le curseur part 600 ms avant le clic. */
export const AVANCE_CURSEUR_MS = 600;
export const IMPULSION_CLIC_MS = 300;
/** Règle de Williams (AUDIT-COMPLET-18-11 § 2 bis) : jamais plus de 1,5 s d'image fixe. */
export const SEUIL_IMAGE_FIXE_MS = 1500;

/** Le zoom d'une cible commence 150 ms après son clic ; le curseur arrive 100 ms avant. */
const RETARD_ZOOM_MS = 150;
const ARRIVEE_AVANT_CLIC_MS = 100;
const DEPART_CURSEUR = { x: 85, y: 85 } as const;
const APPARITION_CADRE_MS = 200;
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

/** Courbe douce (écrite ici) : 0 → 1, pente nulle aux deux bouts. */
export function easeInOut(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return t * t * (3 - 2 * t);
}

export interface Camera {
  echelle: number;
  origineXPct: number;
  origineYPct: number;
}

interface EtatCamera {
  s: number;
  cx: number;
  cy: number;
}

function etatDeZone(nav: NavigationFilmee, zone: ZonePct, format: FormatSortie): EtatCamera {
  const p = placementFilm(nav, format);
  const lz = (zone.largeur / 100) * p.largeur;
  const hz = (zone.hauteur / 100) * p.hauteur;
  const s = Math.max(1, Math.min(ZOOM_NAVIGATION_MAX, (MARGE_ZONE * Math.min(format.largeur / lz, format.hauteur / hz))));
  return { s, cx: p.x + ((zone.x + zone.largeur / 2) / 100) * p.largeur, cy: p.y + ((zone.y + zone.hauteur / 2) / 100) * p.hauteur };
}

interface SegmentCamera {
  debut: number;
  vers: EtatCamera;
}

function segmentsCamera(nav: NavigationFilmee, format: FormatSortie): { repos: EtatCamera; segments: SegmentCamera[] } {
  const repos: EtatCamera = { s: 1, cx: format.largeur / 2, cy: format.hauteur / 2 };
  const segments: SegmentCamera[] = [];
  for (const c of nav.cibles) {
    if (!c.zonePct) continue;
    // 1re montée depuis le repos : 150 ms après le clic. Passage d'une zone à l'autre : la caméra part avec le curseur
    // et arrive avec lui avant le clic (écart à la fiche, correction du verdict Opus : sinon le clic sort de l'image).
    const precedent = segments[segments.length - 1];
    const debut = precedent
      ? Math.max(precedent.debut, c.instantMs - ARRIVEE_AVANT_CLIC_MS - DEPLACEMENT_CURSEUR_MS)
      : c.instantMs + RETARD_ZOOM_MS;
    segments.push({ debut, vers: etatDeZone(nav, c.zonePct, format) });
  }
  if (segments.length) segments.push({ debut: Math.max(...nav.cibles.map((c) => c.finMs)), vers: repos });
  return { repos, segments };
}

function etatA(t: number, repos: EtatCamera, segments: SegmentCamera[], n: number): EtatCamera {
  if (n === 0) return repos;
  const seg = segments[n - 1];
  if (t < seg.debut) return etatA(t, repos, segments, n - 1);
  const de = etatA(seg.debut, repos, segments, n - 1);
  const k = easeInOut((t - seg.debut) / ENTREE_ZOOM_MS);
  return { s: de.s + (seg.vers.s - de.s) * k, cx: de.cx + (seg.vers.cx - de.cx) * k, cy: de.cy + (seg.vers.cy - de.cy) * k };
}

/** Début de la vue zoomée sur un axe : dans la page si elle y tient, sinon centrée sur la page (bandes ivoire). */
function debutVue(centre: number, vue: number, debutPage: number, taillePage: number): number {
  if (vue >= taillePage) return debutPage + (taillePage - vue) / 2;
  return Math.min(debutPage + taillePage - vue, Math.max(debutPage, centre - vue / 2));
}

/** Caméra à l'instant `tMs` : échelle et origine (en % de l'image de sortie) pour `transform: scale()`. */
export function cameraA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Camera {
  const { repos, segments } = segmentsCamera(nav, format);
  const e = etatA(tMs, repos, segments, segments.length);
  if (e.s - 1 < 1e-6) return { echelle: 1, origineXPct: 50, origineYPct: 50 };
  const p = placementFilm(nav, format);
  const vx = debutVue(e.cx, format.largeur / e.s, p.x, p.largeur);
  const vy = debutVue(e.cy, format.hauteur / e.s, p.y, p.hauteur);
  // Le point de la vue en haut à gauche (vx, vy) doit arriver en (0, 0) : O (1 − 1/s) = v.
  const k = e.s / (e.s - 1);
  return { echelle: e.s, origineXPct: ((vx * k) / format.largeur) * 100, origineYPct: ((vy * k) / format.hauteur) * 100 };
}

/** Un point de l'image de sortie (avant caméra) → son point à l'écran, après caméra. */
export function versEcran(cam: Camera, format: FormatSortie, p: { x: number; y: number }): { x: number; y: number } {
  const ox = (cam.origineXPct / 100) * format.largeur;
  const oy = (cam.origineYPct / 100) * format.hauteur;
  return { x: ox + cam.echelle * (p.x - ox), y: oy + cam.echelle * (p.y - oy) };
}

function centreDeZone(nav: NavigationFilmee, z: ZonePct, format: FormatSortie): { x: number; y: number } {
  const p = placementFilm(nav, format);
  return { x: p.x + ((z.x + z.largeur / 2) / 100) * p.largeur, y: p.y + ((z.y + z.hauteur / 2) / 100) * p.hauteur };
}

export interface Curseur {
  xPx: number;
  yPx: number;
  /** 0 à 1 : impulsion du clic. */
  clic: number;
}

/** Position du curseur dans l'image de sortie AVANT caméra. */
function curseurMonde(nav: NavigationFilmee, tMs: number, format: FormatSortie): { x: number; y: number } {
  const p = placementFilm(nav, format);
  let pos = { x: p.x + (DEPART_CURSEUR.x / 100) * p.largeur, y: p.y + (DEPART_CURSEUR.y / 100) * p.hauteur };
  for (const c of nav.cibles) {
    if (!c.zonePct) continue;
    const arrivee = c.instantMs - ARRIVEE_AVANT_CLIC_MS;
    const depart = arrivee - DEPLACEMENT_CURSEUR_MS;
    const vers = centreDeZone(nav, c.zonePct, format);
    if (tMs < depart) break;
    const k = easeInOut((tMs - depart) / DEPLACEMENT_CURSEUR_MS);
    pos = { x: pos.x + (vers.x - pos.x) * k, y: pos.y + (vers.y - pos.y) * k };
    if (tMs < arrivee) break;
  }
  return pos;
}

/** Curseur à l'instant `tMs`, après la caméra ; `null` avant son départ et après la dernière cible. */
export function curseurA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Curseur | null {
  const premier = nav.cibles[0];
  if (!premier || tMs < premier.instantMs - AVANCE_CURSEUR_MS) return null;
  if (tMs > Math.max(...nav.cibles.map((c) => c.finMs))) return null;
  const e = versEcran(cameraA(nav, tMs, format), format, curseurMonde(nav, tMs, format));
  let clic = 0;
  for (const c of nav.cibles) {
    const p = (tMs - c.instantMs) / IMPULSION_CLIC_MS;
    if (p > 0 && p < 1) clic = Math.max(clic, Math.sin(Math.PI * p));
  }
  return { xPx: e.x, yPx: e.y, clic };
}

export interface Surbrillance extends RectanglePx {
  epaisseur: number;
  /** 0 à 1 : apparition en 200 ms. */
  opacite: number;
}

/** Cadre autour de la zone active (du clic à la fin de la cible), après la caméra ; sinon `null`. */
export function surbrillanceA(nav: NavigationFilmee, tMs: number, format: FormatSortie): Surbrillance | null {
  const c = nav.cibles.find((x) => x.zonePct && tMs >= x.instantMs && tMs <= x.finMs);
  if (!c?.zonePct) return null;
  const cadre = cadreDansEcran(c.zonePct, placementFilm(nav, format));
  if (!cadre) return null;
  const cam = cameraA(nav, tMs, format);
  const a = versEcran(cam, format, { x: cadre.x, y: cadre.y });
  const b = versEcran(cam, format, { x: cadre.x + cadre.largeur, y: cadre.y + cadre.hauteur });
  return { x: a.x, y: a.y, largeur: b.x - a.x, hauteur: b.y - a.y, epaisseur: cadre.epaisseur, opacite: Math.min(1, (tMs - c.instantMs) / APPARITION_CADRE_MS) };
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
    const curImmobile = (!k0 && !k1) || (!!k0 && !!k1 && Math.abs(k0.xPx - k1.xPx) < 1e-3 && Math.abs(k0.yPx - k1.yPx) < 1e-3 && k0.clic === 0 && k1.clic === 0);
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
