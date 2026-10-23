// Ne modifier qu'après un ordre ÉCRIT de Will (abonnement, jamais l'API payante).
import type { CODES_ERREUR_VISUELS } from "../../domaine/visuels/contrats";

export const API_PAYANTE_AUTORISEE = false as const;

export const MESSAGE_API_VERROUILLEE = "L'écriture par l'API payante est verrouillée : ordre de Will requis";

/** Erreur typée du fournisseur de texte : `code` est l'un des codes de `CODES_ERREUR_VISUELS`. */
export class ErreurTexteCarrousel extends Error {
  constructor(
    readonly code: (typeof CODES_ERREUR_VISUELS)[number],
    message: string,
  ) {
    super(message);
    this.name = "ErreurTexteCarrousel";
  }
}

/** Lève API_PAYANTE_VERROUILLEE tant que la constante n'est pas true. */
export function exigerApiDeverrouillee(): void {
  const autorisee: boolean = API_PAYANTE_AUTORISEE;
  if (!autorisee) throw new ErreurTexteCarrousel("API_PAYANTE_VERROUILLEE", MESSAGE_API_VERROUILLEE);
}
