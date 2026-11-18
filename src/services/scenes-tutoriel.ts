/**
 * T-EXT-15 : SCÈNES GARDÉES, lecture et écriture de l'index (JSON dans un réglage du studio). Serveur seulement.
 * ÉTEINT PAR DÉFAUT : sans `tutoriel.scenesGardees` à exactement `true`, l'index se lit vide et chaque geste est refusé,
 * sans aucune écriture. Aucun appel payant, aucun fichier. AUCUN appelant en production : le rangement après la validation
 * et l'écran viennent d'autres fiches (T-EXT-56, T-EXT-35). `texteDit` (paroles de Williams) n'entre jamais dans le journal.
 */
import "server-only";
import { ecrireParametre, creerVerrou, ErreurStudio, journaliser, lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import {
  INDEX_VIDE,
  lireIndexScenes,
  rangerScenes,
  retirerScene,
  validerScene,
  type IndexScenes,
  type MetaRangement,
  type ResultatEtat,
} from "@/moteurs/montage-tutoriel-outil/index-scenes";
import type { MorceauPlan } from "@/moteurs/montage-tutoriel-outil/decoupage-scenes";

/** Interrupteur : seul `true` exact allume. */
export const PARAM_SCENES_TUTORIEL = "tutoriel.scenesGardees";
/** Stockage de l'index par réglage (comme `PARAM_ECRANS_FOURNIS`). */
export const PARAM_INDEX_SCENES = "tutoriel.index-scenes";
export const PHRASE_SCENES_FERMEES = "La bibliothèque de scènes n'est pas ouverte pour le moment.";

const verrou = creerVerrou();

async function allume(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_SCENES_TUTORIEL, false)) === true;
  } catch {
    return false;
  }
}

async function exigerOuvert(): Promise<void> {
  if (!(await allume())) throw new ErreurStudio("FONCTION_FERMEE", PHRASE_SCENES_FERMEES);
}

/** L'index tel qu'écrit ; `null` si illisible (le journal ne garde que des comptes). */
async function lireStocke(): Promise<IndexScenes | null> {
  const brut = await lireParametre<unknown>(PARAM_INDEX_SCENES, INDEX_VIDE);
  const lu = lireIndexScenes(brut);
  if (lu.ok) return lu.index;
  await journaliser("tutoriel", `Index des scènes illisible : ${lu.erreurs.length} erreur(s), rien n'est lu.`);
  return null;
}

/** Les scènes gardées. Éteint ou illisible : index vide. */
export async function lireScenesGardees(): Promise<IndexScenes> {
  if (!(await allume())) return INDEX_VIDE;
  try {
    return (await lireStocke()) ?? INDEX_VIDE;
  } catch {
    return INDEX_VIDE;
  }
}

/** Lit pour modifier : un index illisible n'est jamais écrasé. */
async function lirePourEcrire(): Promise<IndexScenes> {
  const index = await lireStocke();
  if (!index) throw new ErreurStudio("INDEX_ILLISIBLE", "L'index des scènes est illisible : rien n'a été modifié.");
  return index;
}

async function ecrire(index: IndexScenes): Promise<void> {
  // Ce qu'on écrit doit se relire : sinon rien n'est écrit.
  const relu = lireIndexScenes(index);
  if (!relu.ok) throw new ErreurStudio("INDEX_REFUSE", relu.erreurs[0] ?? "Index refusé.");
  await ecrireParametre(PARAM_INDEX_SCENES, relu.index);
}

export interface EntreeRangement {
  morceaux: readonly MorceauPlan[];
  meta: MetaRangement;
}

/** Range les morceaux d'une vidéo en brouillon (aucune session : appelé par la fabrication, plus tard). */
export async function rangerScenesDeVideo(entree: EntreeRangement): Promise<IndexScenes> {
  await exigerOuvert();
  return verrou(async () => {
    await exigerOuvert();
    const avant = await lirePourEcrire();
    const apres = rangerScenes(avant, entree.morceaux, entree.meta);
    const ajoutees = apres.entrees.length - avant.entrees.length;
    if (ajoutees > 0) {
      await ecrire(apres);
      await journaliser("tutoriel", `Scènes gardées : ${ajoutees} en brouillon (vidéo ${entree.meta.videoId}).`, { type: "video", id: entree.meta.videoId });
    }
    return apres;
  });
}

async function geste(cle: string, nom: "validée" | "retirée", f: (i: IndexScenes, c: string, le: string) => ResultatEtat): Promise<IndexScenes> {
  await exigerSession();
  await exigerOuvert();
  return verrou(async () => {
    await exigerOuvert();
    const r = f(await lirePourEcrire(), cle, new Date().toISOString());
    if (!r.ok) throw new ErreurStudio("SCENE_REFUSEE", r.erreur);
    await ecrire(r.index);
    await journaliser("tutoriel", `Scène ${nom} : ${cle}.`);
    return r.index;
  });
}

/** Geste de Williams : brouillon → validée. */
export const validerSceneGardee = (cle: string) => geste(cle, "validée", validerScene);
/** Geste de Williams : brouillon ou validée → retirée (jamais supprimée). */
export const retirerSceneGardee = (cle: string) => geste(cle, "retirée", retirerScene);
