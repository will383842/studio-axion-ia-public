/**
 * LA DOULEUR DU TABLEAU ANIMÉ, du générateur de scripts jusqu'aux règles du découpage. Domaine PUR.
 *
 * CONSTAT DU 12/10 (essai réel n° 2) : le générateur rendait une douleur DÉCRITE (« Le dirigeant de petite entreprise
 * sent qu'il perd du temps… », 160 caractères et plus) alors que la fiche en accepte 140 ; et cette description, à la
 * troisième personne, n'avait aucun mot en commun avec l'accroche dite (« Vous finissez à dix-neuf heures sans savoir où
 * est passée la journée. »). Les règles « douleur en tête » et « geste fort » cherchent pourtant les mots de la douleur
 * dans les 3 premières secondes : la fiche était refusée alors que l'accroche ÉTAIT la douleur.
 *
 * Désormais :
 *  - la douleur transmise au découpage est tirée de ce qui est DIT (accroche, puis bloc « douleur » du script), en
 *    phrases entières, 140 caractères au plus (`douleurDepuisScript`) ; toute douleur trop longue est raccourcie à la
 *    première phrase entière qui tient (`raccourcirDouleur`), jamais refusée ;
 *  - le générateur rend 2 à 4 « mots de la douleur », présents mot pour mot dans l'accroche, dont un au moins dans les
 *    3 premières secondes (`defautsMotsDouleur`, contrôle en code) ; ils suivent jusqu'aux règles (`motsDouleur` du
 *    contexte des règles), qui les cherchent à la place des mots de la description.
 */
import { contientExpression, mots, motsPleins, texteCompare } from "./controles-script/texte";
import { phrasesDe } from "./lecture";
import { CARACTERES_PAR_SECONDE_TABLEAU, DEBUT_DOULEUR_SEC, caracteresEn } from "./duree-tableau";
import { couperAuMot } from "./titres";

export { couperAuMot };

/** Borne du champ « douleur » de la fiche (`BORNES_FICHE.douleurMax`, contrat Usine § 21.2). */
export const DOULEUR_MAX_TABLEAU = 140;
/** Nombre de mots de la douleur rendus par le générateur. */
export const MOTS_DOULEUR_MIN = 2;
export const MOTS_DOULEUR_MAX = 4;
/** Longueur d'un « mot » de la douleur (un mot ou une courte expression). */
export const MOT_DOULEUR_LONGUEUR_MAX = 40;
/**
 * Marge prise sur les 3 premières secondes pour le mot de la douleur dit tôt : les règles placent les mots d'une scène à
 * débit égal (par mot), le générateur compte en caractères ; 80 % du temps couvre l'écart entre les deux.
 */
export const MARGE_DEBUT_DOULEUR = 0.8;

const espaces = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * Raccourcit une douleur à `max` caractères SANS la refuser : les premières phrases entières qui tiennent ; si la
 * première phrase seule est trop longue, elle est coupée au mot, avec « … ».
 */
export function raccourcirDouleur(texte: string, max = DOULEUR_MAX_TABLEAU): string {
  const t = espaces(texte);
  if (t.length <= max) return t;
  let garde = "";
  for (const p of phrasesDe(t)) {
    const essai = garde ? `${garde} ${p}` : p;
    if (essai.length > max) break;
    garde = essai;
  }
  return garde || couperAuMot(t, max);
}

/**
 * La douleur d'un script ÉCRIT par le générateur, telle qu'elle est DITE : les phrases de l'accroche, puis celles du
 * bloc « douleur », en phrases entières, tant qu'elles tiennent dans `max` caractères (au moins la première, raccourcie
 * au mot si elle est trop longue). Vide si le script n'a ni accroche ni douleur.
 */
export function douleurDepuisScript(script: { accroche: readonly { dit: string }[]; douleur: readonly { dit: string }[] }, max = DOULEUR_MAX_TABLEAU): string {
  const phrases = [...script.accroche, ...script.douleur].flatMap((p) => phrasesDe(p.dit));
  if (!phrases.length) return "";
  let garde = "";
  for (const p of phrases) {
    const essai = garde ? `${garde} ${p}` : p;
    if (essai.length > max) break;
    garde = essai;
  }
  return garde || couperAuMot(phrases[0], max);
}

/** Les mots de la douleur, propres : espaces resserrés, sans ponctuation autour, sans doublon, sans vide. */
export function nettoyerMotsDouleur(liste: readonly string[] | string | null | undefined): string[] {
  const brut = typeof liste === "string" ? liste.split(",") : Array.isArray(liste) ? liste : [];
  const vus = new Set<string>();
  const res: string[] = [];
  for (const x of brut) {
    if (typeof x !== "string") continue;
    const m = espaces(x).replace(/^[«»"“”'.,;:!?…()\s]+|[«»"“”.,;:!?…()\s]+$/gu, "");
    const cle = texteCompare(m);
    if (!m || !cle || vus.has(cle)) continue;
    vus.add(cle);
    res.push(m.slice(0, MOT_DOULEUR_LONGUEUR_MAX));
  }
  return res;
}

/**
 * Position (en caractères dits depuis le début du texte) du premier endroit où l'expression est dite, mot entier ;
 * `null` si elle n'y est pas.
 */
export function positionDite(texte: string, expression: string): number | null {
  const cible = mots(texteCompare(expression));
  if (!cible.length) return null;
  const ms = mots(espaces(texte));
  const cles = ms.map((m) => texteCompare(m));
  let avant = 0;
  for (let i = 0; i < ms.length; i++) {
    if (cible.every((c, k) => cles[i + k] === c)) return avant;
    avant += ms[i].length + 1;
  }
  return null;
}

/**
 * Défauts des mots de la douleur rendus par le générateur (PUR) : 2 à 4 mots, chacun porteur de sens (un mot plein au
 * moins), présent mot pour mot dans l'accroche dite, et l'un d'eux dit dans les 3 premières secondes. Messages en
 * français, qui disent quoi faire.
 */
export function defautsMotsDouleur(liste: readonly string[] | undefined, accrocheDite: string, caracteresParSeconde = CARACTERES_PAR_SECONDE_TABLEAU): string[] {
  const motsDouleur = nettoyerMotsDouleur(liste ?? []);
  if (motsDouleur.length < MOTS_DOULEUR_MIN || motsDouleur.length > MOTS_DOULEUR_MAX) {
    return [`Mots de la douleur : ${motsDouleur.length} donné${motsDouleur.length > 1 ? "s" : ""}, il en faut ${MOTS_DOULEUR_MIN} à ${MOTS_DOULEUR_MAX}, recopiés mot pour mot de l'accroche dite.`];
  }
  const d: string[] = [];
  for (const m of motsDouleur) {
    if (!motsPleins(m).length) d.push(`Le mot de la douleur « ${m} » ne porte aucun sens (mot outil) : prenez un mot plein de l'accroche (un verbe, un nom).`);
    else if (!contientExpression(accrocheDite, m)) d.push(`Le mot de la douleur « ${m} » n'est pas dit mot pour mot dans l'accroche (« ${espaces(accrocheDite)} ») : recopiez-le tel qu'il est dit.`);
  }
  if (d.length) return d;
  const limite = caracteresEn(DEBUT_DOULEUR_SEC * MARGE_DEBUT_DOULEUR, caracteresParSeconde);
  const tot = motsDouleur.some((m) => (positionDite(accrocheDite, m) ?? Infinity) <= limite);
  if (!tot) {
    d.push(`Aucun mot de la douleur n'est dit dans les ${DEBUT_DOULEUR_SEC} premières secondes (les ${limite} premiers caractères de l'accroche) : mettez l'un d'eux plus tôt dans l'accroche, ou choisissez un mot déjà dit au début.`);
  }
  return d;
}
