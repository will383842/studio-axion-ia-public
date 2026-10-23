/**
 * Réglages › Écriture des scripts : 4 interrupteurs, tous éteints par défaut. Liste blanche de 4 clés ; seul le booléen exact
 * `true` allume (même lecture que les services concernés). Serveur seulement, aucun appel payant.
 */
import "server-only";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { ADAPTATIONS_BRANCHEES } from "@/reseaux/branchement-adaptations";

export const CLES_INTERRUPTEURS_ECRITURE = ["ecriture.memoireCentrale", "ecriture.memoireTableau", "ecriture.memoireCasConcret", "adaptations_reseaux.actif"] as const;
export type CleInterrupteurEcriture = (typeof CLES_INTERRUPTEURS_ECRITURE)[number];
export type EtatInterrupteursEcriture = Record<CleInterrupteurEcriture, boolean>;

const LIBELLES: Record<CleInterrupteurEcriture, string> = {
  "ecriture.memoireCentrale": "Variété des scripts centraux",
  "ecriture.memoireTableau": "Variété des tableaux",
  "ecriture.memoireCasConcret": "Variété des cas concrets",
  "adaptations_reseaux.actif": "Adaptation par réseau",
};

export const estCleInterrupteurEcriture = (v: unknown): v is CleInterrupteurEcriture => typeof v === "string" && (CLES_INTERRUPTEURS_ECRITURE as readonly string[]).includes(v);

async function lire(cle: CleInterrupteurEcriture): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(cle, false)) === true;
  } catch {
    return false;
  }
}

export async function lireInterrupteursEcriture(): Promise<EtatInterrupteursEcriture> {
  const etat = {} as EtatInterrupteursEcriture;
  for (const cle of CLES_INTERRUPTEURS_ECRITURE) etat[cle] = await lire(cle);
  return etat;
}

export async function definirInterrupteurEcriture(cle: unknown, valeur: unknown): Promise<{ cle: CleInterrupteurEcriture; valeur: boolean }> {
  await exigerSession();
  if (!estCleInterrupteurEcriture(cle)) throw new ErreurStudio("CHOIX_INCONNU", "Ce réglage n'existe pas.");
  if (valeur !== true && valeur !== false) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
  if (valeur && cle === "adaptations_reseaux.actif" && !ADAPTATIONS_BRANCHEES) throw new ErreurStudio("PAS_BRANCHE", "Pas encore actif : en cours de branchement.");
  if ((await lire(cle)) === valeur && (await lireParametre<unknown>(cle, null)) === valeur) return { cle, valeur }; // double clic : rien de plus
  await ecrireParametre(cle, valeur);
  await journaliser("reglages", `${LIBELLES[cle]} : ${valeur ? "allumé" : "éteint"}`);
  return { cle, valeur };
}
