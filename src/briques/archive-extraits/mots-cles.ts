/**
 * Archive des vidéos livrées (C3-UT-3.2) : mots-clés d'une plage. Fonction pure, sans service.
 */

/** Mots vides français (sans accents, en minuscules) écartés des mots-clés. */
export const MOTS_VIDES_FR: readonly string[] = [
  "a", "au", "aux", "avec", "ce", "ces", "cet", "cette", "c", "d", "dans", "de", "des", "du", "elle", "elles",
  "en", "est", "et", "es", "etre", "ete", "il", "ils", "j", "je", "l", "la", "le", "les", "leur", "leurs", "m", "ma",
  "mais", "me", "mes", "moi", "mon", "n", "ne", "nos", "notre", "nous", "on", "ou", "par", "pas", "pour", "qu",
  "que", "qui", "s", "sa", "se", "ses", "si", "son", "sont", "sur", "t", "ta", "te", "tes", "toi", "ton", "tu",
  "un", "une", "vos", "votre", "vous", "y", "ca", "ai", "as", "ont", "avons", "avez", "plus", "tout", "tous",
];

const VIDES = new Set(MOTS_VIDES_FR);

/** Minuscules, sans accents, sans ponctuation, sans mots vides, sans doublon, dans l'ordre d'apparition. */
export function motsClesDe(texte: string): string[] {
  const propre = texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!propre) return [];
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const mot of propre.split(" ")) {
    if (!mot || VIDES.has(mot) || vus.has(mot)) continue;
    vus.add(mot);
    sortie.push(mot);
  }
  return sortie;
}
