/**
 * Raison d'un refus d'envoi sous FORME FERMÉE : jamais de texte libre du service d'envoi.
 * Elle ne se compose que d'un code interne (liste), du statut HTTP (entier 100..599), de codes numériques Meta
 * (entiers de 1 à 9 chiffres) et d'un code Zernio pris dans une liste blanche. Information seulement : aucune décision dessus.
 */

export const CODES_MOTIF_REFUS = [
  "messagerie-desactivee-sur-la-page",
  "messagerie-instagram-desactivee",
  "fenetre-7-jours-depassee",
  "reponse-privee-deja-envoyee",
  "commentaire-non-eligible",
  "auteur-page-ou-confidentialite",
  "auteur-introuvable",
  "personne-injoignable",
  "reponse-privee-declinee",
  "elements-refuses-non-abonne",
  "droits-manquants",
  "jeton-expire-ou-invalide",
  "commentaire-introuvable",
  "envoi-restreint-temporairement",
  "autre-application-aux-commandes",
  "limite-meta",
  "inbox-zernio-requise",
  "quota-messages-zernio",
  "compte-zernio-introuvable",
  "delai-depasse",
  "coupure-reseau",
  "erreur-serveur",
  "refus-avant-envoi",
  "erreur-interne",
  "raison-inconnue",
] as const;
/** D'où vient le motif : `phrase` est une information (repli sur du texte), les autres reposent sur des éléments fermés. */
export const SOURCES_MOTIF = ["nombres", "code-zernio", "phrase", "statut", "reseau", "interne"] as const;
export type SourceMotif = (typeof SOURCES_MOTIF)[number];

export type CodeMotifRefus = (typeof CODES_MOTIF_REFUS)[number];

export const LIBELLES_MOTIF_REFUS: Readonly<Record<CodeMotifRefus, string>> = {
  "messagerie-desactivee-sur-la-page": "La messagerie de la page est désactivée dans ses réglages",
  "messagerie-instagram-desactivee": "Le compte Instagram a coupé l'accès aux messages privés",
  "fenetre-7-jours-depassee": "Commentaire de plus de 7 jours : réponse privée impossible",
  "reponse-privee-deja-envoyee": "Ce commentaire a déjà reçu sa réponse privée",
  "commentaire-non-eligible": "Ce commentaire n'accepte pas de réponse privée",
  "auteur-page-ou-confidentialite": "L'auteur est une page, ou ses réglages empêchent la réponse privée",
  "auteur-introuvable": "Auteur du commentaire introuvable chez le réseau",
  "personne-injoignable": "La personne ne reçoit pas de messages de la page (blocage ou messagerie coupée)",
  "reponse-privee-declinee": "Réponse privée refusée par le réseau",
  "elements-refuses-non-abonne": "Boutons ou pièces jointes refusés pour une personne qui ne suit pas le compte",
  "droits-manquants": "Droits manquants sur la page (permission de messagerie)",
  "jeton-expire-ou-invalide": "Connexion de la page expirée ou invalide : la reconnecter dans Zernio",
  "commentaire-introuvable": "Commentaire supprimé ou introuvable",
  "envoi-restreint-temporairement": "La page est temporairement limitée pour l'envoi de messages",
  "autre-application-aux-commandes": "Une autre application gère cette conversation",
  "limite-meta": "Limite d'envoi du réseau atteinte",
  "inbox-zernio-requise": "Le module Inbox de Zernio n'est pas activé",
  "quota-messages-zernio": "Quota de messages Zernio épuisé",
  "compte-zernio-introuvable": "Compte introuvable chez Zernio",
  "delai-depasse": "Zernio n'a pas répondu à temps",
  "coupure-reseau": "Zernio injoignable",
  "erreur-serveur": "Erreur du serveur Zernio ou du réseau social",
  "refus-avant-envoi": "Refusé par le Studio avant l'envoi (garde de sécurité)",
  "erreur-interne": "Erreur interne du Studio",
  "raison-inconnue": "Raison inconnue (voir le statut HTTP)",
};

/** Codes Zernio admis dans une raison : liste blanche (une simple forme `[a-z_]+` laisserait passer un pseudo). */
export const CODES_ZERNIO_CONNUS = ["INBOX_REQUIRED", "message_allowance_exceeded", "idempotency_conflict", "platform_api_error", "platform_error", "rate_limit_error", "PLATFORM_API_ERROR"] as const;
export type CodeZernioConnu = (typeof CODES_ZERNIO_CONNUS)[number];

/** Codes du client Zernio (`CodeErreurZernio`) et `erreur-inconnue` : seuls admis pour `codeClient`. Pas d'import du type (cycle domaine -> fournisseur) : lien garanti par tests/zernio/codes-client-exhaustifs.test.ts. */
export const CODES_CLIENT_CONNUS: readonly string[] = [
  "envoi-coupe", "mot-interdit", "chemin-refuse", "debit", "lecture-requise", "conflit-idempotence", "doublon", "a-verifier", "indisponible", "acces", "introuvable", "refuse",
  "reponse-invalide", "inbox-requis", "quota-messages", "reponse-privee-consommee", "reponse-privee-inconnue", "limite-incertaine", "lien-hors-domaine", "guide-inconnu",
  "boutons-non-supportes", "creation-incomplete", "erreur-inconnue",
];

/** Sous-codes Meta connus -> motif (liste fermée, partagée par le validateur et le module des motifs). */
export const SOUS_CODES: Readonly<Record<number, CodeMotifRefus>> = {
  2534041: "messagerie-instagram-desactivee",
  2534024: "fenetre-7-jours-depassee", 2534022: "fenetre-7-jours-depassee", 2018278: "fenetre-7-jours-depassee",
  2534023: "reponse-privee-deja-envoyee",
  2534025: "commentaire-non-eligible",
  2534014: "auteur-introuvable",
  1545041: "personne-injoignable", 2018108: "personne-injoignable",
  2534066: "reponse-privee-declinee",
  2018028: "droits-manquants", 1404170: "droits-manquants",
  1893063: "envoi-restreint-temporairement",
  2018300: "autre-application-aux-commandes",
};
export const CODES_META: Readonly<Record<number, CodeMotifRefus>> = {
  10900: "reponse-privee-deja-envoyee",
  10903: "auteur-page-ou-confidentialite",
  551: "personne-injoignable",
  200: "droits-manquants", 230: "droits-manquants",
  190: "jeton-expire-ou-invalide",
  613: "limite-meta",
};

/** Liste FERMÉE des codes Meta admis dans une raison (code ou sous-code) : tout autre entier est écarté, jamais gardé ni journalisé. */
export const CODES_META_CONNUS: readonly number[] = [...new Set([...Object.keys(CODES_META).map(Number), ...Object.keys(SOUS_CODES).map(Number), 2, 10, 100, 33, 1545133])];

export interface RaisonRefus {
  motif: CodeMotifRefus;
  /** Statut HTTP (entier 100..599) ou null. */
  statut: number | null;
  /** Code du client (liste fermée) ou "erreur-inconnue". */
  codeClient: string;
  /** Codes numériques Meta (entiers de 1 à 9 chiffres). */
  meta: { code: number; sousCode: number | null } | null;
  codeZernio: CodeZernioConnu | null;
  /** Origine du motif (liste fermée). Un motif de source `phrase` n'est qu'une information. */
  source: SourceMotif;
}
export type RaisonRefusStockee = RaisonRefus & { le: string };

const entierMeta = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= 999_999_999;
const CLES = ["motif", "statut", "codeClient", "meta", "codeZernio", "source"];

/** Validateur strict, appelé avant toute écriture : forme exacte, aucune clé en plus, aucune valeur libre. */
export function estRaisonRefus(x: unknown): x is RaisonRefus {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  if (Object.keys(r).some((k) => !CLES.includes(k))) return false;
  if (typeof r.motif !== "string" || !(CODES_MOTIF_REFUS as readonly string[]).includes(r.motif)) return false;
  if (r.statut !== null && !(typeof r.statut === "number" && Number.isInteger(r.statut) && r.statut >= 100 && r.statut <= 599)) return false;
  if (typeof r.codeClient !== "string" || !CODES_CLIENT_CONNUS.includes(r.codeClient)) return false;
  if (typeof r.source !== "string" || !(SOURCES_MOTIF as readonly string[]).includes(r.source)) return false;
  if (r.codeZernio !== null && !(CODES_ZERNIO_CONNUS as readonly unknown[]).includes(r.codeZernio)) return false;
  if (r.meta !== null) {
    if (typeof r.meta !== "object" || Array.isArray(r.meta)) return false;
    const m = r.meta as Record<string, unknown>;
    if (Object.keys(m).some((k) => k !== "code" && k !== "sousCode") || !entierMeta(m.code) || !CODES_META_CONNUS.includes(m.code) || !(m.sousCode === null || (entierMeta(m.sousCode) && CODES_META_CONNUS.includes(m.sousCode)))) return false;
  }
  return true;
}

/** « Messagerie désactivée sur la page [HTTP 400 · refuse · meta 10/2018278] » : libellé français + éléments fermés. */
export function formaterRaison(r: RaisonRefus): string {
  const parties = [r.statut !== null ? `HTTP ${r.statut}` : "", r.codeClient, r.meta ? `meta ${r.meta.code}${r.meta.sousCode !== null ? `/${r.meta.sousCode}` : ""}` : ""].filter((x) => x !== "");
  const suffixe = r.source === "phrase" ? " (d'après le message)" : "";
  return `${LIBELLES_MOTIF_REFUS[r.motif]} [${parties.join(" · ")}]${suffixe}`;
}
