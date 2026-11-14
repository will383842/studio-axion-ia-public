/**
 * L5-07 · lecture et écriture des deux interrupteurs de la publication (Envoi automatique, Premier commentaire).
 * Serveur seulement, aucun appel réseau ni payant. Seul le booléen exact `true` compte (voir le registre).
 */
import "server-only";
import { INTERRUPTEURS_PUBLICATION, interrupteurAllume, trouverInterrupteurPublication, valeurReglage, type IdInterrupteurPublication } from "@/domaine/interrupteurs/registre";
import { depots, ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";

export interface EtatInterrupteurPublication {
  id: IdInterrupteurPublication;
  libelle: string;
  allume: boolean;
  phrase: string;
  /** Date du dernier changement (ISO), absente si jamais touché. */
  modifieLe?: string;
}

async function lireBrut(cle: string): Promise<unknown> {
  try {
    return await lireParametre<unknown>(cle, false);
  } catch {
    return false;
  }
}

export async function lireInterrupteursPublication(): Promise<EtatInterrupteurPublication[]> {
  const etats: EtatInterrupteurPublication[] = [];
  for (const def of INTERRUPTEURS_PUBLICATION) {
    const allume = interrupteurAllume(def, await lireBrut(def.cle));
    let modifieLe: string | undefined;
    try {
      modifieLe = (await depots().parametres.obtenir(def.cle))?.modifieLe;
    } catch {
      modifieLe = undefined;
    }
    etats.push({ id: def.id, libelle: def.libelle, allume, phrase: allume ? def.phraseAllume : def.phraseEteint, modifieLe });
  }
  return etats;
}

export async function definirInterrupteurPublication(id: unknown, allume: unknown): Promise<{ id: IdInterrupteurPublication; allume: boolean }> {
  await exigerSession();
  const def = trouverInterrupteurPublication(id);
  if (!def) throw new ErreurStudio("CHOIX_INCONNU", "Ce réglage n'existe pas.");
  if (allume !== true && allume !== false) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
  await ecrireParametre(def.cle, valeurReglage(def, allume));
  await journaliser("reglages", `${def.libelle} : ${allume ? "allumé" : "éteint"}`);
  return { id: def.id, allume };
}
