/**
 * LE MONTEUR CONNAÎT LA COUVERTURE (test en prod du 11/10). PUR, importable partout.
 *
 * Constat : la couverture (miniature choisie, affichée sur le lecteur AVANT la lecture) portait en gros
 * « 0005-FC-TT-L · LE DIAGNOSTIC FUITE — V5 ». Will : « ENLEVER LE numéro dans le titre de la vidéo » ; le monteur ne
 * voyait pas la couverture et a répondu que ce texte était « invisible à l'écran », puis a refait la carte titre du
 * début (déjà bonne) : 20 min de montage pour rien, couverture inchangée.
 *
 * Ici : ce que le monteur sait de la couverture, les demandes lues SANS Claude (un code interne présent seulement sur
 * la couverture ; renommer la vidéo dans le studio) et le garde-fou « jamais invisible à l'écran ».
 */

/** Couverture de la vidéo telle que Will la voit : titre de la miniature choisie, écrit ou non sur l'image. */
export interface CouvertureMonteur {
  titre: string;
  ecrite: boolean;
}

/** Question posée quand on ne sait pas où Will voit le texte (jamais un montage refait au hasard). */
export const QUESTION_COUVERTURE = "Vous le voyez sur la couverture ou dans la vidéo ?";

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const plein = (j: string) => /[\p{L}\p{N}]/u.test(j);

/**
 * Morceau de code interne : référence de projet (« 0005-FC-TT-L »), numéro à zéros (« 0005 »), version (« V5 »,
 * « v12 »), « #12 ». Un nombre utile (« 3 erreurs », « 2026 », « 135 € ») n'en est pas un.
 */
function estCode(j: string): boolean {
  const m = j.replace(/^[(«“"']+|[)»”"',.;:]+$/g, "");
  if (!/\d/.test(m)) return false;
  return /^v\d+$/i.test(m) || /^#\d+$/.test(m) || /^0\d+/.test(m) || (/-/.test(m) && /[a-z]/i.test(m)) || /\d+-\d+/.test(m);
}

/** Codes internes écrits dans un titre (dans l'ordre). */
export function codesInternes(titre: string): string[] {
  return titre.split(/\s+/).filter(estCode);
}

/** Titre sans ses codes internes ni les séparateurs laissés seuls (« 0005-FC-TT-L · LE DIAGNOSTIC FUITE — V5 » → « LE DIAGNOSTIC FUITE »). */
export function sansCodeInterne(titre: string): string {
  return retirer(titre, codesInternes(titre));
}

function retirer(titre: string, morceaux: string[]): string {
  let t = ` ${titre} `;
  for (const m of morceaux) t = t.split(m).join(" ");
  const jetons = t.split(/\s+/).filter(Boolean);
  const gardes: string[] = [];
  for (const j of jetons) if (plein(j) || (gardes.length && plein(gardes.at(-1)!))) gardes.push(j);
  while (gardes.length && !plein(gardes.at(-1)!)) gardes.pop();
  return gardes.join(" ").trim();
}

const CIBLE_CODE = /\b(numeros?|codes?|references?|ref|v\d+)\b/;
const RETRAIT = /\b(enlev|retir|supprim|eff?ac|vire|cache|modifi|change|chang)\w*|ne (paraiss|apparaiss|se voi|soit)\w* plus|plus (paraitre|apparaitre|voir)|sans (le|ce|son) (numero|code)/;
const RENVOI = /\b(titre|ca|cela|le|la)\b/;

/**
 * Demande lue SANS Claude : retirer un texte que Will VOIT sur la couverture et qui n'est pas dans la vidéo montée
 * (un code interne, ou un texte cité entre guillemets). Rend le nouveau titre de couverture, ou null (Claude décide,
 * avec la couverture dans son contexte). `precedentWill` : le message précédent de Will (« alors modifier le titre
 * pour que ça ne paraisse plus » renvoie au numéro dont il parlait). `textesVideo` : tout ce que la vidéo montée
 * affiche ou dit (cartes, titres, mots) : un texte qui y est aussi est un doute, laissé à Claude.
 */
export function couvertureSansTexte(message: string, precedentWill: string | undefined, couverture: CouvertureMonteur | null | undefined, textesVideo: string): string | null {
  if (!couverture?.titre.trim()) return null;
  const t = sansAccents(message);
  if (!RETRAIT.test(t) || /sous[- ]?titres?/.test(t)) return null;
  const video = sansAccents(textesVideo);
  const cite = message.match(/[«“"]\s*([^»”"]+?)\s*[»”"]/)?.[1]?.trim();
  if (cite && sansAccents(couverture.titre).includes(sansAccents(cite))) {
    if (video.includes(sansAccents(cite))) return null;
    const nouveau = retirer(couverture.titre, [cite, ...couverture.titre.split(/\s+/).filter((j) => sansAccents(j) === sansAccents(cite))]);
    return nouveau && nouveau !== couverture.titre ? nouveau : null;
  }
  const codes = codesInternes(couverture.titre);
  if (!codes.length) return null;
  const parleDuCode = CIBLE_CODE.test(t) || (RENVOI.test(t) && CIBLE_CODE.test(sansAccents(precedentWill ?? "")));
  if (!parleDuCode) return null;
  if (codes.some((c) => video.includes(sansAccents(c)))) return null;
  const nouveau = sansCodeInterne(couverture.titre);
  return nouveau || null;
}

/**
 * Renommer la vidéo ELLE-MÊME (son nom dans le studio : liste, fiche), jamais la couverture ni le montage.
 * Rend le nouveau nom s'il est dit (« renomme la vidéo en « … » »), `nom: null` sinon ; null si ce n'est pas la demande.
 */
export function demandeRenommage(message: string): { nom: string | null } | null {
  const t = sansAccents(message);
  if (/couverture|miniature|sous[- ]?titre/.test(t)) return null;
  const demande = /\brenomm\w*\b[^.?!]*\bvideo\b|\b(nom|intitule) de (la|ma|cette) video\b|\bappel+e[rz]? (la|ma|cette) video\b/.test(t);
  if (!demande) return null;
  const cite = message.match(/[«“"]\s*([^»”"]+?)\s*[»”"]/)?.[1]?.trim();
  const apres = message.match(/(?:renomm\w*|appel+e[rz]?)\s+(?:la|ma|cette)\s+vid[ée]o\s+(?:en|:)\s*(.+)$/i)?.[1]?.trim();
  const nom = (cite || apres || "").replace(/^[«“"']+|[»”"'.!]+$/g, "").trim().slice(0, 120);
  return { nom: nom || null };
}

/** Phrase de Claude qui dit un texte invisible alors que Will le voit (sur la couverture) : jamais montrée. */
export const DIT_INVISIBLE = /invisible|nom (du|de) projet|(n'appara[iî]t|ne s'affiche|ne se voit) (pas|jamais) (à|a|sur) l'[ée]cran|pas (visible|affich[ée]e?) (à|a|sur) l'[ée]cran/i;

/** Réponse quand Claude a dit « invisible » : ce que montre la couverture, puis la question. */
export function phraseCouverture(couverture: CouvertureMonteur): string {
  return `La couverture (l'image affichée avant la lecture) montre « ${couverture.titre} »${couverture.ecrite ? "" : " (titre posé à côté de l'image)"}. ${QUESTION_COUVERTURE}`;
}
