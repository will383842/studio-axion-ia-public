/**
 * À TRAITER (ATR-03) · KIT DE RÉPONSE MANUELLE pour LinkedIn page et TikTok. PUR : aucun réseau, aucune base, aucun import serveur.
 * Le kit ne fait que fabriquer un texte que l'opérateur COPIE puis colle À LA MAIN : le Studio n'écrit rien sur ces deux réseaux
 * (jamais de réponse automatique, RC-43). Aucune donnée de personne n'entre ici : titre du guide, mot, lien et extrait seulement.
 * Source unique des formulations : « TEXTES-VALIDES » du fondateur (message privé avec lien, 4 formulations ; série 5, rappel avec lien,
 * 3 formulations), recopiées mot pour mot. Aucune formulation nouvelle. Sans mention de message automatique, sans signature,
 * lien en dernier sans ponctuation après.
 */

export const LIMITE_TIKTOK = 150;
/** Limite technique d'un commentaire LinkedIn. */
export const LIMITE_LINKEDIN = 1250;
const PREMIERE_LIGNE_MAX = 120;

export type ReseauKit = "linkedin" | "tiktok";
export type RaisonAEcrireSoiMeme = "prix" | "reclamation" | "colere";

export interface FormulationKit {
  id: string;
  /** Réseaux pour lesquels cette formulation est proposée : LinkedIn plus posé (longues), TikTok court. */
  reseaux: readonly ReseauKit[];
  /** Marqueurs : [MOT], [TITRE DU GUIDE], [LIEN]. */
  texte: string;
}

export const FORMULATIONS_KIT: readonly FormulationKit[] = [
  { id: "lien-1", reseaux: ["linkedin"], texte: "Bonjour ! Merci pour votre commentaire, ça fait plaisir. Comme promis, voici votre guide « [TITRE DU GUIDE] ». Le lien reste ouvert 48 heures : [LIEN]" },
  { id: "lien-2", reseaux: ["linkedin"], texte: "Bonjour, et merci d'avoir commenté « [MOT] » ! Votre guide « [TITRE DU GUIDE] » est prêt. Vous avez 48 heures pour le récupérer ici : [LIEN]" },
  { id: "lien-3", reseaux: ["linkedin"], texte: "Merci pour votre message ! Je vous envoie le guide « [TITRE DU GUIDE] » comme convenu. Il vous attend pendant 48 heures à cette adresse : [LIEN]" },
  { id: "lien-4", reseaux: ["linkedin"], texte: "Bonjour ! Vous avez demandé le guide « [TITRE DU GUIDE] » : le voici. Bonne lecture, et merci pour votre intérêt. Lien valable 48 heures : [LIEN]" },
  { id: "rappel-1", reseaux: ["tiktok"], texte: "Voici votre guide « [TITRE DU GUIDE] », bonne lecture ! Le lien : [LIEN]" },
  { id: "rappel-2", reseaux: ["tiktok"], texte: "Le guide « [TITRE DU GUIDE] » est ici, avec plaisir. Bonne lecture : [LIEN]" },
  { id: "rappel-3", reseaux: ["linkedin", "tiktok"], texte: "Comme promis, voici le guide « [TITRE DU GUIDE] ». Il vous attend ici : [LIEN]" },
];

export interface EntreeKit {
  idEvenement: string;
  reseau: string;
  /** Mot détecté (majuscules) ou null. */
  mot?: string | null;
  titreGuide?: string | null;
  /** Lien du guide (https seulement). */
  lienGuide?: string | null;
  /** Lien direct vers le commentaire (https seulement), pour le bouton « Ouvrir le commentaire ». */
  lienCommentaire?: string | null;
  /** Texte du commentaire reçu, pour repérer réclamation, colère ou demande de prix. */
  commentaire?: string | null;
  /** Drapeau déjà posé par ailleurs : rien de tout fait n'est proposé. */
  aEcrireSoiMeme?: boolean;
}

export type RaisonNonCopiable = "trop_long" | "arobase";
export type RaisonIndisponible = "reseau_non_gere" | "guide_manquant";

export type ResultatKit =
  | {
      genre: "reponse";
      reseau: ReseauKit;
      /** Rang de la formulation choisie : stable pour une conversation, indépendant de la première ligne saisie. */
      indice: number;
      /** Première ligne VALIDÉE (par défaut), personnalisable. */
      premiereLigne: string;
      premiereLigneRefusee: boolean;
      texte: string;
      copiable: boolean;
      raisonNonCopiable?: RaisonNonCopiable;
    }
  | { genre: "a_ecrire_soi_meme"; raison: RaisonAEcrireSoiMeme }
  | { genre: "indisponible"; raison: RaisonIndisponible };

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const nbCaracteres = (s: string) => [...s].length;

/** Vrai si le texte porte une mention de message automatique ou une signature. Le kit n'en propose jamais. */
export function contientMentionAutomatique(texte: string): boolean {
  const t = sansAccent(texte);
  return /automati|axion|envoye par|cordialement|l'?equipe/.test(t);
}

/** Réclamation, colère ou demande de prix : rien de tout fait n'est proposé. Doute raisonnable = on signale. */
export function detecterAEcrireSoiMeme(commentaire: string | null | undefined): RaisonAEcrireSoiMeme | null {
  if (!commentaire) return null;
  const t = sansAccent(commentaire);
  if (/\b(prix|tarifs?|combien|coute[a-z]*|couts?|payants?|gratuit[es]*|abonnements?|euros?|tarification)\b|€|\$/.test(t)) return "prix";
  if (/rembours|reclamation|plainte|arnaque|escroc|(pas|rien|jamais|aucun[a-z]*)\s+(recu|arrive)|marche pas|fonctionne pas|probleme|signaler/.test(t)) return "reclamation";
  const lettres = [...commentaire].filter((c) => /\p{L}/u.test(c));
  const majuscules = lettres.filter((c) => c !== c.toLowerCase()).length;
  if (/\b(honte|scandale|scandaleu[a-z]*|nuls?|nulles?|marre|furieu[a-z]*|enerv[a-z]*|inadmissible|degoutant|mecontent[a-z]*|decu[a-z]*|ras le bol)\b|pas content|!{3,}/.test(t)) return "colere";
  if (lettres.length >= 12 && majuscules / lettres.length > 0.7) return "colere";
  return null;
}

const httpsSur = (lien: string | null | undefined): string | null => {
  if (!lien || /\s/.test(lien)) return null;
  try {
    return new URL(lien).protocol === "https:" ? lien : null;
  } catch {
    return null;
  }
};

/** Lien du commentaire proposé à l'ouverture : https et hôte du réseau (ou sous-domaine) seulement. */
export function lienCommentaireSur(reseau: string, lien: string | null | undefined): string | null {
  const l = httpsSur(lien);
  if (!l) return null;
  const hote = new URL(l).hostname.toLowerCase();
  const racine = reseau === "tiktok" ? "tiktok.com" : reseau === "linkedin" ? "linkedin.com" : null;
  return racine && (hote === racine || hote.endsWith("." + racine)) ? l : null;
}

/** Le bouton « Copier » n'est proposé que si cette fonction dit oui. TikTok : 150 caractères au plus et aucun @. */
export function copiePossible(reseau: ReseauKit, texte: string): boolean {
  return raisonNonCopiable(reseau, texte) === null;
}
function raisonNonCopiable(reseau: ReseauKit, texte: string): RaisonNonCopiable | null {
  if (reseau === "tiktok") {
    if (/[@＠]/.test(texte)) return "arobase";
    return nbCaracteres(texte) > LIMITE_TIKTOK ? "trop_long" : null;
  }
  return nbCaracteres(texte) > LIMITE_LINKEDIN ? "trop_long" : null;
}

/** Même entrée = même rang (empreinte FNV-1a) : un renvoi garde la même formulation. */
function rang(cle: string, n: number): number {
  let h = 0x811c9dc5;
  for (const c of cle) {
    h ^= c.codePointAt(0) as number;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % n;
}

function decouper(modele: string): { premiere: string; suite: string } {
  const m = /^([\s\S]*?[!?.])\s+([\s\S]*)$/.exec(modele);
  return m ? { premiere: m[1], suite: m[2] } : { premiere: "", suite: modele };
}
function rendre(modele: string, v: { mot: string | null; titre: string; lien: string }): string | null {
  if (modele.includes("[MOT]") && !v.mot) return null;
  return modele.split("[MOT]").join(v.mot ?? "").split("[TITRE DU GUIDE]").join(v.titre).split("[LIEN]").join(v.lien);
}

/** Nettoie la première ligne saisie : une seule ligne, sans mention automatique. Vide = on garde la validée. */
function nettoyerLigne(saisie: string | undefined): { ligne: string | null; refusee: boolean } {
  const l = (saisie ?? "").replace(/[\p{Cc}\s]+/gu, " ").trim();
  if (!l) return { ligne: null, refusee: false };
  if (contientMentionAutomatique(l) || nbCaracteres(l) > PREMIERE_LIGNE_MAX) return { ligne: null, refusee: true };
  return { ligne: l, refusee: false };
}

/**
 * Fabrique la réponse type d'une carte. `premiereLigne` (facultative) remplace la première phrase validée, avant la copie.
 * Réclamation, colère ou demande de prix : aucun texte tout fait. Aucun envoi, jamais.
 */
export function construireReponse(entree: EntreeKit, premiereLigne?: string): ResultatKit {
  if (entree.reseau !== "linkedin" && entree.reseau !== "tiktok") return { genre: "indisponible", raison: "reseau_non_gere" };
  const reseau: ReseauKit = entree.reseau;
  if (entree.aEcrireSoiMeme) return { genre: "a_ecrire_soi_meme", raison: "reclamation" };
  const drapeau = detecterAEcrireSoiMeme(entree.commentaire);
  if (drapeau) return { genre: "a_ecrire_soi_meme", raison: drapeau };
  const lien = httpsSur(entree.lienGuide);
  const titre = (entree.titreGuide ?? "").replace(/\s+/g, " ").trim();
  if (!lien || !titre) return { genre: "indisponible", raison: "guide_manquant" };
  const valeurs = { mot: entree.mot?.trim() || null, titre, lien };

  const candidates = FORMULATIONS_KIT.map((f, i) => ({ f, i })).filter(({ f }) => f.reseaux.includes(reseau) && rendre(f.texte, valeurs) !== null);
  if (candidates.length === 0) return { genre: "indisponible", raison: "guide_manquant" };
  const depart = rang(`kit/v1\n${reseau}\n${entree.idEvenement}`, candidates.length);
  const ordre = candidates.map((_, k) => candidates[(depart + k) % candidates.length]);
  // La formulation est choisie sur le texte validé (jamais sur la saisie) : elle reste la même quand on personnalise.
  const choisie = ordre.find(({ f }) => copiePossible(reseau, rendre(f.texte, valeurs) as string)) ?? ordre[0];
  const { premiere, suite } = decouper(choisie.f.texte);
  const ligneValidee = rendre(premiere, valeurs) ?? "";
  const { ligne, refusee } = nettoyerLigne(premiereLigne);
  const suiteRendue = rendre(suite, valeurs) as string;
  const texte = ligne !== null ? `${ligne} ${suiteRendue}` : (rendre(choisie.f.texte, valeurs) as string);
  const raison = raisonNonCopiable(reseau, texte);
  return {
    genre: "reponse",
    reseau,
    indice: choisie.i,
    premiereLigne: ligneValidee,
    premiereLigneRefusee: refusee,
    texte,
    copiable: raison === null,
    ...(raison ? { raisonNonCopiable: raison } : {}),
  };
}
