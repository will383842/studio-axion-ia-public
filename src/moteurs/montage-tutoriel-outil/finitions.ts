/**
 * FINITIONS DU TUTORIEL D'OUTIL (T-EXT-31) — pur : aucun import de service, ne lève jamais.
 * Son −14 LUFS réellement appliqué (`mixage`) puis mesuré (`mesure-son`), vignette (`miniature`) : trois opérations de
 * NOTRE serveur `studio-rendu`, gratuites. Allumé par le réglage `tutoriel.finitions` (absent = éteint).
 * Ce fichier ne fait que décider : cible, paramètres des trois opérations, lecture d'une mesure, vérité du rapport.
 */
import type { CommandeFabrication, Ratio } from "@/domaine/types";

export const CIBLE_LUFS_DEFAUT = -14;
export const CRETE_MAX_DEFAUT_DBTP = -1.5;
/** Même valeur que la tolérance de l'opération `mixage` (`studio-rendu/src/operations/mixage.ts:35`) : copiée, pas importée. */
export const TOLERANCE_LUFS_TUTORIEL = 0.5;

export interface CibleSon {
  lufs: number;
  creteVraieMaxDbtp: number;
}

const fini = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Cible du profil son de la commande (lu comme `briques/composition/parametres.ts`, sans l'importer), sinon les défauts. */
export function cibleSon(commande: Pick<CommandeFabrication, "styles">): CibleSon {
  const ps = commande.styles?.profilSon?.valeur;
  return {
    lufs: fini(ps?.niveauCibleLufs) ? ps.niveauCibleLufs : CIBLE_LUFS_DEFAUT,
    creteVraieMaxDbtp: fini(ps?.creteVraieMaxDbtp) ? ps.creteVraieMaxDbtp : CRETE_MAX_DEFAUT_DBTP,
  };
}

/** `dureeSec` = durée de la VOIX (jamais celle de la composition : sinon du silence serait ajouté puis remesuré). */
export function parametresMixage(cible: CibleSon, dureeSec: number): Record<string, unknown> {
  return { lufs: cible.lufs, creteVraieMaxDbtp: cible.creteVraieMaxDbtp, ...(fini(dureeSec) && dureeSec > 0 ? { dureeSec } : {}) };
}

export function parametresMesure(): Record<string, unknown> {
  return { pauses: [] };
}

/** Vignette : vraie image du début de la vidéo, JAMAIS de `couverture` (aucun titre posé par le Studio). */
export function parametresVignette(ratio: Ratio, dureeSec: number): Record<string, unknown> {
  return { gabarit: "image-video-v3", ratio, dureeSec, instantSec: 0 };
}

export interface MesureSon {
  lufs: number;
  creteVraieDbtp?: number;
}

export function lireMesure(mesures: unknown): MesureSon | null {
  if (!mesures || typeof mesures !== "object") return null;
  const m = mesures as Record<string, unknown>;
  if (!fini(m.lufs)) return null;
  return { lufs: m.lufs, ...(fini(m.creteVraieDbtp) ? { creteVraieDbtp: m.creteVraieDbtp } : {}) };
}

export interface RapportSon {
  niveauSonoreLufs: number;
  sonVerifie: boolean;
  alerte?: string;
  /** « attention » seulement si une mesure existe, la vidéo a une voix et le son est hors tolérance ; sinon « info ». */
  gravite?: "attention" | "info";
}

const dixieme = (n: number) => Math.round(n * 10) / 10;
const virgule = (n: number) => String(n).replace(".", ",").replace("-", "−");

/** Ce que le rapport peut affirmer du son : la valeur mesurée, jamais un chiffre écrit en dur. */
export function rapportSon(mesure: MesureSon | null, cible: CibleSon, avecVoix: boolean): RapportSon {
  // Sans voix, aucun niveau n'est mesuré : `RapportQualite.niveauSonoreLufs` est obligatoire (type du domaine), on y met donc la cible,
  // et `sonVerifie` reste faux ; l'alerte le dit en toutes lettres pour que la cible ne passe pas pour une mesure.
  if (!avecVoix) return { niveauSonoreLufs: cible.lufs, sonVerifie: false, alerte: "Son : vidéo sans voix, aucun niveau mesuré (la valeur affichée est la cible)", gravite: "info" };
  if (!mesure) return { niveauSonoreLufs: cible.lufs, sonVerifie: false, alerte: "À vérifier · Son : niveau non mesuré (la valeur affichée est la cible)", gravite: "info" };
  const niveau = dixieme(mesure.lufs);
  const niveauOk = Math.abs(mesure.lufs - cible.lufs) <= TOLERANCE_LUFS_TUTORIEL;
  const creteOk = mesure.creteVraieDbtp === undefined || mesure.creteVraieDbtp <= cible.creteVraieMaxDbtp;
  if (niveauOk && creteOk) return { niveauSonoreLufs: niveau, sonVerifie: true };
  const alerte = niveauOk
    ? `À vérifier · Son : crête mesurée ${virgule(dixieme(mesure.creteVraieDbtp!))} dBTP, au-dessus du maximum ${virgule(cible.creteVraieMaxDbtp)}`
    : `À vérifier · Son : niveau mesuré ${virgule(niveau)} LUFS, attendu ${virgule(cible.lufs)}`;
  return { niveauSonoreLufs: niveau, sonVerifie: false, alerte, gravite: "attention" };
}
