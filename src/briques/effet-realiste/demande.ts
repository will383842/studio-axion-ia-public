/**
 * EFFET RÉALISTE PAR IA — LECTURE DE LA DEMANDE DE WILL (lot K). PUR.
 *
 * Vocabulaire OUVERT : on ne cherche pas une liste d'effets, on repère qu'une action réaliste est demandée (un objet
 * qui apparaît, est posé, lancé…), et on en tire ce qui sert au moment, au devis et à la consigne vidéo :
 *  - `estDemandeEffetRealiste` : « réaliste », « en vrai », « par IA », ou une action que la 3D ne sait pas faire
 *    (jeter vers l'écran, poser sur le bureau) ; « en 3D » reste la version GRATUITE (lot I / I2) ; « ultra réaliste »
 *    reste l'option du lot I2 ; une négation ne déclenche rien ;
 *  - `lireDemandeEffet` : objet, main, action qui finit sur l'écran, bruitage suggéré, durée dite.
 */
import type { ObjetConnu } from "./types";

export const normaliser = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, " ")
    .replace(/-/g, " ");

const MARQUE_REALISTE = /\b(realiste|realistes|photo ?realiste|par (l )?ia|en vrai|pour de vrai|reel|reelle|vrai telephone|vraie tasse|comme en vrai|video ia)\b/;
const ULTRA = /\b(ultra|hyper) ?realist/;
const EN_3D = /\ben 3 ?d\b|\b3 ?d\b/;
const NEGATION = /\b(pas|sans|aucun|aucune|jamais|plus de)\b[^.,;]*\b(realiste|ia|effet|objet|telephone|tasse)\b|\b(enleve|retire|annule)\b/;
/** Actions qu'un objet 3D posé sur la paume ne sait pas rendre : lancer, poser dans le décor, verser… */
const ACTION_REELLE = /\b(jette|jeter|jetez|lance|lancer|lancez|balance|balancer|envoie|envoyer|projette|projeter)\b|\b(pose|poser|posee|mets|mettre|met|ajoute|rajoute|fais apparaitre)\b[^.]*\bsur (le|la|mon|ma) (bureau|table|etagere|meuble)\b|\b(verse|verser|boit|boire|ouvre|ouvrir)\b/;
const OBJET = /\b(telephone|portable|smartphone|iphone|mobile|logo|tasse|cafe|mug|livre|stylo|carte bancaire|carte bleue|cle|cles|objet)\b/;
const VERS_ECRAN = /\b(sur|contre|vers|dans) (l |la )?(ecran|camera|objectif|vitre)\b|\bvers (moi|vous|nous)\b|\bcasse l ecran\b/;

/** Le message demande-t-il un EFFET RÉALISTE PAR IA (option payante) ? */
export function estDemandeEffetRealiste(message: string): boolean {
  const t = normaliser(message);
  if (ULTRA.test(t)) return false;
  if (EN_3D.test(t) && !MARQUE_REALISTE.test(t)) return false;
  if (NEGATION.test(t)) return false;
  if (!OBJET.test(t) && !/\b(apparaitre|apparait|surgir)\b/.test(t)) return false;
  return MARQUE_REALISTE.test(t) || ACTION_REELLE.test(t);
}

export function objetDeLaDemande(message: string): ObjetConnu {
  const t = normaliser(message);
  if (/\b(telephone|portable|smartphone|iphone|mobile)\b/.test(t)) return "telephone";
  if (/\blogo\b/.test(t)) return "logo-axion";
  if (/\b(tasse|cafe|mug)\b/.test(t)) return "tasse";
  if (/\blivre\b/.test(t)) return "livre";
  if (/\bstylo\b/.test(t)) return "stylo";
  if (/\bcarte (bancaire|bleue)\b/.test(t)) return "carte-bancaire";
  if (/\bcles?\b/.test(t)) return "cle";
  return "autre";
}

export interface DemandeEffetLue {
  objet: ObjetConnu;
  /** L'objet apparaît dans la main de Will. */
  dansLaMain: boolean;
  /** L'objet est lancé vers la caméra et finit sur l'écran (vitre brisée enchaînée). */
  finitSurEcran: boolean;
  /** L'objet est posé dans le décor (bureau, table). */
  dansLeDecor: boolean;
  /** Durée dite (« pendant 6 secondes ») ; null sinon. */
  dureeSec: number | null;
  sonSuggere: string | null;
}

export function lireDemandeEffet(message: string): DemandeEffetLue {
  const t = normaliser(message);
  const lance = /\b(jette|jeter|jetez|lance|lancer|lancez|balance|balancer|envoie|envoyer|projette|projeter)\b/.test(t);
  const finitSurEcran = lance && (VERS_ECRAN.test(t) || /\b(ecran|camera)\b/.test(t));
  const duree = t.match(/\b(\d{1,2})\s*(s|sec|secondes?)\b/);
  const dansLeDecor = /\bsur (le|la|mon|ma) (bureau|table|etagere|meuble)\b/.test(t);
  return {
    objet: objetDeLaDemande(message),
    dansLaMain: /\b(dans|sur) (ma|la|mes|sa) (main|paume|mains)\b|\bpaume\b/.test(t) || (lance && !dansLeDecor),
    finitSurEcran,
    dansLeDecor,
    dureeSec: duree ? Number(duree[1]) : null,
    sonSuggere: finitSurEcran ? "verre" : lance ? "whoosh" : null,
  };
}

/** Mots qui désignent l'objet dans la parole de Will (moment où il en parle). */
export const MOTS_DE_L_OBJET: Record<ObjetConnu, string[]> = {
  telephone: ["telephone", "portable", "smartphone", "iphone", "mobile", "appli", "application", "ecran", "message", "sms", "appel"],
  "logo-axion": ["axion", "logo", "marque", "studio"],
  tasse: ["cafe", "tasse", "pause", "matin", "boire"],
  livre: ["livre", "lire", "lecture", "page"],
  stylo: ["stylo", "ecrire", "signer", "signature", "contrat"],
  "carte-bancaire": ["carte", "payer", "paiement", "prix", "euros", "argent"],
  cle: ["cle", "cles", "acces", "ouvrir", "porte"],
  autre: [],
};
