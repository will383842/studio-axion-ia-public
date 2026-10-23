/**
 * MÉMOIRE COMMUNE DANS L'ÉCRITURE DU TABLEAU (lot C2). Branche la mémoire anti-copie du lot C1 (`memoire-ecriture.ts`) derrière
 * le réglage `ecriture.memoireTableau`, COUPÉ par défaut : coupé, rien n'est lu, rien n'est ajouté au prompt, rien ne change.
 *  - avant l'écriture : un bloc court (séquences déjà dites, accroches récentes) pour la partie VARIABLE du message, jamais le
 *    cache du prompt ;
 *  - après l'écriture : la ressemblance avec les récents, en ALERTE seulement (aucune relance payée) ;
 *  - un script collé par Will (origine « will ») est pris tel quel : ni lecture, ni contrôle, ni mémoire ;
 *  - l'enregistrement d'un script accepté est sa trace livrée (la mémoire lit les traces `livre`) ; l'avocat n'y entre jamais ;
 *  - tout échec (base indisponible) est silencieux : l'écriture continue sans mémoire.
 * Pas de tirage de l'appel ici : l'appel du tableau est imposé par la demande (`fin`), aucun `g % n` à remplacer.
 */
import "server-only";
import { ENTETE_BLOC_MEMOIRE, MEMOIRE_MAX_CARACTERES } from "@/domaine/ecriture-commune/memoire";
import { controlerRessemblance } from "@/domaine/ecriture-commune/ressemblance";
import { QUESTIONS_IA } from "@/domaine/scripts-tableau";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";
import type { ScriptTableau } from "@/domaine/scripts-tableau";
import type { Id } from "@/domaine/types";
import { lireParametre } from "../_commun";

export const PARAM_MEMOIRE_TABLEAU = "ecriture.memoireTableau";

/** Accroches récentes montrées au plus, et leur longueur (caractères). */
export const ACCROCHES_RECENTES_MAX = 5;
export const ACCROCHE_RECENTE_CARACTERES = 140;
/** Taille au pire du bloc (jetons de l'estimation du coût) : séquences plafonnées, accroches, en-têtes. */
export const CARACTERES_BLOC_MAX = MEMOIRE_MAX_CARACTERES + ACCROCHES_RECENTES_MAX * (ACCROCHE_RECENTE_CARACTERES + 8) + 200;

/**
 * Phrases IMPOSÉES (question sur l'IA mot pour mot, phrase sur l'entreprise, demande) : elles reviennent dans presque chaque
 * script. Jamais dans la mémoire ni dans la mesure de ressemblance, sinon « Ressemblance forte » partout et un bloc
 * « À NE PAS REDIRE » qui contredit la consigne « MOT POUR MOT ».
 */
export const PHRASES_IMPOSEES: readonly string[] = [...QUESTIONS_IA, "le met en place pour vous", "Réservez un appel de diagnostic"];

/** Le texte dit d'un script SANS le passage `appel` (question IA, phrase entreprise, demande : imposés, hors mémoire). */
export const texteSansAppel = (script: ScriptTableau): string => texteDitDe({ ...script, appel: [] });

export interface MemoireTableau {
  /** Scripts récents, anonymisés (pour mesurer la ressemblance). */
  scripts: string[];
  /** Le bloc à ajouter à la partie variable du message d'écriture ; jamais vide. */
  bloc: string;
}

/** Réglage coupé par défaut ; illisible : coupé. */
export async function memoireTableauAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_MEMOIRE_TABLEAU, false)) === true;
  } catch {
    return false;
  }
}

/** Les premières phrases (accroches) des derniers scripts, les plus récentes d'abord, sans doublon. */
export function accrochesRecentes(scripts: readonly string[]): string[] {
  const res: string[] = [];
  for (const s of [...scripts].reverse()) {
    const premiere = (s.trim().split(/(?<=[.!?…])\s+/)[0] ?? "").trim();
    const a = premiere.length > ACCROCHE_RECENTE_CARACTERES ? `${premiere.slice(0, ACCROCHE_RECENTE_CARACTERES).trimEnd()} …` : premiere;
    if (a && !res.includes(a)) res.push(a);
    if (res.length >= ACCROCHES_RECENTES_MAX) break;
  }
  return res;
}

/** Le bloc de la partie variable (PUR) ; vide sans séquence ni accroche. */
export function blocTableau(blocSequences: string, accroches: readonly string[]): string {
  const parties: string[] = [];
  if (blocSequences) parties.push(`${ENTETE_BLOC_MEMOIRE}\n${blocSequences}`);
  if (accroches.length) parties.push(`ACCROCHES RÉCENTES (ouvrez autrement) :\n${accroches.map((a) => `- « ${a} »`).join("\n")}`);
  return parties.join("\n\n");
}

/** La mémoire de l'écriture en cours, hors la vidéo elle-même ; `null` si elle est vide ou si la base ne répond pas (jamais d'exception). */
export async function memoireDuTableau(sauf?: Id): Promise<MemoireTableau | null> {
  try {
    const { memoireEcriture } = await import("../memoire-ecriture");
    const m = await memoireEcriture({ sauf, tolere: PHRASES_IMPOSEES });
    const bloc = blocTableau(m.bloc, accrochesRecentes(m.scripts));
    return bloc ? { scripts: m.scripts, bloc } : null;
  } catch (erreur) {
    console.error("[tableau] mémoire d'écriture illisible, l'écriture continue sans elle", erreur instanceof Error ? erreur.name : "erreur");
    return null;
  }
}

/** Ressemblance forte avec un script récent : la phrase d'alerte, sinon `null`. ALERTE seulement, jamais un refus ni une relance. */
export function alerteRessemblance(texte: string, recents: readonly string[]): string | null {
  try {
    const r = controlerRessemblance({ texte, anciens: recents, origine: "claude", exclusions: PHRASES_IMPOSEES });
    if (!r.controle || !r.ressemble) return null;
    return `Ressemblance forte avec un script récent : ${r.copies.length} reprise${r.copies.length > 1 ? "s" : ""}, ${r.paraphrases.length} paraphrase${r.paraphrases.length > 1 ? "s" : ""} (alerte seulement, le script est livré).`;
  } catch {
    return null;
  }
}
