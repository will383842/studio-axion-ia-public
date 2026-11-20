// T-EXT-27 : remplit le crochet vide `relireImagesCles` du contrôle du tableau avec le regardeur COMMUN. PUR, sans import du moteur tableau.
// Rien ne l'appelle encore : le branchement dans la fabrication du tableau est une décision du fondateur (hors de cette fiche).
import { jugerRegard } from "./verdict";
import type { FinAttendue, InstantRegard, LectureRegard, VerdictRegard } from "./types";

/** Forme de `RelectureImagesCles` (`montage-tableau/controles.ts`), recopiée structurellement. */
export interface RelectureImagesClesCommune {
  imagesLues: number;
  remarques: { image: number; raison: string }[];
}

/** Nombre d'images clés relues par le tableau (`IMAGES_CLES_RELUES`) ; comparé à la source par le test. */
export const IMAGES_CLES_MAX = 6;

/** Verdict → relecture. Aucune image relue : LÈVE, pour que l'appelant écrive « non fait » et jamais « rien à signaler ». */
export function versRelectureImagesCles(verdict: VerdictRegard, instants: InstantRegard[]): RelectureImagesClesCommune {
  if (!(verdict.relues > 0)) throw new Error("aucune image relue");
  const ordre = [...instants].sort((a, b) => a.instantSec - b.instantSec);
  const remarques = verdict.defauts
    .filter((d) => d.code !== "non-relue")
    .map((d) => ({ image: ordre.findIndex((i) => i.nom === d.nom) + 1, raison: d.detail }))
    .filter((r) => r.image > 0);
  return { imagesLues: verdict.relues, remarques };
}

export interface DepsRelecteur<A extends unknown[]> {
  instants: (...a: A) => InstantRegard[];
  textesPermis: (...a: A) => string[];
  fin?: (...a: A) => FinAttendue | undefined;
  /** Tirage des images + appel du rôle (payant) : fourni par l'appelant, jamais ici. */
  lire: (instants: InstantRegard[]) => Promise<LectureRegard | null>;
}

/** Instants → `lire` → `jugerRegard` → relecture. Compatible avec `OutilsControleTableau["relireImagesCles"]` pour `A = [FicheTableau, MiseEnPageTableau]`. */
export function relecteurImagesCles<A extends unknown[]>(deps: DepsRelecteur<A>): (...a: A) => Promise<RelectureImagesClesCommune> {
  return async (...a: A) => {
    const instants = deps.instants(...a).slice(0, IMAGES_CLES_MAX);
    const lecture = await deps.lire(instants);
    const verdict = jugerRegard({ instants, lecture, textesPermis: deps.textesPermis(...a), fin: deps.fin?.(...a) });
    return versRelectureImagesCles(verdict, instants);
  };
}
