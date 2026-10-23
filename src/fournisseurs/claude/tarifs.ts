/**
 * TARIFS CLAUDE (lot G0, plan v5 B.3.2 et B.9) — PUR, testé.
 *
 * Source : skill `claude-api` (tableau des modèles, relevé du 25/09/2026, revérifié en G0 le 02/10/2026), en dollars
 * par million de jetons. Écriture en cache : 1,25 × l'entrée pour 5 min, 2 × pour 1 h (skill `claude-api`, prompt caching,
 * relevé du 15/10) ; lecture en cache : tarif propre au modèle.
 * Le coût se calcule TOUJOURS sur le modèle RENVOYÉ par l'API (repli serveur possible, B.3.2), jamais sur celui demandé.
 * Un modèle inconnu est compté au tarif le plus cher de la table (jamais sous-estimé).
 */

export const MODELE_ECRITURE = "claude-opus-5-5";
export const MODELE_JUGE = "claude-sonnet-5-5";

export interface TarifModele {
  /** $ par million de jetons. */
  entree: number;
  sortie: number;
  cacheLu: number;
  /** Écriture en cache, durée 5 minutes (1,25 × l'entrée). */
  cacheEcrit: number;
  /** Écriture en cache, durée 1 heure (2 × l'entrée) : le socle de Will. */
  cacheEcrit1h: number;
}

function tarif(entree: number, sortie: number, cacheLu: number): TarifModele {
  return { entree, sortie, cacheLu, cacheEcrit: entree * 1.25, cacheEcrit1h: entree * 2 };
}

/** Modèles que le générateur peut demander ou recevoir (repli serveur « default » compris). */
export const TARIFS_CLAUDE: Record<string, TarifModele> = {
  "claude-opus-5-5": tarif(4, 20, 0.2),
  "claude-sonnet-5-5": tarif(2, 10, 0.2),
  // Replis possibles (`fallbacks: "default"`, routés par catégorie de refus) et modèles voisins.
  "claude-opus-5": tarif(5, 25, 0.5),
  "claude-opus-4-8": tarif(5, 25, 0.5),
  "claude-sonnet-5": tarif(2, 10, 0.2),
  "claude-haiku-4-5": tarif(1, 5, 0.1),
};

/** Le plus cher de la table : appliqué à un modèle inconnu. */
const TARIF_PRUDENT: TarifModele = Object.values(TARIFS_CLAUDE).reduce((a, b) => (b.sortie > a.sortie ? b : a));

export function tarifDe(modele: string | undefined | null): TarifModele {
  if (!modele) return TARIF_PRUDENT;
  return TARIFS_CLAUDE[modele] ?? TARIFS_CLAUDE[modele.replace(/-\d{8}$/, "")] ?? TARIF_PRUDENT;
}

/** Jetons renvoyés par l'API (`usage`). `entree` n'inclut PAS les jetons lus ou écrits en cache (forme de l'API). */
export interface JetonsClaude {
  entree: number;
  cacheLu: number;
  /** Toutes les écritures en cache (5 min et 1 h). */
  cacheEcrit: number;
  /** Part de `cacheEcrit` écrite pour 1 h (`usage.cache_creation.ephemeral_1h_input_tokens`) ; absente : tout en 5 min. */
  cacheEcrit1h?: number;
  sortie: number;
}

/** Coût réel d'un appel, en dollars (non arrondi). Les écritures 1 h au prix 1 h, le reste des écritures au prix 5 min. */
export function coutUsd(jetons: JetonsClaude, modele: string | undefined | null): number {
  const t = tarifDe(modele);
  const ecrit1h = Math.min(jetons.cacheEcrit1h ?? 0, jetons.cacheEcrit);
  return (jetons.entree * t.entree + jetons.cacheLu * t.cacheLu + (jetons.cacheEcrit - ecrit1h) * t.cacheEcrit + ecrit1h * t.cacheEcrit1h + jetons.sortie * t.sortie) / 1_000_000;
}

/**
 * Jetons d'entrée estimés d'un texte, au PIRE : 1 jeton pour 3 caractères (le français tourne autour de 3,5 à 4 ;
 * les jetons de pensée sont facturés en sortie et bornés par `max_tokens`).
 */
export function jetonsEstimes(texte: string): number {
  return Math.ceil(texte.length / 3);
}

/**
 * Pire cas d'un appel (B.3.4) : toute l'entrée écrite en cache (le plus cher des deux), dont `jetons1h` (le socle, déjà
 * compris dans `jetonsEntree`) au prix de l'écriture 1 h, et `maxTokens` jetons de sortie (pensée comprise). Sert au
 * pré-vol et au plafond ; jamais au coût réel.
 */
export function pireCasUsd(modele: string, jetonsEntree: number, maxTokens: number, jetons1h = 0): number {
  const t = tarifDe(modele);
  const enCache = Math.min(Math.max(jetons1h, 0), jetonsEntree);
  return ((jetonsEntree - enCache) * Math.max(t.entree, t.cacheEcrit) + enCache * Math.max(t.entree, t.cacheEcrit1h) + maxTokens * t.sortie) / 1_000_000;
}

/** Arrondi d'affichage et de stockage : au centime de dollar SUPÉRIEUR (jamais sous-estimé). */
export function centimesUsd(usd: number): number {
  return Math.ceil(usd * 100 - 1e-9);
}
