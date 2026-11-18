/**
 * RETOUCHE SANS TOUT REFAIRE (T-EXT-52a) — décisions PURES : quel film reprendre, quels formats refaire, quelles
 * plages d'images rendre. Aucun appel, aucun rendu, aucune écriture : 0 €. Éteint tant que rien ne l'appelle (52b).
 * L'empreinte d'un format est celle de l'export partiel commun (R4) : une seule fonction, jamais recopiée.
 */
import { empreinteExport } from "@/briques/export-partiel";
import { fnv1a64, jsonCanonique } from "@/briques/plan-scenes/empreinte";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { Ratio } from "@/domaine/types";

/** Film de navigation (forme lue dans les entrées, T-EXT-38 ; empreinte de T-EXT-03b). Types recopiés, aucun import d'`outils/`. */
export interface FilmTutoriel {
  videoCle: string;
  empreinte: string;
}

const INCONNU = "inconnu";

/** Vrai seulement si les deux empreintes existent, sont égales et connues : le film d'avant sert tel quel. */
export function filmReutilisable(parent?: FilmTutoriel, nouveau?: FilmTutoriel): boolean {
  if (!parent?.empreinte || !nouveau?.empreinte) return false;
  if (parent.empreinte === INCONNU || nouveau.empreinte === INCONNU) return false;
  return parent.empreinte === nouveau.empreinte;
}

export interface EffetsFilm {
  reglagesFilm?: unknown;
  cran?: string;
  basculeMs?: number;
  film?: FilmTutoriel;
}

/** Empreinte de ce qui change l'image du film SANS le refilmer. Rien de tout cela fourni = "" (comportement d'aujourd'hui). */
export function empreinteEffetsFilm(e: EffetsFilm): string {
  if (e.reglagesFilm === undefined && e.cran === undefined && e.basculeMs === undefined && e.film === undefined) return "";
  return fnv1a64(jsonCanonique({ reglagesFilm: e.reglagesFilm, cran: e.cran, basculeMs: e.basculeMs, film: e.film }));
}

/**
 * Empreinte d'un format. `planDuRatio` est DÉJÀ ramené au ratio par l'appelant (aucun import de `chaine.ts`).
 * La fin commune et les effets du film y entrent : sinon un changement de fin ne referait rien.
 */
export function empreinteFormat(planDuRatio: PlanValide, ratio: Ratio, e: { voix: string; effetsFilm: string; fin: string }): string {
  return empreinteExport(planDuRatio, { id: ratio, format: ratio }, [e.voix, e.effetsFilm, e.fin].join("|"));
}

export interface FormatsARefaire {
  aRefaire: Ratio[];
  gardes: Ratio[];
  phrase: string;
}

function liste(ratios: Ratio[]): string {
  return ratios.length <= 1 ? (ratios[0] ?? "") : `${ratios.slice(0, -1).join(", ")} et ${ratios[ratios.length - 1]}`;
}

/** Sans empreintes d'avant : tout est refait. Sinon seuls les formats dont l'empreinte change. */
export function formatsARefaire(avant: Partial<Record<Ratio, string>> | undefined, apres: Partial<Record<Ratio, string>>, demandes: Ratio[]): FormatsARefaire {
  const aRefaire: Ratio[] = [];
  const gardes: Ratio[] = [];
  for (const r of demandes) {
    const ancienne = avant?.[r];
    (ancienne === undefined || ancienne !== apres[r] ? aRefaire : gardes).push(r);
  }
  const phrase =
    aRefaire.length === 0
      ? "Aucun format n'est à refaire : tous sont repris tels quels."
      : gardes.length === 0
        ? aRefaire.length === 1
          ? `Le format ${aRefaire[0]} sera refait.`
          : `Les formats ${liste(aRefaire)} seront refaits.`
        : `${aRefaire.length === 1 ? "Le format" : "Les formats"} ${liste(aRefaire)} ${aRefaire.length === 1 ? "sera refait" : "seront refaits"} ; ${liste(gardes)} ${gardes.length === 1 ? "est repris tel quel" : "sont repris tels quels"}.`;
  return { aRefaire, gardes, phrase };
}

export { plagesARerendre } from "@/briques/rendu-par-plages";
export type { PlageImages, PlagesARerendre } from "@/briques/rendu-par-plages";
