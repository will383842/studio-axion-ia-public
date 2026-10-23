/**
 * Erreur dont le message est DÉJÀ une phrase simple pour Will (français, sans code ni nom technique). PUR : navigateur
 * et serveur. Seule une `ErreurLisible` (ou une `ErreurStudio`) peut voir son message affiché tel quel ; toute autre
 * exception (« Failed to fetch », « Cannot read properties… ») est remplacée à l'écran par une phrase fixe.
 */
export class ErreurLisible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurLisible";
  }
}

/**
 * Le texte est-il une phrase simple montrable à Will telle quelle ? Mêmes refus que la garde « rien de technique à
 * l'écran » (tests/garde-ecran.test.ts) : nom en MAJUSCULES_AVEC_SOULIGNÉS, code d'erreur ou HTTP, anglais technique,
 * adresse, accolades. Sert à garder la vraie raison d'un refus définitif quand elle est déjà lisible.
 */
export function phraseLisible(texte: string | undefined | null): texte is string {
  if (!texte) return false;
  const t = texte.trim();
  if (t.length < 8 || t.length > 300 || !/\s/.test(t) || !/[a-zà-ÿ]/.test(t)) return false;
  return !(
    /\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/.test(t) ||
    /\b[A-Z]{2,5}-\d{1,3}\b/.test(t) ||
    /\(\s*[1-5]\d\d\s*\)|\bHTTP\b|\b(?:code|erreur|réponse|statut)\s*:?\s*[1-5]\d\d\b/i.test(t) ||
    /\b(error|errors|failed|failure|timeout|token|api key|undefined|null|internal|server|exception|stack)\b/i.test(t) ||
    /https?:|[{}]|<\/?[a-z]/i.test(t)
  );
}
