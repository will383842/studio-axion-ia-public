// VL-01 — vérification des chapitres YouTube (PUR, 0 €). Des REMARQUES, jamais un refus ni un blocage.
import { horodatageChapitre } from "@/domaine/site-videos/youtube";
import type { ChapitreWeb } from "@/domaine/site-videos/types";

/** Règles YouTube : premier chapitre à 0:00, au moins 3 chapitres, chacun d'au moins 10 s. */
export const CHAPITRES_MIN = 3;
export const DUREE_MIN_CHAPITRE_SEC = 10;

export type CodeRemarqueChapitres = "premier-pas-a-zero" | "moins-de-trois" | "chapitre-trop-court";

export interface RemarqueChapitres {
  code: CodeRemarqueChapitres;
  /** Phrase de remarque, au vouvoiement. Information seulement : rien n'est refusé. */
  message: string;
  /** Rang (à partir de 1) du chapitre concerné, s'il y en a un. */
  chapitre?: number;
}

/** Vérifie les chapitres ; la liste vide veut dire « conforme ». Ne modifie rien, ne lève jamais d'erreur. */
export function verifierChapitres(chapitres: readonly ChapitreWeb[]): RemarqueChapitres[] {
  const remarques: RemarqueChapitres[] = [];
  if (chapitres.length === 0) {
    return [{ code: "moins-de-trois", message: `YouTube demande au moins ${CHAPITRES_MIN} chapitres : votre vidéo n'en a pas encore.` }];
  }
  if (chapitres[0].debutSec !== 0) {
    remarques.push({
      code: "premier-pas-a-zero",
      chapitre: 1,
      message: `YouTube veut que le premier chapitre commence à 0:00 ; le vôtre commence à ${horodatageChapitre(chapitres[0].debutSec)}.`,
    });
  }
  if (chapitres.length < CHAPITRES_MIN) {
    remarques.push({
      code: "moins-de-trois",
      message: `YouTube demande au moins ${CHAPITRES_MIN} chapitres : votre vidéo en a ${chapitres.length}.`,
    });
  }
  chapitres.forEach((c, i) => {
    const duree = c.finSec - c.debutSec;
    if (duree < DUREE_MIN_CHAPITRE_SEC) {
      remarques.push({
        code: "chapitre-trop-court",
        chapitre: i + 1,
        message: `Votre chapitre ${i + 1} dure ${Math.max(0, Math.round(duree))} s ; YouTube en demande au moins ${DUREE_MIN_CHAPITRE_SEC}.`,
      });
    }
  });
  return remarques;
}
