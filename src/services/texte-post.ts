/**
 * TEXTE DE POST D'UN CARROUSEL OU D'UNE INFOGRAPHIE (L3-07). Deux essais de Claude au plus ; le texte déterministe est
 * le repli, toujours journalisé. Ce module n'appelle rien lui-même : l'appel (qui passe par la porte de dépense,
 * `depense-claude-contenu.ts`) est fourni par l'appelant. Sans appeleur (simulation), le repli est le résultat.
 */
import {
  ESSAIS_TEXTE_VISUEL,
  evaluerPublicationVisuel,
  libelleDesEchecs,
  texteDeterministeVisuel,
  type DonneesPublicationVisuel,
  type SortiePublicationVisuel,
} from "@/generateur/roles/publication-visuel";

export interface TextePost extends SortiePublicationVisuel {
  /** « claude » : sortie du modèle, validée ; « repli » : texte déterministe. */
  source: "claude" | "repli";
}

export interface OptionsTextePost {
  /** Un appel Claude. `null` : pas de réponse (crédit épuisé, quota, panne) ; aucun nouvel essai. */
  appeler?: (donnees: DonneesPublicationVisuel, corrections?: string[]) => Promise<SortiePublicationVisuel | null>;
  /** Ligne de journal (mots simples, aucun montant). */
  journaliser?: (message: string) => void;
}

export function textePostDeterministe(d: DonneesPublicationVisuel): TextePost {
  return { ...texteDeterministeVisuel(d), source: "repli" };
}

export async function ecrireTextePost(d: DonneesPublicationVisuel, options: OptionsTextePost = {}): Promise<TextePost> {
  const journaliser = options.journaliser ?? (() => {});
  const repli = (motif: string): TextePost => {
    journaliser(`Texte de post : repli sur le texte automatique (${motif}).`);
    return textePostDeterministe(d);
  };
  if (!options.appeler) return repli("aucun appel Claude");
  let corrections: string[] | undefined;
  let echecs: string[] = [];
  for (let essai = 1; essai <= ESSAIS_TEXTE_VISUEL; essai++) {
    const sortie = await options.appeler({ ...d, ...(corrections ? { corrections } : {}) }, corrections);
    if (!sortie) return repli("pas de réponse de Claude");
    echecs = evaluerPublicationVisuel(sortie, d);
    if (echecs.length === 0) return { ...sortie, texte: sortie.texte.trim(), source: "claude" };
    corrections = echecs;
  }
  return repli(`deux réponses refusées : ${libelleDesEchecs(echecs).join(", ")}`);
}
