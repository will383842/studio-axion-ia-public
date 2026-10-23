/**
 * TYPOGRAPHIE FRANÇAISE des sous-titres (B.5). PUR, sans aucune dépendance : importable par Remotion.
 * Mots outils (jamais seuls en fin de groupe), nombres et montants insécables, fins de phrase.
 */

/** Mots outils : articles, prépositions, conjonctions, pronoms courts, déterminants. */
export const MOTS_OUTILS: ReadonlySet<string> = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "à", "a",
  "et", "ou", "ni", "mais", "or", "donc", "car", "que", "qu", "qui", "quoi", "dont", "si", "s",
  "en", "y", "dans", "sur", "sous", "par", "pour", "avec", "sans", "chez", "vers", "entre", "contre", "depuis", "pendant", "selon",
  "ce", "cet", "cette", "ces", "c", "ça",
  "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur", "leurs",
  "je", "j", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "me", "m", "te", "t", "se", "lui", "ne", "n",
  "très", "comme", "quand",
]);

/** Unités qui restent collées au nombre qui les précède (« 67 000 € », « 35 heures », « 10 % »). */
export const UNITES: ReadonlySet<string> = new Set([
  "€", "$", "%", "euro", "euros", "dollar", "dollars", "k€", "m€",
  "an", "ans", "mois", "semaine", "semaines", "jour", "jours", "heure", "heures", "h", "minute", "minutes", "min", "seconde", "secondes",
  "km", "m²", "kg", "fois", "million", "millions", "milliard", "milliards", "mille", "cent",
]);

const PONCTUATION = /[«»"“”‘’()[\]{}.,;:!?…  ]/g;

/** Mot normalisé : minuscules, sans ponctuation ni guillemets, apostrophe finale retirée (« l' » → « l »). */
export function normaliser(mot: string): string {
  return mot
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(PONCTUATION, "")
    .replace(/'$/, "")
    .trim();
}

/** Mot outil sans ponctuation forte : ne termine jamais un groupe. Une élision (« l'entreprise ») n'en est pas un. */
export function estMotOutil(mot: string): boolean {
  if (/[.,;:!?…]\s*$/.test(mot.replace(/[  »"”]+$/g, ""))) return false;
  const n = normaliser(mot);
  return MOTS_OUTILS.has(n) || /^[a-zà-ÿ]{1,2}'$/.test(mot.toLowerCase().replace(/’/g, "'"));
}

/** Nombre écrit en chiffres (« 2 », « 2,5 », « 67 », « 1.000 », « 35h »). */
export function estNombre(mot: string): boolean {
  return /^[+-−]?\d[\d.,  ]*(k€|m€|€|%|h)?$/i.test(mot.replace(/[.,;:!?…»"”]+$/, "").replace(/^[«"“ ]+/, ""));
}

/** Tranche de milliers qui suit un nombre (« 000 » dans « 67 000 »). */
export function estTrancheMilliers(mot: string): boolean {
  return /^\d{3}([.,]\d+)?$/.test(mot.replace(/[.,;:!?…»"”]+$/, ""));
}

export function estUnite(mot: string): boolean {
  return UNITES.has(normaliser(mot)) || /^[€$%]/.test(mot);
}

/** Ponctuation forte en fin de mot : fin de phrase. */
export function estFinPhrase(mot: string): boolean {
  return /[.?!…]\s*[»"”]?$/.test(mot.replace(/[  ]/g, ""));
}

/** Ponctuation faible en fin de mot : respiration possible. */
export function estPause(mot: string): boolean {
  return /[,;:]\s*$/.test(mot.replace(/[  ]/g, ""));
}

/** Négations et mots qui tranchent : ils pèsent dans la note d'importance. */
export const MOTS_FORTS: ReadonlySet<string> = new Set([
  "jamais", "rien", "aucun", "aucune", "personne", "interdit", "interdite", "illégal", "illégale", "gratuit", "gratuite", "zéro",
  "obligé", "obligatoire", "faux", "attention", "surtout", "vraiment", "tout", "non", "oui", "droit", "droits",
]);
