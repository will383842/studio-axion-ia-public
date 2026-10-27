/**
 * IMAGE → VIDÉO · MODE « SCRIPT COMPLET » · le script collé par Will REMPLACE l'étape d'écriture, et seulement elle.
 *
 * Aucun appel d'écriture, aucune réécriture : les mots de Will sont découpés en écrans À L'IDENTIQUE (rien n'est ajouté,
 * retiré ni changé ; seuls les blancs sont normalisés). La fiche qui en sort suit ensuite la chaîne habituelle : porte
 * « script », voix, mise en scène, rendu, contrôles et livraison.
 *
 * Contrôles gardés tels quels : un chiffre du script absent du schéma est refusé (Q05), un interdit aussi (Q08), la forme
 * de la fiche (FORME) et les phrases affirmatives restent à trancher par Will (Q05 bis). Les contrôles d'ossature d'un
 * script écrit par l'IA (Q04 chiffre ou bloc de l'image non dit, Q06 phrase-choc, Q07, Q09, Q10, chapitres) ne bloquent
 * jamais un script que Will a écrit : ce serait lui réclamer des mots.
 */
import { complexiteDe } from "@/domaine/image-video/complexite";
import type { CarteImage } from "@/domaine/image-video/carte";
import { motsDits, schemaFicheImage, VERSION_FICHE_IMAGE, type AccrocheFiche, type EcranFiche, type FicheImage, type Partie, type Scene } from "@/domaine/image-video/fiche";
import { DEBUT_REFUS_ECRITURE, type ResultatEcritureIV } from "./ecriture";
import { FOND_PAR_PARTIE } from "./recettes";
import { aTrancherParWill, empreinteDeCarte, verifierScript, type ContexteRegles, type Manquement, type VerdictScript } from "./regles";
import { refusScriptColle } from "./texte/script-limites";

export { nombreDeMotsDuScript, refusScriptColle, SCRIPT_CARACTERES_MAX, SCRIPT_MOTS_MAX } from "./texte/script-limites";

/** Mots de l'accroche au plus (Q07). */
const ACCROCHE_MOTS = 8;
/** Au-delà, un écran est coupé en deux (mots) ; l'écran est un confort de lecture, pas une règle. */
const ECRAN_MOTS_MAX = 16;
const ECRAN_CARACTERES_MAX = 380;
const ECRANS_MIN = 6;
const ECRANS_MAX = 60;

const nbMots = (jetons: readonly string[]) => jetons.filter((j) => /[\p{L}\p{N}]/u.test(j)).length;
const texteDe = (jetons: readonly string[]) => jetons.join(" ");
const finDePhrase = /[.!?…]["»”')\]]*$/;
const finDeMembre = /[,;:]["»”')\]]*$/;

/** Découpe en phrases, MOTS INCHANGÉS : un jeton qui finit par . ! ? … ferme la phrase. */
function phrases(script: string): string[][] {
  const res: string[][] = [];
  let cur: string[] = [];
  for (const j of script.normalize("NFC").split(/\s+/).filter(Boolean)) {
    cur.push(j);
    if (finDePhrase.test(j)) {
      res.push(cur);
      cur = [];
    }
  }
  if (cur.length) res.push(cur);
  return res;
}

/**
 * Coupe un morceau en deux : après une virgule (ou « ; », « : ») proche du milieu si elle existe, sinon au milieu des mots.
 * `max` : nombre de mots au plus dans la première moitié (accroche).
 */
function couper(jetons: readonly string[], max = Infinity): [string[], string[]] {
  const total = nbMots(jetons);
  const cible = Math.min(max, Math.ceil(total / 2));
  let meilleur = -1;
  let ecart = Infinity;
  let vus = 0;
  jetons.forEach((j, i) => {
    if (/[\p{L}\p{N}]/u.test(j)) vus++;
    if (i < jetons.length - 1 && finDeMembre.test(j) && vus >= 2 && vus <= max && total - vus >= 1 && Math.abs(vus - cible) < ecart) {
      meilleur = i;
      ecart = Math.abs(vus - cible);
    }
  });
  if (meilleur < 0) {
    vus = 0;
    meilleur = jetons.findIndex((j) => {
      if (/[\p{L}\p{N}]/u.test(j)) vus++;
      return vus >= cible;
    });
  }
  return [jetons.slice(0, meilleur + 1), jetons.slice(meilleur + 1)];
}

/** Les écrans : une phrase chacun, trop longue coupée, six au moins, soixante au plus ; la première fait 8 mots au plus. */
export function ecransDuScript(script: string): string[][] {
  let morceaux = phrases(script);
  if (morceaux.length && nbMots(morceaux[0]!) > ACCROCHE_MOTS) morceaux.splice(0, 1, ...couper(morceaux[0]!, ACCROCHE_MOTS));
  const trop = (m: readonly string[]) => nbMots(m) > ECRAN_MOTS_MAX || texteDe(m).length > ECRAN_CARACTERES_MAX;
  for (let i = 1; i < morceaux.length; i++) {
    if (trop(morceaux[i]!) && nbMots(morceaux[i]!) > 1) {
      morceaux.splice(i, 1, ...couper(morceaux[i]!));
      i--;
    }
  }
  while (morceaux.length < ECRANS_MIN) {
    let rang = -1;
    morceaux.forEach((m, i) => {
      if (nbMots(m) >= 2 && (rang < 0 || nbMots(m) > nbMots(morceaux[rang]!))) rang = i;
    });
    if (rang < 0) break;
    morceaux.splice(rang, 1, ...couper(morceaux[rang]!, rang === 0 ? ACCROCHE_MOTS : Infinity));
  }
  while (morceaux.length > ECRANS_MAX) {
    let rang = 1;
    for (let i = 1; i < morceaux.length - 1; i++) if (nbMots(morceaux[i]!) + nbMots(morceaux[i + 1]!) < nbMots(morceaux[rang]!) + nbMots(morceaux[rang + 1]!)) rang = i;
    morceaux = [...morceaux.slice(0, rang), [...morceaux[rang]!, ...morceaux[rang + 1]!], ...morceaux.slice(rang + 2)];
  }
  return morceaux;
}

/** Les `max` premiers mots d'un morceau (jetons inchangés). */
function premiersMots(jetons: readonly string[], max: number): string[] {
  let vus = 0;
  const fin = jetons.findIndex((j) => /[\p{L}\p{N}]/u.test(j) && ++vus >= max);
  return fin < 0 ? [...jetons] : jetons.slice(0, fin + 1);
}

const idEcran = (i: number) => `e${String(i + 1).padStart(2, "0")}`;
const sansAccents = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const racines = (t: string) => new Set(sansAccents(t).split(/[^a-z0-9]+/).filter((m) => m.length >= 4));

/** Texte affiché : le début de ce qui est dit, 80 caractères au plus, coupé entre deux mots. */
function texteAffiche(t: string): string {
  if (t.length <= 80) return t;
  return t.slice(0, 80).replace(/\s+\S*$/, "");
}

function partieDe(i: number, n: number): Partie {
  if (i === 0) return "accroche";
  if (i === n - 1) return "phrase-choc";
  if (i === n - 2) return "resultat";
  return i === 1 ? "douleur" : i === 2 ? "debut-reponse" : "explication";
}

/** Chaque bloc de la carte est montré par un écran d'explication : celui qui en parle, sinon le plus proche dans l'ordre. */
function refsDesEcrans(carte: CarteImage, partiesEcrans: readonly Partie[], textes: readonly string[]): string[][] {
  const refs: string[][] = textes.map(() => []);
  const cibles = partiesEcrans.flatMap((p, i) => (p === "explication" ? [i] : []));
  if (!cibles.length) return refs;
  const noeuds = [...carte.noeuds].filter((n) => !n.photoPersonnes).sort((a, b) => a.ordre - b.ordre);
  noeuds.forEach((n, k) => {
    const mots = racines(n.libelle);
    let choix = cibles[Math.min(cibles.length - 1, Math.floor((k * cibles.length) / noeuds.length))]!;
    let score = 0;
    for (const c of cibles) {
      const s = [...racines(textes[c]!)].filter((m) => mots.has(m)).length;
      if (s > score) {
        score = s;
        choix = c;
      }
    }
    refs[choix]!.push(n.id);
  });
  return refs;
}

const familleDe = (t: string): AccrocheFiche["famille"] => (/\d/.test(t) ? "chiffre" : /\?/.test(t) ? "question" : "situation");

/** La fiche du script collé (PUR). Les mots dits des écrans, mis bout à bout, sont ceux du script. */
export function ficheDuScriptColle(script: string, carte: CarteImage): FicheImage {
  const morceaux = ecransDuScript(script);
  const textes = morceaux.map(texteDe);
  const n = morceaux.length;
  const parties = textes.map((_, i) => partieDe(i, n));
  const refs = refsDesEcrans(carte, parties, textes);
  const ecrans: EcranFiche[] = textes.map((texteDit, i) => {
    const partie = parties[i]!;
    const r = refs[i]!;
    const nbDits = motsDits(texteDit).length;
    const scene: Scene = partie === "accroche" ? "accroche" : partie === "phrase-choc" ? "phrase-choc" : r.length ? "toile" : "titre";
    return {
      id: idEcran(i),
      partie,
      scene,
      refs: r,
      texteDit,
      textesEcran: scene === "toile" ? [] : [texteAffiche(texteDit)],
      surMot: r.slice(0, 12).map((ref, k) => ({ mot: Math.min(nbDits - 1, Math.floor((k * nbDits) / r.length)), action: "apparait" as const, ref })),
      fond: FOND_PAR_PARTIE[partie],
    };
  });
  const premiere = textes[0]!;
  const secondeNette = texteDe(premiersMots(morceaux[1]!, ACCROCHE_MOTS));
  const accrocheA: AccrocheFiche = { famille: familleDe(premiere), texteDit: premiere, textesEcran: [texteAffiche(premiere)] };
  const accrocheB: AccrocheFiche = { famille: accrocheA.famille === "question" ? "situation" : "question", texteDit: secondeNette, textesEcran: [texteAffiche(secondeNette)] };
  return {
    version: VERSION_FICHE_IMAGE,
    empreinteCarte: empreinteDeCarte(carte),
    accroches: [accrocheA, accrocheB],
    ecrans,
    // Dite seulement si Will choisit le réglage « question puis fin » ; jamais dans le corps.
    questionCommentaire: { texteDit: "Et vous, quelle tâche confieriez-vous à l'IA en premier ?", texteEcran: "Votre première tâche ?" },
    chapitres: [],
  };
}

/**
 * Ce qui bloque un script que Will a écrit : un chiffre absent du schéma, un interdit, une fiche mal formée, et une phrase
 * affirmative non tranchée. Tout le reste (ossature, durée, phrase-choc…) reste une remarque, jamais un refus.
 */
export function bloqueUnScriptColle(m: Pick<Manquement, "regle" | "priorite" | "pourWill">): boolean {
  if (m.regle === "FORME" || m.regle === "Q05") return true;
  if (m.regle === "Q08") return !m.pourWill;
  return m.regle === "Q05bis" && m.priorite === 2;
}

/** Les manquements qui bloquent, du verdict d'un script collé. */
export const manquementsDuScriptColle = (v: Pick<VerdictScript, "manquements">): Manquement[] => v.manquements.filter(bloqueUnScriptColle);

export interface EntreeScriptColleIV extends Omit<ContexteRegles, "complexite"> {
  script: string;
}

/** Remplace `ecrireScriptIV` : aucun appel, aucun coût. Même forme de résultat, pour que la chaîne ne voie pas la différence. */
export function ecrireScriptColleIV(entree: EntreeScriptColleIV): ResultatEcritureIV {
  const refusDe = (message: string, refus = [message]): ResultatEcritureIV => ({ ok: false, motif: "refusee", message, refus, appels: 0 });
  const avant = refusScriptColle(entree.script);
  if (avant) return refusDe(avant.message);
  const fiche = ficheDuScriptColle(entree.script, entree.carte);
  const forme = schemaFicheImage.safeParse(fiche);
  if (!forme.success) return refusDe(`${DEBUT_REFUS_ECRITURE} : votre script n'a pas pu être découpé en écrans.`);
  const verdict = verifierScript(forme.data, { carte: entree.carte, complexite: complexiteDe(entree.carte), ...(entree.choixFormules ? { choixFormules: entree.choixFormules } : {}), ...(entree.interdits ? { interdits: entree.interdits } : {}), ...(entree.recit ? { recit: entree.recit } : {}) });
  const bloquants = manquementsDuScriptColle(verdict);
  const refus = bloquants.filter((m) => !(m.regle === "Q05bis"));
  if (refus.length) {
    const messages = refus.map((m) => m.message);
    return { ok: false, motif: "refusee", message: `${DEBUT_REFUS_ECRITURE} : ${messages[0]} Corrigez votre script (sans ce point) et déposez-le de nouveau.`, refus: messages, appels: 0 };
  }
  const aTrancher = aTrancherParWill({ manquements: bloquants });
  const filtre: VerdictScript = { ...verdict, manquements: bloquants, ok: bloquants.length === 0 };
  const commun = { fiche: forme.data, verdict: filtre, aTrancher, appels: 0, relance: false, simule: false };
  if (!filtre.ok) {
    const refusWill = bloquants.map((m) => m.message);
    return { ok: false, motif: "a-trancher", message: `Script collé : ${refusWill.length} point(s) à trancher par Will avant validation.`, refus: refusWill, ...commun };
  }
  return { ok: true, ...commun };
}
