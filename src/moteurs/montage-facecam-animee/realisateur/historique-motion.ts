/**
 * HISTORIQUE DES FAMILLES (`historique-motion.json`, règle R7 du directeur artistique, 15/10).
 *
 * Pour chaque vidéo produite (la plus récente en premier, 5 gardées) : la suite des familles et leurs débuts, les
 * comptes par famille et par type, la durée, et ce que l'historique du réalisateur gardait déjà (types de cartes,
 * entrées, recherches de médias, ouverture). Le réalisateur le lit avant chaque plan (`EntreeRealisateur.historique`) :
 * - R7a : la première famille change d'une vidéo à l'autre (3 dernières) ;
 * - R7b : les 20 premières secondes partagent moins de 50 % de leurs enchaînements avec chacune des 3 dernières ;
 * - R7c : 3 familles au moins absentes de la vidéo précédente ;
 * - R7d : une famille qui a atteint son plafond dans la vidéo précédente perd 1 de plafond ;
 * - R7e : la famille la plus utilisée change d'une vidéo à l'autre.
 * `ajouterAHistoriqueMotion` est PUR ; `lireHistoriqueMotion` / `enregistrerHistoriqueMotion` lisent et écrivent le fichier
 * (un fichier absent ou illisible vaut un historique vide : la première vidéo choisit librement).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { historiqueDuPlan, type HistoriqueVideo } from "./regles";

export const VERSION_HISTORIQUE_MOTION = "historique-motion/1";
/** Vidéos gardées (le réalisateur en lit 5 ; R7 en utilise 3). */
export const VIDEOS_GARDEES = 5;

export interface HistoriqueMotion {
  version: typeof VERSION_HISTORIQUE_MOTION;
  /** La plus récente en premier. */
  videos: HistoriqueVideo[];
}

export const historiqueMotionVide = (): HistoriqueMotion => ({ version: VERSION_HISTORIQUE_MOTION, videos: [] });

/** L'historique avec la vidéo de ce plan en tête (5 vidéos gardées). */
export function ajouterAHistoriqueMotion(h: HistoriqueMotion, plan: PlanFacecamAnimee, titre?: string): HistoriqueMotion {
  return { version: VERSION_HISTORIQUE_MOTION, videos: [historiqueDuPlan(plan, titre), ...h.videos].slice(0, VIDEOS_GARDEES) };
}

/** Lit `historique-motion.json` (absent ou illisible : historique vide). */
export function lireHistoriqueMotion(chemin: string): HistoriqueMotion {
  if (!existsSync(chemin)) return historiqueMotionVide();
  try {
    const x = JSON.parse(readFileSync(chemin, "utf8")) as Partial<HistoriqueMotion>;
    return Array.isArray(x.videos) ? { version: VERSION_HISTORIQUE_MOTION, videos: x.videos.slice(0, VIDEOS_GARDEES) } : historiqueMotionVide();
  } catch {
    return historiqueMotionVide();
  }
}

/** Ajoute la vidéo de ce plan en tête de `historique-motion.json` et rend l'historique écrit. */
export function enregistrerHistoriqueMotion(chemin: string, plan: PlanFacecamAnimee, titre?: string): HistoriqueMotion {
  const h = ajouterAHistoriqueMotion(lireHistoriqueMotion(chemin), plan, titre);
  writeFileSync(chemin, JSON.stringify(h, null, 1));
  return h;
}
