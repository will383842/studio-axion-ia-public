/**
 * MENTION « ÉTIQUETAGE IA » PAR GÉNÉRATEUR (C10-14, article 50 du règlement IA). Décision de Williams (16/11) : par défaut
 * on n'affiche RIEN ; il peut allumer la phrase générateur par générateur depuis la console d'administration.
 * - Un interrupteur par générateur (`mentionIA.<generateur>.actif`), ÉTEINT par défaut : seul le booléen `true` allume.
 * - Texte par défaut « Voix et image générées par IA » ; modifiable (`mentionIA.<generateur>.texte`).
 * - Aucun code n'écrit ces réglages. Distinct de la pastille X1-14 (non touchée).
 * - Branchement restant : la console d'administration doit lire/écrire ces clés (reglages.ts est une zone interdite) ;
 *   l'affichage dans le rendu viendra par `mention.ts` (côté rendu) à partir du texte retourné ici.
 * PUR : la lecture est injectée (`lireParametre` côté service). Une lecture en échec = éteint.
 */
export const GENERATEURS_MENTION_IA = [
  "avocat",
  "cas-concret",
  "facecam",
  "facecam-animee",
  "tableau-anime",
  "demo-facecam",
  "tutoriel-outil",
  "image-video",
] as const;
export type IdGenerateurMentionIA = (typeof GENERATEURS_MENTION_IA)[number];

export const TEXTE_MENTION_IA_PAR_DEFAUT = "Voix et image générées par IA";
export const LONGUEUR_MAX_MENTION_IA = 120;

export type LireReglageMentionIA = (id: string, defaut: unknown) => Promise<unknown>;

export function cleInterrupteurMentionIA(generateur: IdGenerateurMentionIA): string {
  return `mentionIA.${generateur}.actif`;
}
export function cleTexteMentionIA(generateur: IdGenerateurMentionIA): string {
  return `mentionIA.${generateur}.texte`;
}

/** Texte à afficher, ou `null` (rien à afficher) tant que l'interrupteur du générateur n'est pas exactement `true`. */
export async function mentionIAAAfficher(generateur: IdGenerateurMentionIA, lire: LireReglageMentionIA): Promise<string | null> {
  try {
    if ((await lire(cleInterrupteurMentionIA(generateur), false)) !== true) return null;
    const t = await lire(cleTexteMentionIA(generateur), TEXTE_MENTION_IA_PAR_DEFAUT);
    const propre = typeof t === "string" ? t.trim() : "";
    return propre !== "" && propre.length <= LONGUEUR_MAX_MENTION_IA ? propre : TEXTE_MENTION_IA_PAR_DEFAUT;
  } catch {
    return null;
  }
}
