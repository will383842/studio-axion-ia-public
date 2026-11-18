/**
 * BRIQUE VOIX-LONGUE (fiche VL-02, générateur « Vidéo longue », éteint). Lit un long script validé morceau par morceau
 * (5 000 caractères au plus par appel) puis recolle les horodatages. Le fournisseur de voix est un PORT injecté :
 * la brique n'ouvre aucune connexion et ne dépense rien d'elle-même ; l'accord de dépense relève du branchement (VL-07).
 */
import { CARACTERES_MAX_MORCEAU, decouperScript, type ChapitreScript, type MorceauVoix } from "./decoupage";
import { recollerHorodatages, type LectureMorceau, type VoixRecollee } from "./recollage";

export * from "./decoupage";
export * from "./recollage";

/** Port : la voix du double. Rend la lecture d'UN morceau. Fourni par l'appelant (réel, ou factice dans les tests). */
export interface FournisseurVoixLongue {
  lire(morceau: MorceauVoix): Promise<LectureMorceau>;
}

export interface VoixLongueLue extends VoixRecollee {
  morceaux: MorceauVoix[];
  caracteres: number;
}

/** Ce que coûtera la lecture, en quantités (jamais en montant) : appels, caractères. Aucun appel au port. */
export function mesurerVoixLongue(chapitres: ChapitreScript[], max = CARACTERES_MAX_MORCEAU): { morceaux: number; caracteres: number } {
  const m = decouperScript(chapitres, max);
  return { morceaux: m.length, caracteres: m.reduce((s, x) => s + x.texte.length, 0) };
}

/** Lit les morceaux UN PAR UN (jamais en parallèle), dans l'ordre, puis recolle. Une erreur du port s'arrête là. */
export async function lireVoixLongue(
  chapitres: ChapitreScript[],
  fournisseur: FournisseurVoixLongue,
  options: { max?: number; pauseEntreMorceauxSec?: number } = {},
): Promise<VoixLongueLue> {
  const morceaux = decouperScript(chapitres, options.max);
  const lectures: LectureMorceau[] = [];
  for (const m of morceaux) lectures.push(await fournisseur.lire(m));
  return { ...recollerHorodatages(lectures, options.pauseEntreMorceauxSec ?? 0), morceaux, caracteres: morceaux.reduce((s, x) => s + x.texte.length, 0) };
}
