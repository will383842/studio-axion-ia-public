/**
 * GÉOMÉTRIE DU FILM DU TUTORIEL pour la mesure de netteté (T-EXT-54d). PUR, sans IA, ne lève jamais, éteint : rien ne l'appelle encore.
 * Dit SEULEMENT où et quand mesurer (instants, zones, quarts sans le curseur) et traduit les mesures en verdicts `TUT-*`.
 * La partie générique (formule de netteté, FFmpeg, seuil, règle d'agrandissement, règle de taille) est COMMUNE : `controle-image/mesures-video.ts` (54a), importée.
 * Le minimum de taille du texte vient de T-EXT-43 (`tailleTexteMinPx`, importé) ; `options.minimumPx` peut seulement forcer une autre valeur.
 */
import { agrandissementOk, lisibleApresZoom, SEUIL_SSIM_ZONE, type MesureZone, type Rect, type ZoneMesure } from "../../briques/controle-image/mesures-video";
import { placementFilm, type FormatSortie, type NavigationFilmee } from "../../briques/plan-scenes/tutoriel/navigation-filmee";
import { curseurA, poseA, type PlanMotionFilm, type PoseCamera } from "../../briques/plan-scenes/tutoriel/motion-film";
import type { ResultatControleTutoriel } from "./equipe/controleur";
import { tailleTexteMinPx } from "./diffusion-tutoriel";

/** Cadre du projecteur : la zone mesurée est rognée de ce pourcentage de sa taille, de chaque côté. */
export const MARGE_CADRE_PCT = 3;
/** Délai après le clic avant de mesurer (la caméra est posée, le clic est passé). */
export const APRES_CLIC_MS = 300;
/** Marge avant la fin de la cible : on ne mesure pas pendant la sortie du projecteur. */
export const AVANT_FIN_MS = 200;
/** Côté minimal (px de la vidéo) d'un quart mesurable. */
const COTE_MIN_PX = 8;

export interface InstantMesure {
  etapeId: string;
  tMs: number;
}

/** Ce que la géométrie lit de `cibles.json` (T-EXT-03b, forme recopiée : aucun import d'`outils/` depuis `src/`). */
export interface CibleMesuree {
  etapeId: string;
  /** Plus petite police de la zone, en px CSS de la page filmée. */
  policeMinPx?: number;
}

export interface QuartZone {
  /** 1 à 4 : haut-gauche, haut-droite, bas-gauche, bas-droite. */
  indice: number;
  rect: Rect;
}

/**
 * Premier instant ≥ `tMs` où la caméra ne bouge plus : si `tMs` tombe entre deux images clés de poses différentes (mouvement en cours),
 * on attend l'image clé d'arrivée. Plan sans caméra : `tMs` inchangé.
 */
function cameraPoseeA(plan: Pick<PlanMotionFilm, "camera">, tMs: number): number {
  const k = Array.isArray(plan.camera) ? plan.camera : [];
  let t = tMs;
  for (let i = 0; i + 1 < k.length; i++) {
    const a = k[i]!;
    const b = k[i + 1]!;
    const bouge = Math.abs(a.cx - b.cx) > 1e-9 || Math.abs(a.cy - b.cy) > 1e-9 || Math.abs(a.zoom - b.zoom) > 1e-9;
    if (bouge && a.tMs < t && t < b.tMs) t = b.tMs;
  }
  return t;
}

/**
 * Pour chaque cible avec zone : le plus tardif de la fin de l'arrivée de la caméra et de « clic + 300 ms », avant la fin de la cible moins 200 ms.
 * Aucun instant possible → l'étape est absente du résultat (« non mesurée », jamais devinée).
 */
export function instantsDeMesure(nav: Pick<NavigationFilmee, "cibles">, plan: Pick<PlanMotionFilm, "camera">): InstantMesure[] {
  try {
    const sorties: InstantMesure[] = [];
    for (const c of nav.cibles) {
      if (!c.zonePct) continue;
      const tMs = cameraPoseeA(plan, c.instantMs + APRES_CLIC_MS);
      if (!Number.isFinite(tMs) || tMs >= c.finMs - AVANT_FIN_MS) continue;
      sorties.push({ etapeId: c.etapeId, tMs });
    }
    return sorties;
  } catch {
    return [];
  }
}

/**
 * La zone est découpée en 4 quarts ; celui qui contient le curseur est écarté (le curseur dessiné n'est pas dans la source).
 * Un curseur absent ou hors de la zone : les 4 quarts. Un curseur pile au centre appartient au quart bas-droite.
 */
export function quartSansCurseur(rectVideo: Rect, curseur: { x: number; y: number } | null): QuartZone[] {
  const demiL = rectVideo.largeur / 2;
  const demiH = rectVideo.hauteur / 2;
  const tous: QuartZone[] = [0, 1, 2, 3].map((i) => ({
    indice: i + 1,
    rect: { x: rectVideo.x + (i % 2) * demiL, y: rectVideo.y + Math.floor(i / 2) * demiH, largeur: demiL, hauteur: demiH },
  }));
  if (!curseur || !Number.isFinite(curseur.x) || !Number.isFinite(curseur.y)) return tous;
  const dedans = curseur.x >= rectVideo.x && curseur.x <= rectVideo.x + rectVideo.largeur && curseur.y >= rectVideo.y && curseur.y <= rectVideo.y + rectVideo.hauteur;
  if (!dedans) return tous;
  const col = curseur.x >= rectVideo.x + demiL ? 1 : 0;
  const lig = curseur.y >= rectVideo.y + demiH ? 1 : 0;
  const ecarte = lig * 2 + col + 1;
  return tous.filter((q) => q.indice !== ecarte);
}

export interface OptionsZones {
  /** Force une autre taille minimale du texte après zoom (px de sortie). Absente : `tailleTexteMinPx(ratio du format)` de T-EXT-43. */
  minimumPx?: number;
}

/** Ratio d'un format de sortie connu, sinon `null`. */
export function ratioDuFormat(f: FormatSortie): string | null {
  for (const r of ["4:5", "9:16", "1:1", "16:9"]) {
    const g = formatDuRatio(r);
    if (g && g.largeur === f.largeur && g.hauteur === f.hauteur) return r;
  }
  return null;
}

const fini = (...n: number[]): boolean => n.every((v) => Number.isFinite(v));

/**
 * Zones à mesurer : par étape et par quart retenu, rectangle dans le film (px, à la définition de la capture) et dans la vidéo finie
 * (après placement du film et pose de la caméra), rognés de `MARGE_CADRE_PCT`. `id` = `<etapeId>#q<n>`.
 * Une étape sans instant possible, ou dont la zone sort de l'image, n'a pas de zone : elle n'est pas mesurée.
 */
export function zonesTutoriel(
  nav: NavigationFilmee,
  plan: PlanMotionFilm,
  format: FormatSortie,
  capture: { largeurPx: number; hauteurPx: number },
  cibles?: readonly CibleMesuree[],
  options: OptionsZones = {},
): ZoneMesure[] {
  try {
    if (!fini(capture.largeurPx, capture.hauteurPx, format.largeur, format.hauteur) || capture.largeurPx <= 0 || capture.hauteurPx <= 0) return [];
    const place = placementFilm(nav, format);
    const echelleFilm = capture.largeurPx / nav.largeur;
    const zones: ZoneMesure[] = [];
    const ratio = ratioDuFormat(format);
    const minimumPx = options.minimumPx !== undefined ? options.minimumPx : ratio ? tailleTexteMinPx(ratio) : undefined;
    for (const inst of instantsDeMesure(nav, plan)) {
      const cible = nav.cibles.find((c) => c.etapeId === inst.etapeId);
      const z = cible?.zonePct;
      if (!z) continue;
      const pose = poseA(plan, inst.tMs);
      // Zone rognée du cadre (en % de la page), puis quarts en % de la page.
      const mx = (z.largeur * MARGE_CADRE_PCT) / 100;
      const my = (z.hauteur * MARGE_CADRE_PCT) / 100;
      const rognee: Rect = { x: z.x + mx, y: z.y + my, largeur: z.largeur - 2 * mx, hauteur: z.hauteur - 2 * my };
      const versVideo = (r: Rect): Rect => pctVersVideo(r, place, pose, format);
      const curs = curseurA(plan, inst.tMs);
      const curseurVideo = curs ? ponctuelVersVideo(curs, place, pose, format) : null;
      const quarts = quartSansCurseur(versVideo(rognee), curseurVideo);
      const rectPct = (q: QuartZone): Rect => ({
        x: rognee.x + ((q.indice - 1) % 2) * (rognee.largeur / 2),
        y: rognee.y + Math.floor((q.indice - 1) / 2) * (rognee.hauteur / 2),
        largeur: rognee.largeur / 2,
        hauteur: rognee.hauteur / 2,
      });
      const police = cibles?.find((c) => c.etapeId === inst.etapeId)?.policeMinPx;
      const echelleSource = (place.echelle * pose.zoom) / echelleFilm;
      for (const q of quarts) {
        const p = rectPct(q);
        const v = versVideo(p);
        // Seule la part visible dans l'image est mesurée ; le rectangle du film suit la même coupe.
        const x0 = Math.max(0, v.x);
        const y0 = Math.max(0, v.y);
        const x1 = Math.min(format.largeur, v.x + v.largeur);
        const y1 = Math.min(format.hauteur, v.y + v.hauteur);
        if (x1 - x0 < COTE_MIN_PX || y1 - y0 < COTE_MIN_PX) continue;
        const coupe: Rect = {
          x: p.x + ((x0 - v.x) / v.largeur) * p.largeur,
          y: p.y + ((y0 - v.y) / v.hauteur) * p.hauteur,
          largeur: ((x1 - x0) / v.largeur) * p.largeur,
          hauteur: ((y1 - y0) / v.hauteur) * p.hauteur,
        };
        const film: Rect = {
          x: Math.round((coupe.x / 100) * capture.largeurPx),
          y: Math.round((coupe.y / 100) * capture.hauteurPx),
          largeur: Math.max(1, Math.round((coupe.largeur / 100) * capture.largeurPx)),
          hauteur: Math.max(1, Math.round((coupe.hauteur / 100) * capture.hauteurPx)),
        };
        zones.push({
          id: `${inst.etapeId}#q${q.indice}`,
          tSourceSec: (nav.debutFilmMs + inst.tMs) / 1000,
          tVideoSec: inst.tMs / 1000,
          rectSource: film,
          rectVideo: { x: Math.round(x0), y: Math.round(y0), largeur: Math.max(1, Math.round(x1 - x0)), hauteur: Math.max(1, Math.round(y1 - y0)) },
          echelleSource,
          ...(police !== undefined && Number.isFinite(police) ? { policeSourcePx: police * echelleFilm } : {}),
          ...(minimumPx !== undefined && Number.isFinite(minimumPx) && minimumPx > 0 ? { minimumPx } : {}),
        });
      }
    }
    return zones;
  } catch {
    return [];
  }
}

function pctVersVideo(r: Rect, place: { x: number; y: number; largeur: number; hauteur: number }, pose: PoseCamera, f: FormatSortie): Rect {
  const a = ponctuelVersVideo({ x: r.x, y: r.y }, place, pose, f);
  const b = ponctuelVersVideo({ x: r.x + r.largeur, y: r.y + r.hauteur }, place, pose, f);
  return { x: a.x, y: a.y, largeur: b.x - a.x, hauteur: b.y - a.y };
}

/** Point en % de la page → pixel de la vidéo finie (placement du film, puis pose de la caméra). */
function ponctuelVersVideo(p: { x: number; y: number }, place: { x: number; y: number; largeur: number; hauteur: number }, pose: PoseCamera, f: FormatSortie): { x: number; y: number } {
  const mx = place.x + (p.x / 100) * place.largeur;
  const my = place.y + (p.y / 100) * place.hauteur;
  return { x: (mx - pose.cx) * pose.zoom + f.largeur / 2, y: (my - pose.cy) * pose.zoom + f.hauteur / 2 };
}

/* ------------------------------------------------------------------ */
/* Rapport par étape et verdicts                                       */
/* ------------------------------------------------------------------ */

export interface EtapeNettete {
  etapeId: string;
  /** Rang de l'étape dans le rapport, à partir de 1 (« Étape 3 »). */
  numero: number;
  /** Le plus petit score de ses quarts ; `null` si un quart n'a pas pu être mesuré et qu'aucun autre ne montre un défaut. */
  ssim: number | null;
  echelleSource: number;
  policeEffectivePx?: number;
  verdict: MesureZone["verdict"];
  netteEchec: boolean;
  agrandissementEchec: boolean;
  texteEchec: boolean;
  /** Vrai si la taille du texte ET le minimum attendu sont connus. */
  lisibiliteVerifiee: boolean;
  /** Raisons en mots simples, déjà dites « Étape N : … », par contrôle. */
  raisonsNettete: string[];
  raisonsAgrandissement: string[];
  raisonsTexte: string[];
  /** Raisons restantes (mesure absente…). */
  raisonsAutres: string[];
}

export interface RapportNettete {
  etapes: EtapeNettete[];
}

const idEtape = (id: string): string => {
  const i = id.lastIndexOf("#q");
  return i >= 0 ? id.slice(0, i) : id;
};

const sansEnTete = (raison: string): string => raison.replace(/^Zone « .*? » : /, "");

/**
 * Regroupe les mesures par étape. Le score de l'étape est le plus petit de ses quarts. `zones` (facultatif) apporte le minimum de taille
 * de chaque zone ; sans lui, la lisibilité après zoom n'est pas contrôlée. Aucune règle n'est réécrite ici : tout vient de 54a.
 */
export function rapportNetteteTutoriel(mesures: readonly MesureZone[], zones: readonly ZoneMesure[] = []): RapportNettete {
  const ordre: string[] = [];
  const groupes = new Map<string, MesureZone[]>();
  for (const m of mesures) {
    const e = idEtape(m.id);
    if (!groupes.has(e)) {
      groupes.set(e, []);
      ordre.push(e);
    }
    groupes.get(e)!.push(m);
  }
  const etapes = ordre.map((etapeId, i): EtapeNettete => {
    const quarts = groupes.get(etapeId)!;
    const numero = i + 1;
    const mesures_ = quarts.filter((q) => q.ssim !== null);
    const pire = mesures_.length ? mesures_.reduce((a, b) => ((b.ssim as number) < (a.ssim as number) ? b : a)) : null;
    const nonMesure = quarts.some((q) => q.ssim === null);
    const ssim = pire ? (pire.ssim as number) : null;
    const echelleSource = Math.max(...quarts.map((q) => q.echelleSource));
    const polices = quarts.map((q) => q.policeEffectivePx).filter((p): p is number => p !== undefined);
    const policeEffectivePx = polices.length ? Math.min(...polices) : undefined;
    const minimums = zones.filter((z) => idEtape(z.id) === etapeId && z.minimumPx !== undefined).map((z) => z.minimumPx as number);
    const minimumPx = minimums.length ? Math.max(...minimums) : undefined;

    const netteEchec = ssim !== null && ssim < SEUIL_SSIM_ZONE;
    const agrandissementEchec = !agrandissementOk(echelleSource);
    const texteEchec = policeEffectivePx !== undefined && minimumPx !== undefined && !lisibleApresZoom(policeEffectivePx, minimumPx);

    // Les raisons viennent de 54a, dans l'ordre : netteté, agrandissement, texte. Celles de la netteté sont prises sur le pire quart.
    const raisonsDe = (q: MesureZone | null): string[] => (q ? q.raisons.map((r) => `Étape ${numero} : ${sansEnTete(r)}`) : []);
    const echecs = [netteEchec, agrandissementEchec, texteEchec];
    const nbEchecs = echecs.filter(Boolean).length;
    const source = pire ?? quarts[0]!;
    const toutes = raisonsDe(source);
    const raisonsNettete: string[] = [];
    const raisonsAgrandissement: string[] = [];
    const raisonsTexte: string[] = [];
    const raisonsAutres: string[] = [];
    if (nbEchecs > 0 && toutes.length === nbEchecs) {
      let k = 0;
      if (netteEchec) raisonsNettete.push(toutes[k++]!);
      if (agrandissementEchec) raisonsAgrandissement.push(toutes[k++]!);
      if (texteEchec) raisonsTexte.push(toutes[k++]!);
    } else {
      for (const r of toutes) raisonsAutres.push(r);
    }
    if (nonMesure && ssim === null) for (const q of quarts) for (const r of raisonsDe(q)) if (!raisonsAutres.includes(r)) raisonsAutres.push(r);
    const verdict: MesureZone["verdict"] = netteEchec || agrandissementEchec || texteEchec || quarts.some((q) => q.verdict === "a-revoir") ? "a-revoir" : nonMesure ? "non-mesure" : "ok";
    return {
      etapeId,
      numero,
      ssim,
      echelleSource,
      ...(policeEffectivePx !== undefined ? { policeEffectivePx } : {}),
      verdict,
      netteEchec,
      agrandissementEchec,
      texteEchec,
      lisibiliteVerifiee: policeEffectivePx !== undefined && minimumPx !== undefined,
      raisonsNettete,
      raisonsAgrandissement,
      raisonsTexte,
      raisonsAutres,
    };
  });
  return { etapes };
}

const NON_FAIT = "La netteté de la vidéo finie n'a pas encore été mesurée.";

function ligne(id: string, libelle: string, echecs: string[], nonFait: string | null, ok: string): ResultatControleTutoriel {
  if (echecs.length) return { id, libelle, etat: "echoue", bloquant: true, details: echecs };
  if (nonFait) return { id, libelle, etat: "non-fait", bloquant: true, details: [nonFait] };
  return { id, libelle, etat: "reussi", bloquant: true, details: [ok] };
}

/** Les trois contrôles de netteté. Rapport absent ou vide : trois « non fait », jamais « réussi ». */
export function controlerNettete(rapport: RapportNettete | undefined): ResultatControleTutoriel[] {
  const etapes = rapport?.etapes ?? [];
  const vide = etapes.length === 0;
  const nettete = etapes.filter((e) => e.netteEchec).flatMap((e) => (e.raisonsNettete.length ? e.raisonsNettete : [`Étape ${e.numero} : le texte perd en netteté.`]));
  const agrand = etapes.filter((e) => e.agrandissementEchec).flatMap((e) => (e.raisonsAgrandissement.length ? e.raisonsAgrandissement : [`Étape ${e.numero} : le zoom agrandit l'image au-delà de sa finesse.`]));
  const texte = etapes.filter((e) => e.texteEchec).flatMap((e) => (e.raisonsTexte.length ? e.raisonsTexte : [`Étape ${e.numero} : le plus petit texte montré est trop petit après le zoom.`]));
  const nonMesurees = etapes.filter((e) => e.ssim === null);
  const sansTaille = etapes.filter((e) => !e.lisibiliteVerifiee);
  return [
    ligne(
      "TUT-NETTETE",
      "Netteté du texte dans la vidéo finie",
      nettete,
      vide ? NON_FAIT : nonMesurees.length ? `Étape${nonMesurees.length > 1 ? "s" : ""} ${nonMesurees.map((e) => e.numero).join(", ")} : la netteté n'a pas pu être mesurée.` : null,
      "Le texte reste net sur toutes les étapes mesurées.",
    ),
    ligne("TUT-AGRANDISSEMENT", "Aucun zoom n'agrandit l'image au-delà de sa finesse", agrand, vide ? NON_FAIT : null, "Aucun zoom n'agrandit l'image au-delà de sa finesse."),
    ligne(
      "TUT-TEXTE-APRES-ZOOM",
      "Le plus petit texte reste lisible après le zoom",
      texte,
      vide ? NON_FAIT : sansTaille.length ? "La taille du plus petit texte ou le minimum attendu n'est pas connu : lisibilité non vérifiée." : null,
      "Le plus petit texte montré reste lisible après le zoom.",
    ),
  ];
}

/** Image de sortie de chaque ratio du tutoriel (px). Ratio inconnu : `null`, jamais deviné. */
export function formatDuRatio(ratio: string): FormatSortie | null {
  const table: Record<string, FormatSortie> = {
    "4:5": { largeur: 1080, hauteur: 1350 },
    "9:16": { largeur: 1080, hauteur: 1920 },
    "1:1": { largeur: 1080, hauteur: 1080 },
    "16:9": { largeur: 1920, hauteur: 1080 },
  };
  return Object.prototype.hasOwnProperty.call(table, ratio) ? table[ratio]! : null;
}
