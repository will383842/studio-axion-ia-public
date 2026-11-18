/**
 * T-EXT-35 : VUE de l'écran « Scènes gardées ». L'index est lu par `lireScenesGardees` (T-EXT-15) ; aucun stockage propre,
 * aucune clé de réglage neuve, aucune écriture hors du service de T-EXT-15. Session exigée. ÉTEINT par défaut (l'index se
 * lit vide tant que `tutoriel.scenesGardees` n'est pas exactement `true`). L'aperçu est calculé ICI : adresse signée du
 * fichier de la vidéo finie (`urlFichier`) + bornes lues dans le plan de la version source ; aucun rendu n'est demandé.
 * Le texte dit d'une scène (paroles de Williams) n'entre dans aucun message d'erreur ni journal.
 */
import "server-only";
import type { Ratio } from "@/domaine/types";
import { etatLicence } from "@/domaine/derivations";
import { INDEX_VIDE, type EntreeScene, type EtatScene } from "@/moteurs/montage-tutoriel-outil/index-scenes";
import { depots, ErreurStudio } from "./_commun";
import { exigerSession } from "./auth";
import { urlFichier } from "./fichiers";
import { PHRASE_SCENES_FERMEES, lireScenesGardees, retirerSceneGardee, validerSceneGardee } from "./scenes-tutoriel";

export { PHRASE_SCENES_FERMEES };

export const PHRASE_SCENE_INCONNUE = "Cette scène n'existe plus.";
export const PHRASE_APERCU_INDISPONIBLE = "Aperçu indisponible";
export const PHRASE_VIDEO_SUPPRIMEE = "Vidéo d'origine supprimée";
export const TITRE_VIDEO_SUPPRIMEE = "Vidéo supprimée";

export interface VueScene {
  cle: string;
  titreVideo: string;
  role: string;
  gabarit?: string;
  sujet: string;
  dureeSec: number;
  etat: EtatScene;
  licence: { utilisable: boolean; copieeLe: string };
  apercu: { url: string; debutSec: number; finSec: number } | null;
  /** Pourquoi il n'y a pas d'aperçu (phrase pour Williams) ; absent quand l'aperçu existe. */
  motifApercu?: string;
}

export interface ListeScenes {
  /** Faux : la bibliothèque de scènes n'est pas ouverte (éteint, ou index illisible). */
  ouverte: boolean;
  scenes: VueScene[];
}

const RATIO_PAR_DEFAUT: Ratio = "4:5";
const arrondiSec = (ms: number): number => Math.round(ms) / 1000;

/** Début du passage dans le plan de la version source (l'index ne le garde pas : son morceau est rebasé à 0). */
function debutDansLePlan(projetMontage: Record<string, unknown> | undefined, sceneId: string): number | null {
  const scenes = ((projetMontage?.tutoriel as { plan?: { plan?: { scenes?: unknown } } } | undefined)?.plan?.plan?.scenes) ?? null;
  if (!Array.isArray(scenes)) return null;
  const scene = scenes.find((s): s is { id: string; debutMs: number } => !!s && typeof s === "object" && (s as { id?: unknown }).id === sceneId);
  return scene && Number.isFinite(scene.debutMs) && scene.debutMs >= 0 ? scene.debutMs : null;
}

type Apercu = Pick<VueScene, "apercu" | "motifApercu">;
const SANS_APERCU = (motifApercu: string): Apercu => ({ apercu: null, motifApercu });

async function apercuDe(e: EntreeScene, videoExiste: boolean): Promise<Apercu> {
  if (!videoExiste) return SANS_APERCU(PHRASE_VIDEO_SUPPRIMEE);
  try {
    const d = depots();
    const version = await d.versions.obtenir(e.versionVideoId);
    if (!version) return SANS_APERCU(PHRASE_APERCU_INDISPONIBLE);
    const sortie = e.sortieId
      ? await d.sorties.obtenir(e.sortieId)
      : ((await d.sorties.lister((s) => s.versionId === e.versionVideoId && s.ratio === RATIO_PAR_DEFAUT))[0] ?? null);
    if (!sortie) return SANS_APERCU(PHRASE_APERCU_INDISPONIBLE);
    const debutMs = debutDansLePlan(version.projetMontage, e.sceneId);
    if (debutMs === null) return SANS_APERCU(PHRASE_APERCU_INDISPONIBLE);
    const url = await urlFichier(sortie.fichierId);
    if (!url) return SANS_APERCU(PHRASE_APERCU_INDISPONIBLE);
    return { apercu: { url, debutSec: arrondiSec(debutMs), finSec: arrondiSec(debutMs + e.dureeMs) } };
  } catch {
    return SANS_APERCU(PHRASE_APERCU_INDISPONIBLE);
  }
}

async function vueDe(e: EntreeScene, titres: Map<string, string | null>): Promise<VueScene> {
  const titre = titres.get(e.videoId) ?? null;
  const { apercu, motifApercu } = await apercuDe(e, titre !== null);
  return {
    cle: e.cle,
    titreVideo: titre ?? TITRE_VIDEO_SUPPRIMEE,
    role: e.role,
    ...(e.gabarit ? { gabarit: e.gabarit } : {}),
    sujet: e.sujet ?? "",
    dureeSec: arrondiSec(e.dureeMs),
    etat: e.etat,
    licence: { utilisable: etatLicence(e.licence) === "ok", copieeLe: e.licenceCopieeLe },
    apercu,
    ...(motifApercu ? { motifApercu } : {}),
  };
}

/** Les scènes gardées avec leur aperçu. Éteint : liste vide et `ouverte: false`. Session exigée. */
export async function lireListeScenes(): Promise<ListeScenes> {
  await exigerSession();
  const index = await lireScenesGardees();
  // `lireScenesGardees` rend `INDEX_VIDE` lui-même (jamais une copie) quand c'est éteint ou illisible.
  if (index === INDEX_VIDE) return { ouverte: false, scenes: [] };
  const titres = new Map<string, string | null>();
  for (const id of new Set(index.entrees.map((e) => e.videoId))) titres.set(id, (await depots().videos.obtenir(id))?.titre ?? null);
  return { ouverte: true, scenes: await Promise.all(index.entrees.map((e) => vueDe(e, titres))) };
}

export async function listerScenesGardees(): Promise<VueScene[]> {
  return (await lireListeScenes()).scenes;
}

async function etatDe(cle: string): Promise<EtatScene> {
  const index = await lireScenesGardees();
  if (index === INDEX_VIDE) throw new ErreurStudio("FONCTION_FERMEE", PHRASE_SCENES_FERMEES);
  const e = index.entrees.find((x) => x.cle === cle);
  if (!e) throw new ErreurStudio("SCENE_INCONNUE", PHRASE_SCENE_INCONNUE);
  return e.etat;
}

/** « Retirer » : la scène est mise de côté pour toujours (jamais supprimée). */
export async function retirer(cle: string): Promise<void> {
  await exigerSession();
  const etat = await etatDe(cle);
  if (etat === "retiree") throw new ErreurStudio("SCENE_DEJA_RETIREE", "Cette scène est déjà retirée.");
  await retirerSceneGardee(cle);
}

/** « Garder pour d'autres vidéos » : brouillon → validée. */
export async function garder(cle: string): Promise<void> {
  await exigerSession();
  const etat = await etatDe(cle);
  if (etat !== "brouillon") throw new ErreurStudio("SCENE_DEJA_TRAITEE", etat === "retiree" ? "Cette scène est retirée : elle ne peut plus être gardée." : "Cette scène est déjà gardée.");
  await validerSceneGardee(cle);
}
