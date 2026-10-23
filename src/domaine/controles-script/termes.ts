/**
 * TERMES CONCORDANTS (plan v5 C68, CRED-06). PUR.
 * Une idée reçue et sa réfutation doivent parler exactement de la même chose : « il faut un informaticien » n'est pas
 * réfuté par « sans développeur ». Le code compare ; il ne décide jamais d'une équivalence (TERME_A_CONFIRMER).
 */
import { contientExpression, normaliser } from "./texte";

/** Rôles et métiers souvent confondus (lexique de départ, complété en G2 par les termes de Will). */
export const LEXIQUE_ROLES: readonly string[] = [
  "informaticien", "informaticienne", "developpeur", "developpeuse", "programmeur", "codeur", "ingenieur", "technicien", "prestataire", "freelance", "consultant", "consultante",
  "comptable", "expert-comptable", "daf", "drh", "juriste", "notaire", "assistant", "assistante", "commercial", "stagiaire", "alternant", "agence", "editeur", "integrateur",
];

function rolesDans(texte: string, lexique: readonly string[]): string[] {
  const n = normaliser(texte);
  return lexique.filter((r) => new RegExp(`(?:^|[^a-z])${r}s?(?=$|[^a-z])`).test(n));
}

/** Les deux textes nomment-ils des rôles différents (ou le pivot manque-t-il dans la réfutation) ? */
export function termesDivergents(ideeRecue: string, refutation: string, pivot?: string, lexique: readonly string[] = LEXIQUE_ROLES): { a: string; b: string } | null {
  if (pivot) {
    if (contientExpression(ideeRecue, pivot) && !contientExpression(refutation, pivot)) return { a: pivot, b: rolesDans(refutation, lexique)[0] ?? "autre chose" };
    return null;
  }
  const a = rolesDans(ideeRecue, lexique);
  const b = rolesDans(refutation, lexique);
  if (!a.length || !b.length || a.some((x) => b.includes(x))) return null;
  return { a: a[0], b: b[0] };
}
