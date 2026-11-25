/**
 * MINUTAGE SANS VOIX DE LA VIDÉO LONGUE (lot QUALL-1) — PUR. Une seule horloge pour l'écran, la création et la fabrication :
 * carton de titre (si la question existe), puis par chapitre un carton, chaque phrase (lecture + respiration), puis la fin.
 * Constantes : `TEMPS_LONGUE` du contrat du story-board.
 */
import type { MotHorodate } from "@/domaine/types";
import type { ChapitreWeb } from "@/domaine/site-videos/types";
import { decouperEnPhrases, dureeChapitreMs, dureePhraseMs, titreDeduit, titreManquant } from "./decoupage";
import { TEMPS_LONGUE } from "./storyboard-types";

export interface EntreesMinutage {
  chapitres: readonly { titre?: string; texte: string }[];
  /** Question de la vidéo : si elle existe, un carton de titre ouvre la vidéo. */
  question?: string;
}

export interface MinutageSansVoix {
  mots: MotHorodate[];
  dureeSec: number;
  /** Chapitres YouTube : chacun commence sur son carton (le premier à 0), le dernier finit à `dureeSec`. */
  chapitres: ChapitreWeb[];
}

/** Durée d'un chapitre sans voix (carton + phrases), en millisecondes. Cartons de titre et de fin non compris. */
export const dureeChapitreSansVoixMs = (texte: string): number => dureeChapitreMs(texte);

const dixieme = (sec: number): number => Math.round(sec * 10) / 10;

export function minuterSansVoix(entrees: EntreesMinutage): MinutageSansVoix {
  const mots: MotHorodate[] = [];
  const debuts: number[] = [];
  let t = entrees.question?.trim() && entrees.chapitres.length > 0 ? TEMPS_LONGUE.cartonTitreMs : 0;
  for (const c of entrees.chapitres) {
    debuts.push(t);
    t += TEMPS_LONGUE.cartonChapitreMs;
    for (const phrase of decouperEnPhrases(c.texte)) {
      const liste = phrase.split(/\s+/).filter(Boolean);
      const duree = dureePhraseMs(liste.length);
      const pas = duree / liste.length;
      liste.forEach((mot, k) => mots.push({ mot, debutSec: Math.round(t + k * pas) / 1000, finSec: Math.round(t + (k + 1) * pas) / 1000 }));
      t += duree + TEMPS_LONGUE.respirationMs;
    }
  }
  if (entrees.chapitres.length > 0) t += TEMPS_LONGUE.finMs;
  const dureeSec = dixieme(t / 1000);
  const chapitres = entrees.chapitres.map((c, i): ChapitreWeb => ({
    debutSec: i === 0 ? 0 : dixieme(debuts[i] / 1000),
    finSec: i + 1 < debuts.length ? dixieme(debuts[i + 1] / 1000) : dureeSec,
    libelle: titreManquant(c.titre) ? titreDeduit(c.texte) : (c.titre as string).trim(),
    blocRecette: "chapitres",
  }));
  return { mots, dureeSec, chapitres };
}
