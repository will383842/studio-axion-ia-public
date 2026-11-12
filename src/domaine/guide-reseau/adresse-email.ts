// Extraction d'UNE adresse e-mail dans un texte reçu : PUR, aucun réseau, rien n'est conservé. Le résultat reste en mémoire.
const RE_ADRESSE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/** L'exemple donné dans le message M2 : jamais pris pour l'adresse de la personne (écho de notre propre texte). */
const EXEMPLE_M2 = "adresse@entreprise.fr";
const LONGUEUR_MAX = 254;

/**
 * Une seule adresse DISTINCTE (casse ignorée) de 254 caractères au plus ; sinon `null` (aucune, plusieurs, trop longue,
 * ou l'exemple de notre propre message). Jamais de devinette : en cas de doute, `null`.
 */
export function extraireAdresse(texte: string | null | undefined): string | null {
  if (typeof texte !== "string" || texte.length === 0 || texte.length > 5000) return null;
  const trouvees = (texte.match(RE_ADRESSE) ?? []).filter((a) => a.toLowerCase() !== EXEMPLE_M2);
  const distinctes = new Map<string, string>();
  for (const a of trouvees) if (!distinctes.has(a.toLowerCase())) distinctes.set(a.toLowerCase(), a);
  if (distinctes.size !== 1) return null;
  const [adresse] = [...distinctes.values()];
  return adresse.length <= LONGUEUR_MAX ? adresse : null;
}
