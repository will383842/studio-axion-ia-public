/**
 * Phrases dites quand une action du serveur n'aboutit pas. Une page ouverte avant une mise en ligne garde l'ancien
 * identifiant de l'action : Next la refuse (« Server Action … was not found on the server ») et le clic échoue sans
 * rien dire. Ici, ce cas a sa phrase, et toute autre panne aussi.
 */
export const PHRASES_ACTION = {
  pageAncienne: "La page date d'avant la dernière mise à jour : rechargez-la.",
  panne: "Le studio ne répond pas pour l'instant. Rien n'est perdu : réessayez dans un instant.",
} as const;

/** Vrai pour l'erreur de Next sur un identifiant d'action inconnu (nom de l'erreur, ou texte si elle a été recopiée). */
export function estActionInconnue(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, message } = err as { name?: unknown; message?: unknown };
  return name === "UnrecognizedActionError" || (typeof message === "string" && /Server Action .* was not found on the server/i.test(message));
}

/** La phrase à montrer pour une action qui a levé une erreur. */
export function phrasePanneAction(err: unknown): string {
  return estActionInconnue(err) ? PHRASES_ACTION.pageAncienne : PHRASES_ACTION.panne;
}
