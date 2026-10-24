/**
 * GARDES DES TEXTES D'UN CAS (cas ajouté à la main, puis cas modifié). PUR : aucun accès au serveur, aucun appel.
 *
 * Mêmes garde-fous que le stock de 96 cas (`tests/cas-concret/stock-metiers/stock-textes-garde.test.ts`) : un texte écrit
 * à la main ne contient aucun nombre, aucun nom propre, aucune tournure d'usage réel, aucun « je / nous / notre », aucun mot
 * interdit du format. On IMPORTE les fonctions de `regles.ts` (déjà utilisées en production) ; ce fichier ne les modifie pas.
 */
import { raconteUnClient } from "@/domaine/controles-script/probleme";
import { contientExpression } from "@/domaine/controles-script/texte";
import { annonceConformite, MOTS_INTERDITS_FORMAT, nombresDe, nomsPropres, sansPointsDeSigle, tutoie, TOURNURES_USAGE_REEL } from "./regles";

export interface ChampTexte {
  /** Nom du champ en clair, tel que Will le lit dans le formulaire (« Titre », « Scène »…). */
  nom: string;
  texte: string;
}

export interface OptionsGardesTextes {
  /** Ce champ est une scène : elle ne raconte pas un client réel. */
  scene?: boolean;
}

/** Mots entiers « je », « j' », « nous », « notre », « nos » (apostrophe droite ou courbe), sans tenir compte de la casse. */
const JE_NOUS = /(?<![\p{L}\p{N}])(?:je|nous|notre|nos)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])j['’]/iu;

/** Expressions refusées partout (la marque et ses interdits de Will). */
const EXPRESSIONS_INTERDITES: readonly { motif: RegExp; phrase: string }[] = [
  { motif: /grenoble/i, phrase: "ne nomme jamais Grenoble (« partout en France »)" },
  { motif: /aucun gain garanti/i, phrase: "ne dit jamais « aucun gain garanti »" },
  { motif: /j['’]aide/i, phrase: "ne dit pas « j'aide » (image d'entreprise, pas de freelance)" },
  { motif: /faites[- ]le vous[- ]m[eê]me/i, phrase: "ne dit pas « faites-le vous-même » (on s'occupe de tout)" },
];

/** Les raisons, une par problème, chacune précédée du nom du champ (« Titre : … »). Liste vide : rien à reprocher. */
export function refusTextesCas(champs: readonly ChampTexte[], options: Record<string, OptionsGardesTextes> = {}): string[] {
  const raisons: string[] = [];
  for (const { nom, texte } of champs) {
    const t = texte ?? "";
    if (!t.trim()) continue;
    const nombres = nombresDe(sansPointsDeSigle(t));
    if (nombres.length) raisons.push(`${nom} : contient un nombre (${nombres.join(", ")}). Aucun chiffre n'est dit sans fait vérifié : écrivez-le en mots généraux.`);
    const noms = nomsPropres(t);
    if (noms.length) raisons.push(`${nom} : contient un nom propre (${noms.join(", ")}). Aucun nom de personne, d'entreprise ou de lieu.`);
    const tournure = TOURNURES_USAGE_REEL.find((x) => contientExpression(t, x));
    if (tournure) raisons.push(`${nom} : « ${tournure} » laisse croire à un usage réel. Présentez un exemple, pas un client.`);
    if (JE_NOUS.test(t)) raisons.push(`${nom} : parle à la première personne (je, nous, notre). Parlez de « vous » ou de la situation.`);
    if (tutoie(t)) raisons.push(`${nom} : tutoie. Le format vouvoie.`);
    for (const { motif, phrase } of EXPRESSIONS_INTERDITES) if (motif.test(t)) raisons.push(`${nom} : ${phrase}.`);
    const mot = MOTS_INTERDITS_FORMAT.find((m) => contientExpression(t, m));
    if (mot) raisons.push(`${nom} : le mot « ${mot} » est interdit dans ce format.`);
    if (annonceConformite(t)) raisons.push(`${nom} : parle de conformité (RGPD…) sans la phrase validée. Retirez cette mention.`);
    if (options[nom]?.scene && raconteUnClient(t)) raisons.push(`${nom} : raconte un client réel. Décrivez la situation au présent, sans personne précise.`);
  }
  return raisons;
}

/* ------------------------------------------------------------------ */
/* Mots clés du sujet                                                    */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set(["des", "les", "vos", "vous", "une", "que", "qui", "pour", "dans", "avec", "sans", "sur", "par", "est", "sont", "aux", "mais", "plus", "pas", "leur", "leurs", "cette", "ces", "ses", "son", "mon", "mes", "tout", "tous", "toute", "toutes", "elle", "elles", "ils", "nous", "fait", "faire", "entre", "chez", "sous", "donc", "car"]);

/** Les 2 ou 3 mots les plus longs du sujet (lettres et tirets, 3 à 30 caractères, hors mots vides), dans l'ordre du sujet. */
export function motsClesParDefaut(sujet: string): string[] {
  const vus = new Set<string>();
  const mots: { mot: string; rang: number }[] = [];
  (sujet.match(/[\p{L}-]+/gu) ?? []).forEach((m, rang) => {
    const mot = m.replace(/^-+|-+$/g, "");
    const cle = mot.toLowerCase();
    if (mot.length < 3 || mot.length > 30 || MOTS_VIDES.has(cle) || vus.has(cle)) return;
    vus.add(cle);
    mots.push({ mot, rang });
  });
  const choisis = [...mots].sort((a, b) => b.mot.length - a.mot.length || a.rang - b.rang).slice(0, 3);
  return choisis.sort((a, b) => a.rang - b.rang).map((x) => x.mot);
}
