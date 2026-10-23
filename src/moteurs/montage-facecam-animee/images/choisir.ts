/**
 * LES PHOTOS ET LOGOS (lot D) — CLASSEMENT DES CANDIDATS, PUR.
 *
 * PHOTOS : un candidat est écarté s'il n'est pas d'une source permise ; est trop petit (côté court < 1080 après
 * recadrage) ; ne peut pas remplir une fenêtre verticale (ni vertical, ni recadrable en 4:5) ; est déjà pris dans cette
 * vidéo ou dans l'une des 5 vidéos précédentes ; porte un défaut connu du B-roll face caméra (filigrane, texte anglais,
 * regard caméra — règle reprise telle quelle de `briques/habillage-facecam/broll`) ; a une licence sans usage commercial
 * (Wikimedia : CC0 ou CC-BY seulement) ; ou (banques) une description générique ou sans rapport avec la requête.
 *
 * MINI-VIDÉOS (retour de Will du 14/10 : « parfois il faudrait dans les animations des mini vidéos ») : en plus, une
 * vidéo est écartée si elle est horizontale au-delà du 16:9 (non recadrable en 4:5), a un côté court utile < 720 px
 * (1080 préféré), dure moins que la fenêtre + 0,5 s, ne bouge pas (écart moyen entre images ≤ `SEUIL_MOUVEMENT`), porte
 * un texte incrusté, un logo de marque ou un visage en très gros plan (qui concurrencerait Will).
 *
 * Les gardés sont classés : genre voulu d'abord, puis vertical, puis 4:5 natif, puis recadrable ; à égalité (vidéos)
 * 1080 px avant 720, puis la meilleure correspondance, puis le plus de mouvement, puis la meilleure résolution.
 */
import { refusBroll } from "@/briques/habillage-facecam/broll";
import { estGenerique, motsProches, motsSignificatifs, pertinent } from "@/domaine/illustrations";
import { sourcePermise, type SourceImage } from "./requetes";

export const COTE_COURT_MIN = 1080;
/** Mini-vidéos : côté court utile minimal et préféré (après recadrage 4:5). */
export const COTE_COURT_MIN_VIDEO = 720;
export const COTE_COURT_PREFERE_VIDEO = 1080;
/** Marge de durée d'une mini-vidéo sur sa fenêtre. */
export const MARGE_DUREE_VIDEO_SEC = 0.5;
/** Plus large que 16:9 (avec une tolérance), une vidéo ne se recadre pas en 4:5 sans perdre son sujet. */
export const RATIO_MAX_RECADRABLE = 1.8;
/**
 * Mouvement minimal : écart moyen absolu (0-255) entre images successives en niveaux de gris, réduites à 96 px de large
 * et espacées de 0,25 s (`ecartMoyen`). Mesuré : plan fixe ≈ 0,3-1 ; geste lent ≈ 2-4 ; action franche > 5.
 */
export const SEUIL_MOUVEMENT = 1.5;
/**
 * Mouvement VISIBLE (retour n° 6 de la revue finale : une horloge « vidéo » qu'on ne distingue pas d'une photo).
 * Mesuré sur l'extrait PRÉPARÉ, en niveaux de gris (`mesureMouvement`) : part des pixels qui changent de plus de
 * `SEUIL_PIXEL` niveaux d'une image à la suivante (plage ci-dessous) ; au plus 30 % d'images « figées » (moins de 0,5 %
 * de pixels changés) ; aucune coupe.
 */
export const SEUIL_PIXEL = 12;
/**
 * Passe 3 (revue passe 2, point 2) : la plage admise se lit sur la MÉDIANE, image par image à 25 i/s (comme `mvt.py`
 * de l'architecte, qui mesure la vidéo rendue), sur l'extrait réduit à `LARGEUR_CONTROLE` px :
 *  - moins de 3 % des pixels qui changent : on ne la distingue pas d'une photo → refusée ;
 *  - plus de 35 % : travelling, caméra qui court, plan qui saute → refusée (Will, 15/10 : « ça bouge trop »).
 * Étalonnage du 15/10 sur les fenêtres de la vidéo 3 (mesure ici / `mvt.py`) : fenêtre 5 24,3 / 25 % ; 7 8,2 / 7,5 % ;
 * 12 5,7 / 5,5 % ; 3 2,2 / 1,7 % ; 2 1,5 / 0,3 %.
 */
export const SEUIL_PIXELS_CHANGES = 0.03;
export const SEUIL_PIXELS_CHANGES_MAX = 0.35;
/** Largeur (px) et cadence (i/s) de la mesure du mouvement visible. */
export const LARGEUR_CONTROLE = 360;
export const IMAGES_PAR_SEC_MESURE = 25;
/** Une paire d'images où plus de 60 % des pixels changent est une COUPE (changement de plan) : jamais dans un extrait. */
export const SEUIL_COUPE = 0.6;
export const PART_FIGEE_MAX = 0.3;
const PIXELS_FIGEE = 0.005;
/** Nombre de vidéos précédentes où une image ne doit pas avoir servi. */
export const VIDEOS_SANS_REPETITION = 5;

export interface LicenceCandidat {
  usageCommercial: boolean;
  /** Nom court (« Pexels », « Pixabay Content License », « CC0 », « CC BY 4.0 »…). */
  nom?: string;
  /** Crédit à porter (CC-BY). */
  attribution?: string;
}

export interface CandidatImage {
  source: SourceImage;
  /** Identifiant chez la source (ou dans la Bibliothèque). */
  id: string;
  genre: "photo" | "video";
  /** Clé de stockage, ou adresse de la source tant que rien n'est recopié. */
  cle: string;
  /** Vignette regardée par le contrôle visuel. */
  vignette?: string;
  largeur: number;
  hauteur: number;
  dureeSec?: number;
  /** Description de la source (banques) ou nom et mots-clés (Mes images). */
  description?: string;
  /** Correspondance 0-1 calculée par la source (Mes images : score de la Bibliothèque). */
  score?: number;
  licence?: LicenceCandidat;
  /** Page d'origine (preuve de la licence). */
  page?: string;
  auteur?: string;
  /** Défauts connus (analyse d'import) : mêmes refus que les B-roll du face caméra. */
  filigrane?: boolean;
  texteAnglais?: boolean;
  regardCamera?: boolean;
  /** Mini-vidéos — mesures faites après téléchargement (`ecartMoyen`) ou contrôle visuel. */
  mouvement?: number;
  /** Part moyenne des pixels qui changent d'une image à l'autre (`mesureMouvement`, 0-1). */
  pixelsChanges?: number;
  /** Part des images figées (`mesureMouvement`, 0-1). */
  partFigee?: number;
  /** Part MÉDIANE des pixels qui changent d'une image à l'autre à 25 i/s (`mesureMouvement`, 0-1) : la mesure qui décide. */
  pixelsChangesMedian?: number;
  /** Nombre de coupes (changements de plan) dans l'extrait. */
  coupes?: number;
  texteIncruste?: boolean;
  logo?: boolean;
  visageGrosPlan?: boolean;
  /** Objet d'origine de l'adaptateur (pour la recopie), jamais lu ici. */
  brut?: unknown;
}

/** Empreinte unique d'un candidat (anti-doublon dans la vidéo et avec l'historique). */
export const empreinte = (c: Pick<CandidatImage, "source" | "id">) => `${c.source}:${c.id}`;

export type FormatCandidat = "vertical" | "4:5" | "recadrable";

/**
 * Format d'un candidat et côté court UTILE (celui du cadre réellement montré) :
 *  - vertical : hauteur ≥ 1,5 × largeur (9:16 ou proche) ;
 *  - 4:5 : hauteur ≥ 1,2 × largeur ;
 *  - recadrable : plus large, recadré en 4:5 → côté court utile = hauteur × 0,8.
 */
export function formatDe(c: Pick<CandidatImage, "largeur" | "hauteur">): { format: FormatCandidat; coteCourt: number } | null {
  if (!(c.largeur > 0) || !(c.hauteur > 0)) return null;
  const r = c.hauteur / c.largeur;
  if (r >= 1.5) return { format: "vertical", coteCourt: c.largeur };
  if (r >= 1.2) return { format: "4:5", coteCourt: c.largeur };
  return { format: "recadrable", coteCourt: Math.round(Math.min(c.largeur, c.hauteur * 0.8)) };
}

/** Format d'une MINI-VIDÉO : comme `formatDe`, mais une vidéo plus large que 16:9 n'est pas recadrable (null). */
export function formatMiniVideo(c: Pick<CandidatImage, "largeur" | "hauteur">): { format: FormatCandidat; coteCourt: number } | null {
  const f = formatDe(c);
  if (!f) return null;
  if (f.format === "recadrable" && c.largeur / c.hauteur > RATIO_MAX_RECADRABLE) return null;
  return f;
}

/** Licence acceptée : usage commercial, et pour Wikimedia seulement CC0 / CC-BY / domaine public (jamais BY-SA, NC, ND). */
export function licenceAcceptee(c: Pick<CandidatImage, "source" | "licence">): boolean {
  if (c.licence && !c.licence.usageCommercial) return false;
  if (c.source !== "wikimedia") return true;
  const nom = (c.licence?.nom ?? "").trim();
  return /^(cc0( 1\.0)?|cc[ -]by( [1-4]\.0)?|public domain|domaine public|pd)$/i.test(nom) && !(/by/i.test(nom) && !c.licence?.attribution);
}

export interface ContexteChoix {
  /** Le réalisateur préfère une vidéo. */
  video: boolean;
  /** Durée de la fenêtre (fin − début). */
  dureeFenetreSec: number;
  /** Requête anglaise (pertinence des descriptions des banques). */
  requeteEn?: string;
  /** Empreintes déjà prises dans CETTE vidéo. */
  dejaPris: ReadonlySet<string>;
  /** Empreintes des vidéos précédentes, la plus récente en dernier (seules les 5 dernières comptent). */
  historique?: readonly (readonly string[])[];
}

/** Empreintes interdites par l'historique (5 dernières vidéos). */
export function empreintesHistorique(historique: readonly (readonly string[])[] | undefined): Set<string> {
  return new Set((historique ?? []).slice(-VIDEOS_SANS_REPETITION).flat());
}

/** Raison de l'écart d'une MINI-VIDÉO sur ses propres critères (null : gardée). Les mesures absentes ne refusent pas. */
export function raisonEcartMiniVideo(c: CandidatImage, dureeFenetreSec: number): string | null {
  const f = formatMiniVideo(c);
  if (!f) return c.largeur > 0 && c.hauteur > 0 ? "horizontale non recadrable" : "dimensions inconnues";
  if (f.coteCourt < COTE_COURT_MIN_VIDEO) return "résolution trop faible";
  if ((c.dureeSec ?? 0) < dureeFenetreSec + MARGE_DUREE_VIDEO_SEC) return "vidéo trop courte";
  // La médiane à 25 i/s décide quand elle est mesurée ; sinon la moyenne ; sinon l'ancien écart (avant préparation).
  const visible = c.pixelsChangesMedian ?? c.pixelsChanges;
  if (visible === undefined && c.mouvement !== undefined && !(c.mouvement > SEUIL_MOUVEMENT)) return "sans mouvement";
  if (visible !== undefined && !(visible >= SEUIL_PIXELS_CHANGES)) return `mouvement invisible (${(visible * 100).toFixed(1)} % des pixels changent)`;
  if (visible !== undefined && visible > SEUIL_PIXELS_CHANGES_MAX) return `bouge trop (${(visible * 100).toFixed(1)} % des pixels changent : travelling ou caméra qui court)`;
  if (c.coupes) return "changement de plan dans l'extrait";
  if (c.partFigee !== undefined && c.partFigee > PART_FIGEE_MAX) return `trop d'images figées (${Math.round(c.partFigee * 100)} %)`;
  if (c.texteIncruste) return "texte incrusté";
  if (c.logo) return "logo de marque";
  if (c.visageGrosPlan) return "visage en très gros plan";
  return null;
}

/** Raison de l'écart d'un candidat (null : gardé). */
export function raisonEcart(c: CandidatImage, ctx: ContexteChoix, interdits = empreintesHistorique(ctx.historique)): string | null {
  if (!sourcePermise(c.source)) return "source non permise";
  if (c.genre === "video") {
    const r = raisonEcartMiniVideo(c, ctx.dureeFenetreSec);
    if (r) return r;
  } else {
    const f = formatDe(c);
    if (!f) return "dimensions inconnues";
    if (f.coteCourt < COTE_COURT_MIN) return "résolution trop faible";
  }
  const e = empreinte(c);
  if (ctx.dejaPris.has(e)) return "déjà dans cette vidéo";
  if (interdits.has(e)) return "déjà dans une des 5 vidéos précédentes";
  const defaut = refusBroll({ id: e, filigrane: c.filigrane, texteAnglais: c.texteAnglais, regardCamera: c.regardCamera, origine: c.source });
  if (defaut) return defaut;
  if (!licenceAcceptee(c)) return c.source === "wikimedia" ? "licence Wikimedia autre que CC0 / CC-BY" : "licence sans usage commercial";
  if ((c.source === "pexels" || c.source === "pixabay" || c.source === "wikimedia") && c.description?.trim()) {
    if (estGenerique(c.description)) return "image générique";
    if (ctx.requeteEn && !pertinent(c.description, ctx.requeteEn)) return "sans rapport avec la recherche";
  }
  return null;
}

const RANG_FORMAT: Record<FormatCandidat, number> = { vertical: 0, "4:5": 1, recadrable: 2 };

/**
 * Recouvrement description ↔ requête : nombre de mots de la requête retrouvés dans la description de la banque.
 * Passe 3 : chaque mini-vidéo essayée coûte un téléchargement et un contrôle ; on essaie d'abord celles dont la
 * description dit le plus de mots de la scène (avant le format : une verticale hors sujet ne doit pas passer devant
 * une vidéo paysage qui montre l'action).
 */
export function recouvrement(description: string | undefined, requeteEn: string | undefined): number {
  const voulus = motsSignificatifs(requeteEn ?? "");
  const vus = motsSignificatifs(description ?? "");
  return voulus.filter((v) => vus.some((x) => motsProches(x, v))).length;
}

/** Candidats gardés, du meilleur au moins bon (l'ordre des sources est tenu par l'appelant, source par source). */
export function classerCandidats<C extends CandidatImage>(candidats: readonly C[], ctx: ContexteChoix): C[] {
  const interdits = empreintesHistorique(ctx.historique);
  const vus = new Set<string>();
  const gardes = candidats.filter((c) => {
    const e = empreinte(c);
    if (vus.has(e) || raisonEcart(c, ctx, interdits)) return false;
    vus.add(e);
    return true;
  });
  const genreVoulu = ctx.video ? "video" : "photo";
  const hd = (x: { c: CandidatImage; f: { coteCourt: number } }) => Number(x.c.genre === "video" && x.f.coteCourt < COTE_COURT_PREFERE_VIDEO);
  return gardes
    .map((c, i) => ({ c, i, f: formatDe(c)! }))
    .sort(
      (a, b) =>
        Number(a.c.genre !== genreVoulu) - Number(b.c.genre !== genreVoulu) ||
        (ctx.video ? recouvrement(b.c.description, ctx.requeteEn) - recouvrement(a.c.description, ctx.requeteEn) : 0) ||
        RANG_FORMAT[a.f.format] - RANG_FORMAT[b.f.format] ||
        hd(a) - hd(b) ||
        (b.c.score ?? 0) - (a.c.score ?? 0) ||
        (b.c.mouvement ?? 0) - (a.c.mouvement ?? 0) ||
        b.f.coteCourt - a.f.coteCourt ||
        a.i - b.i,
    )
    .map((x) => x.c);
}

/* ---------------- Mesure du mouvement (pure : images en niveaux de gris déjà décodées) ---------------- */

/**
 * Écart moyen absolu entre images successives (niveaux de gris, même taille). Au moins 2 images ; la règle du cahier
 * des charges le mesure sur 3 images (2 écarts). Moins de 2 images : 0 (rien ne prouve que ça bouge).
 */
export function ecartMoyen(images: readonly ArrayLike<number>[]): number {
  if (images.length < 2) return 0;
  let total = 0;
  let paires = 0;
  for (let k = 1; k < images.length; k++) {
    const a = images[k - 1];
    const b = images[k];
    const n = Math.min(a.length, b.length);
    if (!n) continue;
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
    total += s / n;
    paires++;
  }
  return paires ? total / paires : 0;
}

/**
 * Mouvement VISIBLE d'une suite d'images (niveaux de gris, même taille) : écart moyen, part moyenne des pixels qui
 * changent de plus de `SEUIL_PIXEL` niveaux, part des images figées. Moins de 2 images : tout à 0 sauf `partFigee` = 1.
 */
export function mesureMouvement(images: readonly ArrayLike<number>[]): { ecart: number; pixelsChanges: number; partFigee: number; mediane: number; coupes: number } {
  const parts = partsChangees(images);
  let ecart = 0;
  for (let k = 1; k < images.length; k++) {
    const a = images[k - 1];
    const b = images[k];
    const n = Math.min(a.length, b.length);
    if (!n) continue;
    let s = 0;
    for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
    ecart += s / n;
  }
  if (!parts.length) return { ecart: 0, pixelsChanges: 0, partFigee: 1, mediane: 0, coupes: 0 };
  return {
    ecart: ecart / parts.length,
    pixelsChanges: parts.reduce((t, x) => t + x, 0) / parts.length,
    partFigee: parts.filter((x) => x < PIXELS_FIGEE).length / parts.length,
    mediane: mediane(parts),
    coupes: parts.filter((x) => x > SEUIL_COUPE).length,
  };
}

/** Part des pixels qui changent de plus de `SEUIL_PIXEL` niveaux, pour chaque paire d'images successives. */
export function partsChangees(images: readonly ArrayLike<number>[]): number[] {
  const sortie: number[] = [];
  for (let k = 1; k < images.length; k++) {
    const a = images[k - 1];
    const b = images[k];
    const n = Math.min(a.length, b.length);
    if (!n) continue;
    let c = 0;
    for (let i = 0; i < n; i++) if (Math.abs(a[i] - b[i]) > SEUIL_PIXEL) c++;
    sortie.push(c / n);
  }
  return sortie;
}

export function mediane(x: readonly number[]): number {
  if (!x.length) return 0;
  const t = [...x].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/**
 * Le passage à montrer (passe 3) : `parts[k]` = part des pixels changés entre l'image k et k+1 (`partsChangees`, à
 * `imagesParSec`). Parmi les passages de `dureeSec` SANS coupe, on prend celui dont la médiane est la plus haute tout en
 * restant dans la plage visible [`SEUIL_PIXELS_CHANGES` ; `SEUIL_PIXELS_CHANGES_MAX`] — de l'action, pas un travelling.
 * Aucun dans la plage : le plus proche de la plage (il sera refusé à la mesure de l'extrait, et le candidat suivant pris).
 */
export function passageDansLaPlage(parts: readonly number[], imagesParSec: number, dureeSec: number): { debutSec: number; mediane: number; dansLaPlage: boolean } {
  if (!parts.length || !(imagesParSec > 0)) return { debutSec: 0, mediane: 0, dansLaPlage: false };
  const largeur = Math.max(1, Math.min(parts.length, Math.round(dureeSec * imagesParSec)));
  let meilleur: { debut: number; m: number; score: number } | null = null;
  const pas = Math.max(1, Math.round(imagesParSec / 5)); // un départ tous les 0,2 s
  for (let d = 0; d + largeur <= parts.length; d += pas) {
    const tranche = parts.slice(d, d + largeur);
    const coupe = tranche.some((x) => x > SEUIL_COUPE);
    const m = mediane(tranche);
    const calmes = tranche.filter((x) => x <= SEUIL_PIXELS_CHANGES_MAX);
    const moyenne = calmes.length ? calmes.reduce((t, x) => t + x, 0) / calmes.length : 0;
    // Pas plus de 10 % des images au-delà du plafond : un passage à moitié en travelling n'est pas « dans la plage ».
    const rapides = tranche.filter((x) => x > SEUIL_PIXELS_CHANGES_MAX).length / tranche.length;
    const dans = !coupe && rapides <= 0.1 && m >= SEUIL_PIXELS_CHANGES && m <= SEUIL_PIXELS_CHANGES_MAX;
    // Dans la plage : la plus haute médiane l'emporte, moins la part d'images trop rapides (à égalité, la plus haute
    // moyenne des images calmes : le passage le plus plein) ;
    // hors plage : la plus petite distance à la plage, coupe pénalisée.
    const distance = m < SEUIL_PIXELS_CHANGES ? SEUIL_PIXELS_CHANGES - m : m > SEUIL_PIXELS_CHANGES_MAX ? m - SEUIL_PIXELS_CHANGES_MAX : 0;
    const score = dans ? 10 + m - rapides + 0.001 * moyenne : -distance - (coupe ? 1 : 0);
    if (!meilleur || score > meilleur.score) meilleur = { debut: d, m, score };
  }
  const b = meilleur ?? { debut: 0, m: mediane(parts), score: -1 };
  return { debutSec: Math.round((b.debut / imagesParSec) * 100) / 100, mediane: b.m, dansLaPlage: b.score >= 10 };
}

/**
 * Le passage le plus animé : `ecarts[k]` est l'écart entre l'image k et k+1 (images espacées de 1/`imagesParSec`).
 * Rend le début (s) de la fenêtre glissante de `dureeSec` qui a le plus grand écart moyen, et cet écart.
 */
export function passageLePlusAnime(ecarts: readonly number[], imagesParSec: number, dureeSec: number): { debutSec: number; mouvement: number } {
  if (!ecarts.length || !(imagesParSec > 0)) return { debutSec: 0, mouvement: 0 };
  const largeur = Math.max(1, Math.min(ecarts.length, Math.round(dureeSec * imagesParSec)));
  let somme = 0;
  for (let i = 0; i < largeur; i++) somme += ecarts[i];
  let meilleur = { debut: 0, somme };
  for (let i = largeur; i < ecarts.length; i++) {
    somme += ecarts[i] - ecarts[i - largeur];
    if (somme > meilleur.somme) meilleur = { debut: i - largeur + 1, somme };
  }
  return { debutSec: Math.round((meilleur.debut / imagesParSec) * 100) / 100, mouvement: meilleur.somme / largeur };
}
