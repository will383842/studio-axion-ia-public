/**
 * Pièces PURES du suivi du cas concret (tâche X12) : l'adresse de la relance, la lecture de sa réponse, les phrases de
 * l'écran. Une réponse illisible devient une phrase : jamais un clic sans effet visible.
 */
export const ADRESSE_RELANCE = "/cas-concret/relance";

export const PHRASES_ECRAN_RELANCE = {
  injoignable: "Le studio ne répond pas pour l'instant. Rien n'est perdu : réessayez dans un instant.",
  delai: "La relance n'a pas répondu à temps. Rouvrez la page : si l'étape n'a pas repris, réessayez.",
  session: "Votre connexion a expiré : reconnectez-vous, puis réessayez.",
  annulee: "Relance annulée : rien n'est payé.",
  denouveau: "Nouvel essai fait : l'étape s'est de nouveau arrêtée. La raison est au-dessus.",
  illisible: "La relance n'a pas abouti. Rien n'est perdu : réessayez dans un instant.",
} as const;

export type IssueRelanceEcran = { statut: "relancee" } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

/** La réponse de `/cas-concret/relance`, lue sans confiance. */
export function lireIssue(corps: unknown): IssueRelanceEcran {
  const issue = corps && typeof corps === "object" ? (corps as { issue?: unknown }).issue : undefined;
  if (!issue || typeof issue !== "object") return { statut: "refusee", phrase: PHRASES_ECRAN_RELANCE.illisible };
  const i = issue as { statut?: unknown; centimes?: unknown; phrase?: unknown };
  if (i.statut === "relancee") return { statut: "relancee" };
  const phrase = typeof i.phrase === "string" && i.phrase.trim() ? i.phrase : PHRASES_ECRAN_RELANCE.illisible;
  if (i.statut === "accord-requis" && typeof i.centimes === "number" && Number.isFinite(i.centimes)) return { statut: "accord-requis", centimes: i.centimes, phrase };
  return { statut: "refusee", phrase };
}

/** Phrase dite dès que la relance est acceptée. */
export function phraseRelancee(etape: string | undefined): string {
  return etape ? `Relance envoyée : l'étape « ${etape} » reprend.` : "Relance envoyée : la fabrication reprend.";
}
