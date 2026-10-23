/**
 * MÉMOIRE COMMUNE BRANCHÉE DANS L'ÉCRITURE CENTRALE (lot C3). PUR : le service lit la base et passe la mémoire à la chaîne
 * courte en option. Sans mémoire (réglage coupé, base illisible, mémoire vide), la chaîne ne change pas d'un octet.
 * Règles : un script collé par Will (origine « will ») est pris à l'identique, jamais contrôlé ni mis à éviter ; les textes de
 * l'avocat n'entrent jamais dans la mémoire commune ni ne la lisent.
 */
import { ENTETE_BLOC_MEMOIRE } from "@/domaine/ecriture-commune/memoire";
import { FORMATS_HORS_CONTRAT } from "@/domaine/ecriture-commune/contrat-format";
import { controlerRessemblance, type OrigineScript } from "@/domaine/ecriture-commune/ressemblance";

/** Identifiant du contrôle de ressemblance dans les violations d'une version (alerte, jamais bloquante). */
export const CONTROLE_RESSEMBLANCE = "RESSEMBLANCE";

export interface MemoireCentrale {
  /** Séquences déjà dites, lignes « - « … » » (vide : rien à injecter). */
  bloc: string;
  /** Scripts récents (anonymisés), pour mesurer la ressemblance. */
  anciens: readonly string[];
  /** Codes des appels de fin récemment tirés, du plus ancien au plus récent (tirage sans récents). */
  appelsRecents?: readonly string[];
  /** Absente : « claude ». « will » : script collé, jamais contrôlé. */
  origine?: OrigineScript;
}

/** La mémoire commune s'applique-t-elle à ce texte ? Non pour l'avocat et pour un script de Will. */
export function memoireCentraleApplicable(formatId: string, origine: OrigineScript = "claude"): boolean {
  return origine !== "will" && !FORMATS_HORS_CONTRAT.includes(formatId);
}

/** La mémoire à utiliser pour ce format, ou rien. */
export function memoireDuFormat(memoire: MemoireCentrale | undefined, formatId: string): MemoireCentrale | undefined {
  return memoire && memoireCentraleApplicable(formatId, memoire.origine) ? memoire : undefined;
}

/** Ligne à ajouter à la partie VARIABLE de la consigne ; chaîne vide sans bloc (aucun octet de plus). */
export function ajoutVariable(memoire: MemoireCentrale | undefined): string {
  return memoire?.bloc.trim() ? `${ENTETE_BLOC_MEMOIRE}\n${memoire.bloc}` : "";
}

export interface RessemblanceCentrale {
  forte: boolean;
  message: string;
}

/** Mesure un script écrit contre les récents. Forte = une copie ou une paraphrase (le moule seul n'est qu'un signal). */
export function mesurerRessemblance(texte: string, memoire: MemoireCentrale, exclusions: readonly string[] = []): RessemblanceCentrale {
  const r = controlerRessemblance({ texte, anciens: memoire.anciens, origine: memoire.origine ?? "claude", exclusions });
  if (!r.controle || !r.ressemble) return { forte: false, message: "" };
  const exemples = [...r.copies.map((c) => c.texte), ...r.paraphrases.map((p) => p.nouvelle)].slice(0, 3).map((t) => `« ${t} »`).join(" ; ");
  return { forte: true, message: `Ressemble à un script récent (${r.copies.length} reprise(s), ${r.paraphrases.length} paraphrase(s)) : ${exemples}` };
}
