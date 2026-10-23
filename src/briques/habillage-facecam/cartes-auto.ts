/**
 * CARTES AUTOMATIQUES DU FACE CAMÉRA (correctif du 10/10, plainte de Will sur IMG_7747 v2 : « les animations ne
 * correspondent pas, pas complètes, mal positionnées, pas assez »). PUR, sans alias « @/ ».
 *
 * Avant : une carte par phrase choisie par `choisirModeleTous`, 3 au plus, sans regarder ce qui est vraiment énuméré :
 * « un outil de plus » devenait une liste titrée « veut colmater en ajoutant un outil » avec un seul point « De plus ».
 * Maintenant, chaque carte illustre EXACTEMENT ce qui est dit au moment où c'est dit :
 *   - ses textes viennent des mots dits (jamais un mot de liaison seul, jamais un mot absent de la phrase) ;
 *   - une liste a au moins 2 éléments RÉELLEMENT énumérés (marqueurs « Un, Deux, Trois » ou 1. 2. 3. d'une phrase à
 *     l'autre ; au moins 3 propositions parallèles : « on forme…, on accompagne…, on audite… et on automatise… ») ;
 *   - début, fin et apparition de chaque élément sont calés sur les mots alignés (temps de la vidéo montée) ;
 *   - densité : une carte toutes les 12 à 20 s environ (réglable), jamais deux cartes qui se chevauchent, toujours en
 *     moitié haute (écran partagé : le visage reste visible en bas) ;
 *   - détecteurs, du plus sûr au moins sûr : liste numérotée, propositions parallèles, chiffre (et ses qualificatifs :
 *     « 45 min · gratuit · en visio »), titre nommé (« Le diagnostic fuite »), problème → solution (« X, alors que la
 *     vraie première étape, c'est de Y »), noms énumérés (« une formation…, un audit complet… »), « pas X, Y » (icône +
 *     mot), appel à l'action final ; les règles des 13 modèles (`choisirModeleTous`) passées au crible (aucune carte
 *     absurde) : graphique, check-list, avant / après et documentaire bien reconnus sont posés d'office, les autres
 *     servent à combler un trou de plus de 20 s.
 */
import { iconePour } from "../motion/choix";
import { choisirModeleTous } from "../motion/choix-etendu";
import { estModeleEtendu } from "../motion/catalogue-etendu";
import { tientEnMoitieHaute } from "../motion/disposition-etendue";
import type { CarteModeleEtendu, CarteMotionTous } from "../motion/types-etendus";

export interface MotCarte {
  mot: string;
  debutSec: number;
  finSec: number;
}

export const REGLES_CARTES_AUTO = {
  /** Écart visé entre deux débuts de carte : on comble au-delà du maximum. */
  ecartCibleSec: [12, 20] as [number, number],
  /** Jamais deux cartes à moins de… (fin de l'une → début de l'autre) : l'écran partagé peut enchaîner deux cartes. */
  ecartMinSec: 0.3,
  /** Durée d'une carte (garde-fou commun de la brique motion). */
  dureeSec: [3, 8] as [number, number],
  /** Jamais pendant l'accroche. */
  pasAvantSec: 2,
  /** Une carte reste un peu après le dernier mot illustré. */
  traineSec: 0.5,
  /** Confiance minimale d'une carte de comblement (règles des 13 modèles). */
  confianceComblement: 0.7,
  /**
   * Panneau jamais vide (finitions du 10/10) : l'écran partagé s'ouvre au plus tant de secondes avant le premier
   * contenu principal de sa carte (entrée du panneau : 9 images = 0,36 s ; un titre ou un sur-titre seul ne compte pas).
   */
  avancePanneauSec: 0.4,
};
export type ReglesCartesAuto = typeof REGLES_CARTES_AUTO;

export interface CarteAuto {
  debutSec: number;
  finSec: number;
  carte: CarteMotionTous;
  raison: string;
  /** Priorité : plus haut, plus sûr. */
  score: number;
  /** Fin du dernier mot illustré : la traîne après lui peut être raccourcie pour laisser passer la carte suivante. */
  finDitSec?: number;
}

/* ------------------------------------------------------------------ */
/* Outils de texte                                                      */
/* ------------------------------------------------------------------ */

const normaliser = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’]/g, "'");
const nu = (s: string) => normaliser(s).replace(/[^a-z0-9'-]/g, "");
const majuscule = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** Texte lisible d'une suite de mots (« n », « 'en » → « n'en » ; ponctuation de fin retirée). */
function texteDe(mots: MotCarte[], garderQuestion = false): string {
  const brut = mots
    .map((m) => m.mot)
    .join(" ")
    .replace(/\s+(['’-])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const q = /\?\s*$/.test(brut);
  const sans = brut.replace(/^[\s,;:.–—-]+|[\s,;:.!?…–—-]+$/g, "").trim();
  return majuscule(garderQuestion && q ? `${sans} ?` : sans);
}

/** Mots de liaison : un élément qui n'est fait que d'eux n'est jamais affiché. */
const LIAISON = new Set(["de", "du", "des", "plus", "en", "et", "ou", "puis", "alors", "donc", "mais", "aussi", "encore", "ensuite", "enfin", "la", "le", "les", "un", "une", "a", "au", "aux", "pour", "par", "avec", "sur", "dans", "que", "qui", "ce", "c'est", "l", "d", "peut-etre"]);
const porteDuSens = (texte: string) => texte.split(/[\s'’]+/).map(nu).some((m) => m.length > 1 && !LIAISON.has(m));

/** Une phrase : index de ses mots. */
interface Phrase {
  idx: number[];
}

const MARQUEUR_NUMERO = /^(\d{1,2})[.)]?,?$/;
/** Score d'une liste numérotée : la plus prioritaire (une énumération dite « Un, Deux, Trois » a toujours sa carte). */
const SCORE_NUMEROTEE = 10;
const ORDINAUX: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, premierement: 1, deuxiemement: 2, troisiemement: 3, quatriemement: 4 };

function phrasesDe(mots: MotCarte[]): Phrase[] {
  const phrases: Phrase[] = [];
  let cour: number[] = [];
  mots.forEach((m, i) => {
    cour.push(i);
    // « 1. » seul n'est pas une fin de phrase : c'est le numéro de la suivante.
    const seulNumero = cour.length === 1 && MARQUEUR_NUMERO.test(m.mot.trim());
    const suivant = mots[i + 1];
    if (!seulNumero && (!suivant || /[.!?…]["»”]?$/.test(m.mot) || (m.mot.trim() === "?" && cour.length > 1) || suivant.debutSec - m.finSec > 1.2)) {
      phrases.push({ idx: cour });
      cour = [];
    }
  });
  if (cour.length) phrases.push({ idx: cour });
  // Une phrase réduite à « ? » est rattachée à la précédente.
  const sortie: Phrase[] = [];
  for (const p of phrases) {
    if (p.idx.length === 1 && mots[p.idx[0]].mot.trim() === "?" && sortie.length) sortie[sortie.length - 1].idx.push(p.idx[0]);
    else sortie.push(p);
  }
  return sortie;
}

/** Propositions d'une phrase : coupées après une virgule, un point-virgule, deux-points, ou avant « et ». */
function propositions(mots: MotCarte[], p: Phrase): number[][] {
  const sortie: number[][] = [];
  let cour: number[] = [];
  for (const i of p.idx) {
    if (nu(mots[i].mot) === "et" && cour.length) {
      sortie.push(cour);
      cour = [];
      continue;
    }
    cour.push(i);
    if (/[,;:]$/.test(mots[i].mot)) {
      sortie.push(cour);
      cour = [];
    }
  }
  if (cour.length) sortie.push(cour);
  return sortie;
}

/** Durée bornée d'une carte qui couvre [debut, fin dit] (+ traîne). */
function bornes(debut: number, finDit: number, dureeVideo: number, r: ReglesCartesAuto): { debutSec: number; finSec: number; finDitSec: number } {
  const d = Math.max(r.pasAvantSec, debut);
  let f = Math.min(finDit + r.traineSec, d + r.dureeSec[1]);
  f = Math.max(f, d + r.dureeSec[0]);
  if (f > dureeVideo - 0.05) {
    f = dureeVideo - 0.05;
    return { debutSec: +Math.max(r.pasAvantSec, Math.min(d, f - r.dureeSec[0])).toFixed(3), finSec: +f.toFixed(3), finDitSec: +Math.min(finDit, f).toFixed(3) };
  }
  return { debutSec: +d.toFixed(3), finSec: +f.toFixed(3), finDitSec: +Math.min(finDit, f).toFixed(3) };
}
const rel = (t: number, debut: number) => +Math.max(0, t - debut).toFixed(3);

/* ------------------------------------------------------------------ */
/* Détecteurs                                                           */
/* ------------------------------------------------------------------ */

/** « De quoi avez-vous besoin pour avancer ? » → « De quoi avez-vous besoin ? » (le but final est retiré). */
function raccourcirQuestion(texte: string): string {
  const q = /\?$/.test(texte);
  let t = texte.replace(/\s*\?$/, "");
  const but = /\s+pour\s+[a-zà-ÿ'-]+(?:\s+[a-zà-ÿ'-]+)?$/i.exec(t);
  if (but && t.slice(0, but.index).split(/\s+/).length >= 3) t = t.slice(0, but.index);
  const mots = t.split(/\s+/);
  if (mots.length > 7) t = mots.slice(0, 7).join(" ");
  return q ? `${t} ?` : t;
}

/** Marqueurs d'ordre en lettres (« Un », « Deuxièmement »…). */
const ORDINAUX_MARQUEURS: Record<string, number> = { ...ORDINAUX, cinq: 5, cinquiemement: 5 };
const PONCTUATION_SEULE = /^[,;:.!?…–—\-/)]+$/;
const FIN_DE_PHRASE = /[.!?…]["»”]?$/;

/**
 * Numéro d'ordre porté par le mot `i` s'il ouvre une proposition (début du texte, ou après une ponctuation) : « Un, »,
 * « Un : », « Un. », « 2. », « 3) », « Troisièmement, », et même « Deux » sans ponctuation (la suite 1, 2… est exigée
 * ensuite). Sinon null.
 */
function marqueurA(mots: MotCarte[], i: number): number | null {
  const brut = mots[i].mot.trim();
  // « …, et trois, de quoi… » : la liaison devant le numéro est sautée.
  const liaison = i >= 2 && /^(et|puis|enfin)$/i.test(mots[i - 1].mot.trim());
  const avant = mots[i - (liaison ? 2 : 1)]?.mot.trim();
  if (avant !== undefined && !/[,;:.!?…–—\-)]$/.test(avant)) return null;
  const chiffre = /^(\d{1,2})[.):/,-]?$/.exec(brut);
  if (chiffre) return Number(chiffre[1]) || null;
  const n = ORDINAUX_MARQUEURS[nu(brut.replace(/[,;:.)/–—-]+$/, ""))];
  if (!n) return null;
  // En lettres sans ponctuation (« Deux qu'est-ce… ») : seulement en tête de phrase (« une entreprise, deux… » n'en est pas une).
  const ponctue = /[,;:.)/–—-]$/.test(brut) || PONCTUATION_SEULE.test(mots[i + 1]?.mot.trim() ?? "");
  return ponctue || avant === undefined || /[.!?…]["»”]?$/.test(avant) || PONCTUATION_SEULE.test(avant) ? n : null;
}

/**
 * Liste numérotée : « Un, … ? Deux, … ? Trois, … ? » (ou 1. 2. 3., Premièrement…). Lue MOT PAR MOT, sans dépendre du
 * découpage en phrases : sur IMG_7747 v3 (prod), la liste dite « Un / Deux / Trois » n'est pas sortie, alors que ses
 * mots étaient là. L'ancienne détection exigeait que chaque numéro ouvre une phrase et soit suivi d'une virgule : un
 * « Un : » ou « Un. » du texte validé, ou un blanc de plus de 1,2 s de l'aligneur juste après « Un, » ou « Trois, »
 * (phrase réduite au numéro, point vide), suffisaient à la perdre. Une énumération dite doit TOUJOURS avoir sa carte.
 */
function listesNumerotees(mots: MotCarte[], _phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  const marqueurs = mots.flatMap((_, i) => {
    const n = marqueurA(mots, i);
    return n ? [{ i, n }] : [];
  });
  for (let k = 0; k < marqueurs.length; k++) {
    if (marqueurs[k].n !== 1) continue;
    // La suite 1, 2, 3… : chaque numéro à moins de 18 mots et 10 s du précédent ; un nouveau « 1 » la relance.
    const suite = [marqueurs[k]];
    for (let j = k + 1; j < marqueurs.length && suite.length < 5; j++) {
      const m = marqueurs[j];
      const dernier = suite[suite.length - 1];
      if (m.i - dernier.i > 18 || mots[m.i].debutSec - mots[dernier.i].finSec > 10) break;
      if (m.n === 1) break;
      if (m.n === suite.length + 1) suite.push(m);
    }
    if (suite.length < 2) continue;
    // Chaque point : les mots entre son numéro et le suivant ; le dernier va jusqu'à la fin de sa phrase (12 mots au plus).
    const corps = suite.map((m, q) => {
      const debut = m.i + 1;
      let fin: number;
      if (q + 1 < suite.length) fin = suite[q + 1].i;
      else {
        fin = debut;
        while (fin < mots.length && fin - debut < 12) {
          fin++;
          if (FIN_DE_PHRASE.test(mots[fin - 1].mot.trim())) break;
          if (mots[fin] && mots[fin].debutSec - mots[fin - 1].finSec > 1.2) break;
        }
      }
      return mots.slice(debut, fin).filter((x, z) => !(z === 0 && PONCTUATION_SEULE.test(x.mot.trim())));
    });
    const elements = corps.map((c, q) => ({ texte: raccourcirQuestion(texteDe(c, true)), aSec: mots[suite[q].i].debutSec }));
    if (elements.some((e) => !porteDuSens(e.texte))) continue;
    const dernierMot = corps[corps.length - 1].at(-1) ?? mots[suite[suite.length - 1].i];
    const b = bornes(mots[suite[0].i].debutSec - 0.2, dernierMot.finSec, dureeVideo, r);
    const questions = elements.every((e) => /\?$/.test(e.texte));
    sortie.push({
      ...b,
      carte: { modele: "liste", donnees: { ...(questions ? { titre: `${elements.length} questions` } : {}), numerotee: true, elements: elements.map((e) => ({ texte: e.texte, aSec: rel(e.aSec, b.debutSec) })) } },
      raison: "une énumération numérotée",
      score: SCORE_NUMEROTEE,
    });
    k = marqueurs.indexOf(suite[suite.length - 1]);
  }
  return sortie;
}

/** Cibles trop générales pour être affichées (« les dirigeants », « des entreprises », « tout ce qui… »). */
const GENERIQUES = /^(?:les|des|nos|vos|leurs?|ces)\s+(?:dirigeants?|entreprises?|soci[ée]t[ée]s|clients?|gens|personnes|pme|tpe)$|^tout\s+ce\s+qu/i;
/** « on audit » → « audite » (le nom pris pour le verbe, accordé avec « on »). */
const VERBES_ON: Record<string, string> = { audit: "audite" };
const PRONOMS = new Set(["on", "nous", "je", "j", "vous", "ils", "elles"]);
const DETERMINANTS = new Set(["les", "des", "vos", "nos", "leurs", "un", "une", "le", "la", "ses", "mes", "ces"]);

/** Élément d'une proposition « on + verbe + compléments » : le verbe et son complément le plus parlant. */
function elementVerbe(mots: MotCarte[], prop: number[]): string | null {
  const [, verbeIdx, ...reste] = prop;
  if (verbeIdx === undefined) return null;
  const verbeBrut = texteDe([mots[verbeIdx]]).toLowerCase();
  const verbe = VERBES_ON[nu(verbeBrut)] ?? verbeBrut;
  // Compléments : coupés devant les prépositions (à, en, pour, avec, chez, sur).
  const morceaux: number[][] = [];
  for (const i of reste) {
    const n = nu(mots[i].mot);
    if (!morceaux.length || (["a", "en", "pour", "avec", "chez", "sur", "dans", "au", "aux"].includes(n) && morceaux[morceaux.length - 1].length)) morceaux.push([i]);
    else morceaux[morceaux.length - 1].push(i);
  }
  const lisible = morceaux.map((m) => texteDe(m.map((i) => mots[i])).toLowerCase()).find((t) => t.split(/\s+/).length <= 3 && !GENERIQUES.test(t) && porteDuSens(t) && !/^(?:a|à)\s+l'/.test(t));
  return lisible ? `${verbe} ${lisible}` : verbe;
}

/** Au moins 3 propositions parallèles dans une phrase (« on forme…, on accompagne…, on audite… et on automatise… »). */
function listesParalleles(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  for (const p of phrases) {
    const props = propositions(mots, p).filter((x) => x.length);
    // 1. Même pronom sujet suivi d'un verbe.
    const parPronom = new Map<string, number[][]>();
    for (const x of props) {
      const tete = nu(mots[x[0]].mot);
      if (PRONOMS.has(tete) && x.length >= 2) parPronom.set(tete, [...(parPronom.get(tete) ?? []), x]);
    }
    const [pronom, groupe] = [...parPronom.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
    let elements: { texte: string; t: number }[] = [];
    let titre: string | undefined;
    if (pronom && groupe.length >= 3) {
      elements = groupe.flatMap((x) => {
        const e = elementVerbe(mots, x);
        return e ? [{ texte: majuscule(e), t: mots[x[1]].debutSec }] : [];
      });
      // « Chez Axion-IA, on… » : le titre est celui qui parle.
      const avant = props[0][0] !== groupe[0][0] ? texteDe(props[0].map((i) => mots[i])) : "";
      if (/^chez\s+\S+/i.test(avant) && avant.split(/\s+/).length <= 4) titre = avant;
    } else {
      // 2. Même déterminant en tête, propositions courtes (« les soirées…, les relances…, les chiffres… »).
      const courtes = props.filter((x) => DETERMINANTS.has(nu(mots[x[0]].mot)) && x.length >= 2 && x.length <= 7);
      const tetes = new Map<string, number[][]>();
      for (const x of courtes) tetes.set(nu(mots[x[0]].mot), [...(tetes.get(nu(mots[x[0]].mot)) ?? []), x]);
      const meilleur = [...tetes.values()].sort((a, b) => b.length - a.length)[0];
      // Elles doivent se suivre (une énumération, pas trois « les » épars).
      if (meilleur && meilleur.length >= 3 && meilleur.every((x, k) => k === 0 || props.indexOf(x) === props.indexOf(meilleur[k - 1]) + 1)) {
        elements = meilleur.map((x) => ({ texte: texteDe(x.map((i) => mots[i])), t: mots[x[0]].debutSec }));
      }
    }
    elements = elements.filter((e) => porteDuSens(e.texte) && e.texte.length <= 40).slice(0, 5);
    if (elements.length < 3) continue;
    const fin = mots[p.idx[p.idx.length - 1]].finSec;
    const b = bornes(mots[p.idx[0]].debutSec, fin, dureeVideo, r);
    sortie.push({
      ...b,
      carte: { modele: "liste", donnees: { ...(titre ? { titre } : {}), elements: elements.map((e) => ({ texte: e.texte, icone: iconePour(e.texte), aSec: rel(e.t, b.debutSec) })) } },
      raison: "une énumération dite",
      score: 9,
    });
  }
  return sortie;
}

const UNITES: Record<string, string> = { minute: "min", minutes: "min", min: "min", heure: "h", heures: "h", h: "h", jour: "jours", jours: "jours", semaine: "semaines", semaines: "semaines", mois: "mois", an: "ans", ans: "ans", "%": "%", euros: "€", euro: "€", "€": "€", clients: "clients" };
const NOMBRES_LETTRES: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100 };
/** Qualificatifs d'un chiffre repris tels quels sur la carte (« gratuit », « en visio »). */
const QUALIFICATIFS = /\b(gratuite?s?|offerte?s?|sans engagement|en visio|en ligne|par t[ée]l[ée]phone|en pr[ée]sentiel|par (?:jour|semaine|mois|an)|en moyenne|chaque (?:jour|semaine|mois))\b/gi;

/** Un chiffre et son unité, avec ce qui le qualifie (« Un premier diagnostic gratuit de 45 minutes en visio »). */
function chiffres(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  const dejaDits = new Set<string>();
  const valeurDe = (i: number) => {
    const brut = nu(mots[i].mot);
    return /^\d+(?:[.,]\d+)?$/.test(brut) ? Number(brut.replace(",", ".")) : NOMBRES_LETTRES[brut];
  };
  for (const p of phrases) {
    // Plusieurs chiffres dans la phrase : c'est un graphique (règles des 13 modèles), pas un chiffre seul.
    if (p.idx.filter((i, k) => valeurDe(i) && UNITES[nu(mots[p.idx[k + 1]]?.mot ?? "")]).length >= 2) continue;
    for (let k = 0; k + 1 < p.idx.length; k++) {
      const brut = nu(mots[p.idx[k]].mot);
      const valeur = /^\d+(?:[.,]\d+)?$/.test(brut) ? Number(brut.replace(",", ".")) : NOMBRES_LETTRES[brut];
      const unite = UNITES[nu(mots[p.idx[k + 1]].mot)];
      if (!valeur || !unite) continue;
      const cle = `${valeur} ${unite}`;
      if (dejaDits.has(cle)) break; // le même chiffre redit plus loin n'a pas de seconde carte
      dejaDits.add(cle);
      const texte = texteDe(p.idx.map((i) => mots[i]));
      const qualifs = [...new Set((texte.match(QUALIFICATIFS) ?? []).map((q) => q.toLowerCase()))];
      const apres = texteDe(p.idx.slice(k + 2).map((i) => mots[i])).split(/\s+/).slice(0, 6).join(" ");
      const libelle = qualifs.length ? qualifs.join(" · ") : apres.toLowerCase();
      if (!porteDuSens(libelle)) continue;
      // Sur-titre : le nom que le chiffre mesure (« Premier diagnostic »), sans les qualificatifs.
      const avant = texteDe(p.idx.slice(0, k).map((i) => mots[i]))
        .replace(QUALIFICATIFS, "")
        .replace(/^(?:un|une|le|la|les|en)\s+/i, "")
        // Vérif V2 : le verbe qui mène au chiffre n'est pas le nom mesuré (« Le diagnostic fuite dure 45 minutes »).
        .replace(/\s+(?:dure|durent|prend|prennent|co[uû]te|co[uû]tent|demande|demandent|repr[ée]sente|repr[ée]sentent|fait|font|est|sont|a|ont)(?:\s+(?:environ|seulement|plus|moins|pr[eè]s|juste))?$/i, "")
        .replace(/\s+(?:de|d'|du)$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      const surTitre = avant && avant.split(/\s+/).length <= 4 && porteDuSens(avant) ? majuscule(avant) : undefined;
      const b = bornes(mots[p.idx[0]].debutSec, mots[p.idx[p.idx.length - 1]].finSec, dureeVideo, r);
      sortie.push({
        ...b,
        carte: { modele: "chiffre", donnees: { valeur, decimales: Number.isInteger(valeur) ? 0 : 1, unite, libelle, ...(surTitre ? { surTitre } : {}), icone: iconePour(texte) ?? "horloge", aSec: rel(mots[p.idx[k]].debutSec, b.debutSec) } },
        raison: "un chiffre marquant",
        score: 8,
      });
      break;
    }
  }
  return sortie;
}

/** Titre nommé : phrase courte, nominale, qui commence par un article défini (« Le diagnostic fuite. »). */
function titresNommes(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  for (const p of phrases) {
    const t = texteDe(p.idx.map((i) => mots[i]));
    const n = normaliser(t).split(/\s+/);
    if (n.length < 2 || n.length > 4 || /[,?]/.test(t) || !/^(le|la|les|notre|votre|mon|ma)$/.test(n[0])) continue;
    // Une phrase nominale : aucun verbe courant (« La voilà », « Les gens partent » n'en sont pas).
    if (n.some((m) => /^(est|sont|a|ont|fait|font|va|vont|peut|doit|voila|part|partent|vient)$/.test(m))) continue;
    const b = bornes(mots[p.idx[0]].debutSec, mots[p.idx[p.idx.length - 1]].finSec + 1.5, dureeVideo, r);
    sortie.push({ ...b, carte: { modele: "titre", donnees: { variante: "titre", titre: t, motCle: t.split(/\s+/).pop()! } }, raison: "un nom donné", score: 7 });
  }
  return sortie;
}

/** « X, alors que la vraie première étape, c'est de Y » → problème → solution. */
function problemesSolutions(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  for (const p of phrases) {
    const n = p.idx.map((i) => nu(mots[i].mot));
    const k = n.findIndex((m, j) => m === "alors" && n[j + 1] === "que");
    if (k < 2) continue;
    const cest = n.findIndex((m, j) => j > k && (m === "c'est" || (m === "c" && n[j + 1] === "'est")));
    if (cest < 0) continue;
    const debutSolution = cest + (n[cest] === "c" ? 2 : 1) + (["de", "d'"].includes(n[cest + (n[cest] === "c" ? 2 : 1)]) ? 1 : 0);
    const solution = texteDe(p.idx.slice(debutSolution).map((i) => mots[i]));
    // Problème : les propositions parallèles juste avant « alors que » (« un outil de plus, une embauche de plus »).
    const avant = propositions(mots, { idx: p.idx.slice(0, k) }).filter((x) => x.length);
    const fins = avant.map((x) => x.slice(-2).map((i) => nu(mots[i].mot)).join(" "));
    let probleme = texteDe(avant[avant.length - 1].map((i) => mots[i]));
    if (avant.length >= 2 && fins[fins.length - 1] === fins[fins.length - 2]) {
      const derniere = avant[avant.length - 1].map((i) => mots[i]);
      const avantDerniere = avant[avant.length - 2].map((i) => mots[i]);
      // « On veut colmater en ajoutant un outil de plus » → « un outil de plus » (à partir du déterminant).
      const d = avantDerniere.findIndex((m, j) => j > 0 && DETERMINANTS.has(nu(m.mot)));
      probleme = `${texteDe(d > 0 ? avantDerniere.slice(d) : avantDerniere)}, ${texteDe(derniere).toLowerCase()}`;
    }
    if (!porteDuSens(probleme) || !porteDuSens(solution) || probleme.length > 48 || solution.split(/\s+/).length > 6) continue;
    const b = bornes(mots[p.idx[0]].debutSec, mots[p.idx[p.idx.length - 1]].finSec, dureeVideo, r);
    sortie.push({
      ...b,
      carte: { modele: "probleme-solution", donnees: { probleme: { titre: probleme, icone: "alerte" }, solution: { titre: solution, icone: iconePour(solution) ?? "coche-cercle" }, etiquetteSolution: "La vraie première étape", aSecSolution: rel(mots[p.idx[k]].debutSec, b.debutSec) } },
      raison: "un réflexe puis la bonne réponse",
      score: 6,
    });
  }
  return sortie;
}

/** « vous n'avez pas un problème de travail, vous avez une fuite » → icône + mot (« Une fuite »). */
function corrections(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  for (const p of phrases) {
    const props = propositions(mots, p).filter((x) => x.length);
    for (let k = 0; k + 1 < props.length; k++) {
      const a = props[k].map((i) => nu(mots[i].mot));
      const pas = a.indexOf("pas");
      if (pas < 0 || !a.some((m) => m === "n" || m === "ne" || m.startsWith("n'"))) continue;
      const b = props[k + 1];
      const nb = b.map((i) => nu(mots[i].mot));
      // Même sujet et même verbe, à l'affirmative : « vous n'avez pas X, vous avez Y ».
      const verbe = a.findIndex((m) => m.startsWith("'") || m.startsWith("n'")) >= 0 ? a.find((m) => m.startsWith("'") || m.startsWith("n'"))!.replace(/^n?'/, "") : a[a.indexOf("ne") + 1];
      const v = nb.indexOf(verbe ?? "");
      if (v < 0 || v > 2 || b.length - v - 1 < 1 || b.length - v - 1 > 3) continue;
      const mot = texteDe(b.slice(v + 1).map((i) => mots[i]));
      const surTitre = `Pas ${texteDe(props[k].slice(pas + 1).map((i) => mots[i])).toLowerCase()}`;
      if (!porteDuSens(mot) || surTitre.split(/\s+/).length > 7) continue;
      const bb = bornes(mots[props[k][0]].debutSec, mots[b[b.length - 1]].finSec, dureeVideo, r);
      sortie.push({ ...bb, carte: { modele: "icone-mot", donnees: { surTitre, mot, icone: iconePour(mot) ?? "ampoule", aSec: rel(mots[b[v + 1]].debutSec, bb.debutSec) } }, raison: "une idée reçue corrigée", score: 5 });
      break;
    }
  }
  return sortie;
}

/** Tête d'un groupe nominal énuméré (« une formation », « un audit complet », « de l'automatisation »). */
const TETES_NOMS = /^(?:(?:ou|et)\s+)?(?:peut-[êe]tre\s+)?(?:(?:une|un)\s+|(?:de\s+l'|d'|l')\s*)/i;

/**
 * Noms énumérés sur une phrase et sa suite en « Ou… » : « Une formation pour vos équipes, […]. Ou peut-être un
 * accompagnement one-to-one, un audit complet, de l'automatisation. » → 4 éléments (au moins 3).
 */
function listesDeNoms(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  const sortie: CarteAuto[] = [];
  for (let k = 0; k < phrases.length; k++) {
    const groupe = [phrases[k]];
    while (k + groupe.length < phrases.length && /^(ou|et)$/.test(nu(mots[phrases[k + groupe.length].idx[0]].mot)) && groupe.length < 3) groupe.push(phrases[k + groupe.length]);
    const props = groupe.flatMap((p) => propositions(mots, p)).filter((x) => x.length);
    const elements: { texte: string; t: number }[] = [];
    for (const x of props) {
      const brut = texteDe(x.map((i) => mots[i]));
      const tete = TETES_NOMS.exec(brut);
      if (!tete || PRONOMS.has(nu(brut.split(/\s+/)[0]))) continue;
      // Le nom et son qualificatif, sans le complément (« pour vos équipes », « avec… », « grâce à… »).
      const nom = brut.slice(tete[0].length).split(/\s+(?:pour|avec|gr[âa]ce|en|chez|sur|dans|qui|que)\b/i)[0].split(/\s+/).slice(0, 3).join(" ");
      if (nom.length >= 3 && porteDuSens(nom)) elements.push({ texte: majuscule(nom), t: mots[x[0]].debutSec });
    }
    if (elements.length < 3) continue;
    const dernier = groupe[groupe.length - 1];
    const gardes = elements.slice(0, 5);
    // Le dernier nom doit tomber dans la carte (8 s au plus, chute finale libre) : la carte part un peu plus tard.
    const debut = Math.max(gardes[0].t, gardes[gardes.length - 1].t - (r.dureeSec[1] - 1.8));
    const b = bornes(debut, mots[dernier.idx[dernier.idx.length - 1]].finSec, dureeVideo, r);
    sortie.push({
      ...b,
      carte: { modele: "liste", donnees: { elements: gardes.map((e) => ({ texte: e.texte, icone: iconePour(e.texte), aSec: rel(e.t, b.debutSec) })) } },
      raison: "des offres énumérées",
      score: 8.5,
    });
    k += groupe.length - 1;
  }
  return sortie;
}

/**
 * Titre nommé juste avant la phrase d'un chiffre (« Le diagnostic fuite. Un premier diagnostic gratuit de 45 minutes
 * en visio. ») : deux cartes de 3 s ne tiennent pas en 5 s de parole ; le titre devient le sur-titre du chiffre, et la
 * carte apparaît quand le titre est dit.
 */
function fusionnerTitresEtChiffres(cartes: CarteAuto[]): CarteAuto[] {
  const titres = cartes.filter((c) => c.carte.modele === "titre" && c.raison === "un nom donné");
  return cartes.flatMap((c) => {
    if (c.carte.modele === "chiffre") {
      const t = titres.find((x) => x.debutSec < c.debutSec && c.debutSec - x.debutSec <= 2.5);
      if (!t || t.carte.modele !== "titre") return [c];
      const debutSec = t.debutSec;
      const d = c.carte.donnees;
      return [{ ...c, debutSec, finSec: Math.max(c.finSec, debutSec + 3), carte: { modele: "chiffre" as const, donnees: { ...d, surTitre: t.carte.donnees.titre, aSec: +((d.aSec ?? 0) + c.debutSec - debutSec).toFixed(3) } }, raison: "un nom donné et son chiffre", score: Math.max(c.score, t.score) }];
    }
    if (titres.includes(c) && cartes.some((x) => x.carte.modele === "chiffre" && x.debutSec > c.debutSec && x.debutSec - c.debutSec <= 2.5)) return [];
    return [c];
  });
}

const IMPERATIFS = /^(r[ée]servez|contactez|cliquez|appelez|[ée]crivez|inscrivez|t[ée]l[ée]chargez|prenez|demandez|rejoignez|abonnez)$/;

/** Appel à l'action final : la proposition à l'impératif de la fin (« Réservez votre appel diagnostic gratuit »). */
function appelALAction(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  for (const p of phrases.slice(-2).reverse()) {
    const k = p.idx.findIndex((i) => IMPERATIFS.test(nu(mots[i].mot)));
    if (k < 0) continue;
    const titre = texteDe(p.idx.slice(k).map((i) => mots[i]));
    if (titre.split(/\s+/).length > 8) continue;
    const condition = texteDe(p.idx.slice(0, k).map((i) => mots[i]));
    const surTitre = condition && condition.split(/\s+/).length <= 9 ? condition : undefined;
    const debut = mots[p.idx[k]].debutSec - 0.3;
    const b = bornes(debut, Math.max(mots[p.idx[p.idx.length - 1]].finSec, debut + r.dureeSec[0]), dureeVideo, r);
    return [{ ...b, carte: { modele: "titre", donnees: { variante: "titre", titre, motCle: titre.split(/\s+/)[0], ...(surTitre ? { surTitre } : {}) } }, raison: "l'appel à l'action final", score: 9.5 }];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Comblement par les règles des 13 modèles                              */
/* ------------------------------------------------------------------ */

/** Une carte des règles générales n'est gardée que si ses textes viennent de la phrase et portent du sens. */
function carteSensee(carte: CarteMotionTous, phrase: string): boolean {
  const n = normaliser(phrase);
  const textes: string[] = [];
  const d = carte.donnees as unknown as Record<string, unknown>;
  if (carte.modele === "liste") {
    const el = (d.elements as { texte: string }[]) ?? [];
    if (el.length < 2) return false;
    textes.push(...el.map((e) => e.texte));
    if (typeof d.titre === "string") textes.push(d.titre);
  } else if (carte.modele === "titre" || carte.modele === "titre-plein-ecran") return false;
  for (const t of textes) {
    if (!porteDuSens(t)) return false;
    const cles = normaliser(t).split(/[\s'’,]+/).filter((m) => m.length > 3);
    if (cles.some((m) => !n.includes(m))) return false;
  }
  return true;
}

function comblements(mots: MotCarte[], phrases: Phrase[], dureeVideo: number, r: ReglesCartesAuto): CarteAuto[] {
  return phrases.flatMap((p) => {
    const texte = texteDe(p.idx.map((i) => mots[i]), true);
    const c = choisirModeleTous(texte);
    if (!c || c.confiance < r.confianceComblement || !carteSensee(c.carte, texte)) return [];
    if (estModeleEtendu(c.carte.modele) && !tientEnMoitieHaute(c.carte as CarteModeleEtendu)) return [];
    // Graphique, check-list, avant / après, documentaire bien reconnus : aussi sûrs que les détecteurs (posés d'office).
    const sur = c.confiance >= 0.8 && ["graphique", "check-list", "avant-apres", "documentaire"].includes(c.carte.modele);
    return [{ ...bornes(mots[p.idx[0]].debutSec, mots[p.idx[p.idx.length - 1]].finSec, dureeVideo, r), carte: c.carte, raison: c.raison, score: sur ? 7.5 : 2 + c.confiance }];
  });
}

/* ------------------------------------------------------------------ */
/* Panneau jamais vide                                                  */
/* ------------------------------------------------------------------ */

/**
 * Instant (s après l'ouverture) où arrive le premier contenu PRINCIPAL d'une carte : premier point d'une liste, mot
 * d'une icône + mot, compteur d'un chiffre, première étape. Un titre ou un sur-titre seul ne compte pas : sur IMG_7747
 * v3, « Pas un problème de travail » et « Chez Axion-IA » laissaient le panneau presque vide 0,8 à 1,6 s.
 */
export function premierContenuSec(carte: CarteMotionTous): number {
  const d = carte.donnees as unknown as Record<string, unknown>;
  const liste = (cle: string) => {
    const el = (d[cle] as { aSec?: number }[] | undefined) ?? [];
    return el.length && el[0].aSec !== undefined ? Math.min(...el.map((e) => e.aSec ?? Infinity)) : 0;
  };
  switch (carte.modele) {
    case "liste":
      return liste("elements");
    case "ligne-de-temps":
      return liste("etapes");
    case "icone-mot":
    case "chiffre":
      return typeof d.aSec === "number" ? d.aSec : 0;
    default:
      return 0;
  }
}

/** Les apparitions d'une carte décalées de `delta` s (la carte s'ouvre `delta` s plus tard). */
function decalerApparitions(carte: CarteMotionTous, delta: number): CarteMotionTous {
  const moins = (v: unknown) => (typeof v === "number" ? +Math.max(0, v - delta).toFixed(3) : v);
  const d = carte.donnees as unknown as Record<string, unknown>;
  const sortie: Record<string, unknown> = { ...d };
  for (const cle of ["aSec", "aSecTitre", "aSecSolution", "aSecApres", "aSecDroite", "aSecCommun"]) if (cle in d) sortie[cle] = moins(d[cle]);
  for (const cle of ["elements", "etapes"]) if (Array.isArray(d[cle])) sortie[cle] = (d[cle] as Record<string, unknown>[]).map((e) => ("aSec" in e ? { ...e, aSec: moins(e.aSec) } : e));
  return { ...carte, donnees: sortie } as unknown as CarteMotionTous;
}

/**
 * Le panneau ne s'ouvre jamais sur du vide : une carte dont le premier contenu arrive plus de `avancePanneauSec` après
 * son début est ouverte plus tard (ses apparitions restent au mot dit) ; elle garde 3 s au moins, dans la vidéo.
 */
export function ouvrirAuPremierContenu<T extends { debutSec: number; finSec: number; carte: CarteMotionTous }>(c: T, dureeVideoSec: number, r: Pick<ReglesCartesAuto, "avancePanneauSec" | "dureeSec"> = REGLES_CARTES_AUTO): T {
  const attente = premierContenuSec(c.carte) - r.avancePanneauSec;
  return attente <= 1e-6 ? c : ouvrirA(c, c.debutSec + attente, dureeVideoSec, r);
}

/** La carte ouverte à `debut` (jamais avant son début d'origine), apparitions au mot dit, 3 s au moins, dans la vidéo. */
function ouvrirA<T extends { debutSec: number; finSec: number; carte: CarteMotionTous }>(c: T, debutVoulu: number, dureeVideoSec: number, r: Pick<ReglesCartesAuto, "dureeSec">): T {
  const finMax = dureeVideoSec - 0.05;
  const debut = Math.max(c.debutSec, Math.min(debutVoulu, finMax - r.dureeSec[0]));
  const delta = +(debut - c.debutSec).toFixed(3);
  if (delta <= 0) return c;
  return { ...c, debutSec: +debut.toFixed(3), finSec: +Math.min(finMax, Math.max(c.finSec, debut + r.dureeSec[0])).toFixed(3), carte: decalerApparitions(c.carte, delta) };
}

/** Un titre ou un sur-titre visible dès l'ouverture (le panneau n'est pas vide même avant le premier contenu). */
function aUnTitre(carte: CarteMotionTous): boolean {
  const d = carte.donnees as unknown as Record<string, unknown>;
  return (typeof d.titre === "string" && !!d.titre.trim() && (d.aSecTitre === undefined || (d.aSecTitre as number) <= 0.3)) || (typeof d.surTitre === "string" && !!d.surTitre.trim());
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                            */
/* ------------------------------------------------------------------ */

/**
 * Les cartes automatiques d'une vidéo face caméra (temps de la vidéo MONTÉE). Les plus sûres d'abord, sans
 * chevauchement (2,5 s d'écart au moins) ; puis comblement des trous de plus de 20 s par les règles des 13 modèles.
 */
export function planifierCartesAuto(motsBruts: MotCarte[], dureeVideoSec: number, reglages: Partial<ReglesCartesAuto> = {}): CarteAuto[] {
  const r: ReglesCartesAuto = { ...REGLES_CARTES_AUTO, ...reglages };
  const mots = motsBruts.filter((m) => m.mot.trim() && Number.isFinite(m.debutSec) && Number.isFinite(m.finSec));
  if (!mots.length || dureeVideoSec < r.dureeSec[0] + r.pasAvantSec) return [];
  const phrases = phrasesDe(mots);
  /** Carte telle que détectée, avant son ouverture au premier contenu (repli quand la place manque). */
  const origines = new Map<CarteAuto, CarteAuto>();
  const ouvrir = (c: CarteAuto) => {
    const o = ouvrirAuPremierContenu(c, dureeVideoSec, r);
    if (o !== c) origines.set(o, c);
    return o;
  };
  const sures = fusionnerTitresEtChiffres([listesNumerotees, listesParalleles, listesDeNoms, appelALAction, chiffres, titresNommes, problemesSolutions, corrections].flatMap((f) => f(mots, phrases, dureeVideoSec, r))).map(ouvrir);
  const retenues: CarteAuto[] = [];
  /** Fin la plus courte acceptable : 3 s de carte, et au plus 0,6 s avant la fin du dernier mot illustré. */
  const finMin = (c: CarteAuto) => Math.max(c.debutSec + r.dureeSec[0], (c.finDitSec ?? c.finSec) - 0.6);
  const separees = (a: CarteAuto, b: CarteAuto) => a.debutSec >= b.finSec + r.ecartMinSec - 1e-6 || a.finSec <= b.debutSec - r.ecartMinSec + 1e-6;
  /**
   * Pose la carte ; si la place manque après son ouverture au premier contenu, elle s'ouvre un peu plus tôt (vers son
   * début d'origine) à condition qu'un titre ou un sur-titre soit visible dès l'ouverture (« Le diagnostic fuite » avant
   * « 45 min ») : le panneau n'est jamais vide.
   */
  const poser = (c: CarteAuto): boolean => {
    if (poserTelle(c)) return true;
    const o = origines.get(c);
    if (!o || !aUnTitre(o.carte)) return false;
    for (let d = c.debutSec - 0.05; d > o.debutSec + 1e-6; d -= 0.05) if (poserTelle(ouvrirA(o, d, dureeVideoSec, r))) return true;
    return poserTelle(o);
  };
  /** Pose la carte si elle tient, quitte à raccourcir sa traîne ou celle de la carte d'avant ; sinon rien. */
  const poserTelle = (brute: CarteAuto): boolean => {
    const c = { ...brute };
    if (c.finSec - c.debutSec < r.dureeSec[0] - 1e-6) return false;
    const suivante = retenues.filter((x) => x.debutSec > c.debutSec && !separees(c, x)).sort((a, b) => a.debutSec - b.debutSec)[0];
    if (suivante) c.finSec = +Math.min(c.finSec, suivante.debutSec - r.ecartMinSec).toFixed(3);
    if (c.finSec < finMin(c) - 1e-6) return false;
    const precedente = retenues.filter((x) => x.debutSec <= c.debutSec && !separees(c, x))[0];
    const finPrecedente = precedente ? +(c.debutSec - r.ecartMinSec).toFixed(3) : 0;
    if (precedente && finPrecedente < finMin(precedente) - 1e-6) return false;
    if (retenues.some((x) => x !== precedente && !separees(c, x))) return false;
    if (precedente) precedente.finSec = finPrecedente;
    retenues.push(c);
    return true;
  };
  /**
   * Liste numérotée : elle passe toujours. Les cartes moins sûres qui la gênent sont raccourcies (3 s au moins) ou, à
   * défaut, retirées — jamais la liste.
   */
  const imposer = (c: CarteAuto) => {
    for (const x of retenues.filter((y) => !separees(c, y))) {
      const fin = +(c.debutSec - r.ecartMinSec).toFixed(3);
      if (x.debutSec < c.debutSec && fin - x.debutSec >= r.dureeSec[0] - 1e-6) x.finSec = fin;
      else retenues.splice(retenues.indexOf(x), 1);
    }
    retenues.push({ ...c });
  };
  const generales = comblements(mots, phrases, dureeVideoSec, r).map(ouvrir);
  for (const c of [...sures, ...generales.filter((x) => x.score >= 7)].sort((a, b) => b.score - a.score || a.debutSec - b.debutSec)) if (!poser(c) && c.score >= SCORE_NUMEROTEE) imposer(c);
  // Comblement : un trou de plus de `ecartCibleSec[1]` entre deux débuts (ou depuis le début / jusqu'à la fin).
  const candidats = generales.filter((x) => x.score < 7).sort((a, b) => b.score - a.score);
  for (const c of candidats) {
    const triees = [...retenues].sort((a, b) => a.debutSec - b.debutSec);
    const avant = [...triees].reverse().find((x) => x.debutSec <= c.debutSec);
    const apres = triees.find((x) => x.debutSec > c.debutSec);
    const trou = (apres?.debutSec ?? dureeVideoSec) - (avant?.debutSec ?? 0);
    if (trou > r.ecartCibleSec[1]) poser(c);
  }
  return retenues.sort((a, b) => a.debutSec - b.debutSec).map((c) => {
    const sortie = { ...c };
    delete sortie.finDitSec;
    return sortie;
  });
}
