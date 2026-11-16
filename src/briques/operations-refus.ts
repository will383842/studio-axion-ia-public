/**
 * REFUS TYPÉS DU CHAT DE RETOUCHE (G14-02) — ce que le chat ne fait jamais, avec une phrase française pour Williams.
 * Pur (aucune dépendance vers `services/`) : aucun appel, aucun prix, aucun fichier lu. Les motifs sont volontairement larges (on refuse dans le doute).
 */
export const CODES_REFUS = ["logo-client", "faux-avis", "transition-visage", "musique-neuve", "voix-synthese-coupee", "son-hors-liste"] as const;
export type CodeRefus = (typeof CODES_REFUS)[number];

export interface Refus {
  code: CodeRefus;
  phrase: string;
}

export const PHRASES_REFUS: Readonly<Record<CodeRefus, string>> = {
  "logo-client": "Le chat n'ajoute pas le logo d'un client : seuls les logos déjà validés du Studio sont permis.",
  "faux-avis": "Le chat n'invente ni avis ni témoignage : seuls de vrais retours, déjà fournis, peuvent apparaître.",
  "transition-visage": "Le chat ne pose pas de transition ni d'effet sur le visage : le visage reste intact.",
  "musique-neuve": "Le chat n'ajoute pas de musique neuve : il ne puise que dans les sons déjà validés.",
  "voix-synthese-coupee": "Couper la voix de synthèse la ferait relire, ce qui est payant : cette retouche n'est pas faite par le chat.",
  "son-hors-liste": "Ce son n'est pas dans la liste des sons déjà validés : le chat ne peut pas l'ajouter.",
};

const MOTIFS: readonly (readonly [CodeRefus, RegExp])[] = [
  ["faux-avis", /(faux|fausse|invente\w*|fabrique\w*|bidon).{0,30}(avis|t[eé]moignage|commentaire|[eé]toiles?)|(avis|t[eé]moignage)\s+(invent|fictif|bidon)/i],
  ["logo-client", /logo.{0,25}(client|marque|entreprise|soci[eé]t[eé])|(client|marque).{0,15}logo/i],
  ["transition-visage", /(transition|effet|flou|filtre|zoom|sticker|texte|calque).{0,30}(sur|devant|par.dessus).{0,10}(le |son |mon )?(visage|figure|t[eê]te)/i],
  ["musique-neuve", /(ajoute\w*|mets|mettre|pose\w*|rajoute\w*|nouvelle|nouveau).{0,25}(musique|chanson|morceau|bande.son)|musique de fond/i],
  ["voix-synthese-coupee", /(coupe\w*|retire\w*|supprime\w*|enl[eè]ve\w*).{0,25}voix.{0,15}(synth[eè]se|de synth|robot|ia\b|g[eé]n[eé]r[eé]e)/i],
];

/** Premier refus qui correspond à la demande, ou `null` : la demande suit son cours. */
export function detecterRefus(demande: string): Refus | null {
  const t = demande.trim();
  if (!t) return null;
  for (const [code, motif] of MOTIFS) if (motif.test(t)) return { code, phrase: PHRASES_REFUS[code] };
  return null;
}

/** Refus typé de code donné ; `phrase` : celle d'une garde plus précise (ex. `sonPermisDansLeChat`), sinon la phrase type. */
export function refus(code: CodeRefus, phrase?: string): Refus {
  return { code, phrase: phrase ?? PHRASES_REFUS[code] };
}
