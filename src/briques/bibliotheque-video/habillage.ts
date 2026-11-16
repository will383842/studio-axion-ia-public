/**
 * Adaptateur pur (C6-H0b) : profil de la bibliothèque → plafonds de l'habillage commun.
 * Rien ne l'appelle encore ; aucun interrupteur. Côté Studio seulement.
 */
import { PLAFONDS_PAR_DEFAUT, type PlafondsHabillage } from "../motion/habillage-commun/types";
import type { ProfilVideo } from "./types";

const PART_MIN = 0.9;

const entierValide = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const booleen = (v: unknown, repli: boolean): boolean => (typeof v === "boolean" ? v : repli);

export function plafondsDepuisProfil(profil: ProfilVideo | null | undefined): PlafondsHabillage {
  const repli = PLAFONDS_PAR_DEFAUT;
  if (!profil) return { ...repli };
  const bloc = profil.blocs?.habillage;
  const transitions = profil.plafonds?.transitionsMax;
  const part = bloc?.partCoupesFranchesMin;
  return {
    transitionsRichesMax: entierValide(transitions) ? transitions : repli.transitionsRichesMax,
    partCoupesFranchesMin: typeof part === "number" && Number.isFinite(part) && part <= 1 ? Math.max(part, PART_MIN) : repli.partCoupesFranchesMin,
    pleinCadrePermis: booleen(bloc?.pleinCadrePermis, repli.pleinCadrePermis),
    fondsAnimes: booleen(bloc?.fondsAnimes, repli.fondsAnimes),
    lumieres: booleen(bloc?.lumieres, repli.lumieres),
  };
}
