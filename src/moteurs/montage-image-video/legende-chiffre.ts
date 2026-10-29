/**
 * Légende d'un chiffre, dans l'ordre de lecture (PUR : aucune date, aucun hasard).
 *
 * La légende d'un chiffre s'obtenait en le retirant de sa phrase : « Relance à 3 jours » donnait « Relance à », posée sous
 * « 3 jours », et se lisait « 3 jours Relance à ». Ici, le chiffre en tête garde ce qui le suit ; le chiffre en fin garde ce qui
 * le précède, sans le mot-outil final (« Relance à 3 jours » → « Relance »). Si un comparatif reste (« moins de », « plus de »,
 * « jusqu'à », « environ »), la légende est la phrase entière : jamais un sens faux. Partout ailleurs, la sortie est celle
 * d'avant (le chiffre est simplement retiré). Seul le texte affiché change : le texte dit par la voix reste celui de la carte.
 */

const SEPARATEURS = "\\s=·:—–\\-";
/** Mots-outils qui ne se lisent plus une fois le chiffre parti : « Relance à ». */
const MOT_OUTIL = new RegExp(`(?:^|[${SEPARATEURS}'’])(?:à|a|au|aux|de|du|des|d|en|dans|sous|sur|par|pour|après|apres|chaque)['’]?$`, "iu");
const COMPARATIF = /(?:^|[\s'’])(?:moins d(?:e|u|es)?|plus d(?:e|u|es)?|jusqu['’]?(?:à|a|au|aux)|environ)['’]?$/iu;
const SEPARATEURS_FIN = new RegExp(`[${SEPARATEURS}]+$`, "u");

const nettoye = (t: string) => t.replace(SEPARATEURS_FIN, "").trimEnd();

export function legendeDuChiffre(phrase: string, chiffre: string): string {
  const sansChiffre = phrase.replace(chiffre, "").trim();
  const i = chiffre ? phrase.indexOf(chiffre) : -1;
  if (i < 0) return sansChiffre;
  const avant = phrase.slice(0, i);
  const apres = phrase.slice(i + chiffre.length);
  // Chiffre en tête (ou seul) : la légende est ce qui suit, comme avant. Chiffre au milieu : comme avant.
  if (new RegExp(`^[${SEPARATEURS}]*$`, "u").test(avant) || !new RegExp(`^[${SEPARATEURS}]*$`, "u").test(apres)) return sansChiffre;
  // Chiffre en fin : la légende est ce qui précède, sans séparateur ni mot-outil final (« Relance à » → « Relance »).
  const tete = nettoye(avant);
  if (COMPARATIF.test(tete)) return phrase.trim();
  let legende = tete;
  while (MOT_OUTIL.test(legende)) legende = nettoye(legende.replace(MOT_OUTIL, ""));
  // Un comparatif resté en route (« jusqu'à environ ») : la phrase entière.
  return COMPARATIF.test(legende) ? phrase.trim() : legende;
}
