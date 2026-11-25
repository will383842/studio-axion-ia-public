/**
 * PLAN SANS VOIX COMPOSÉ, DÉDUIT DU SCRIPT (lot qualité 25-11, QUAL-2). 0 €, aucun appel d'IA, pur et déterministe.
 * Règle d'or : tout texte du plan est une suite CONTIGUË de mots du script, la phrase titre saisie ou le libellé de fin ;
 * aucun nombre absent du script (les valeurs des cartes sont des squelettes). Les scènes PAVENT [0, dureeMs] sans trou.
 * Ordre des événements de l'écran : cartes-chiffres, liste, tri, clic, panneau, alerte, puis les `focus` (par instant).
 * Les lexiques et le nettoyage des libellés vivent dans `plan-sans-voix-regles.ts`. Ne lève jamais.
 */
import type { MotMinute } from "@/briques/plan-scenes/schema";
import type {
  EvenementEcran,
  FormatImage,
  PlageMots,
  PlanComposeSansVoix,
  SceneSansVoix,
} from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import { VERSION_SANS_VOIX } from "@/briques/plan-scenes/tutoriel/sans-voix/types";
import {
  CONJONCTIONS_CONDITION,
  DEBUTS_VIDES,
  DETERMINANTS,
  MOTS_SANS_SENS,
  MOTS_VIDES_FIN,
  MOTS_ALERTE,
  MOTS_APPEL,
  MOTS_CLIC,
  MOTS_OUVRE,
  MOTS_TRI,
  NOMBRES,
  NOMS_ANNONCE,
  NOMS_LISTE,
  POSITIONS_DITES,
  POSSESSIFS,
  PREPOSITIONS_TRI,
  RELATIFS,
  TERMES_OUTIL,
  majuscule,
  nettoyerBords,
  nettoyerLibelle,
  nu,
  sansElision,
  VERBES_APPEL,
} from "./plan-sans-voix-regles";

const QUEUE_MS = 500;
const MS_PAR_MOT_REPLI = 385;
const MAX_SURTITRE = 60;
const MAX_ALERTE = 40;
const MAX_CARTE_PHRASE = 48;

/** `n` = forme pliée ; `m` = forme pliée sans élision (« l'outil » → « outil ») ; `idx` = indice d'origine dans `mots`. */
interface Tok { texte: string; n: string; m: string; debut: number; fin: number; idx: number }
interface Phrase { premier: number; dernier: number; texte: string; question: boolean }

export interface EntreePlanSansVoix {
  texte: string;
  mots: MotMinute[];
  format: FormatImage;
  phraseTitre?: string;
  basPct: number;
  fin?: "aucune" | "rendez-vous";
  /** Durée voulue du plan (facultatif) : si fournie, le plan finit exactement là. */
  dureeMs?: number;
}

/* ------------------------------------------------------------------ */
/* Jetons et phrases                                                    */
/* ------------------------------------------------------------------ */

function jetons(e: EntreePlanSansVoix): Tok[] {
  const brut: { texte: string; debutMs: number; finMs: number }[] =
    e.mots && e.mots.length
      ? e.mots.map((m) => ({ texte: String(m.texte ?? ""), debutMs: Number(m.debutMs) || 0, finMs: Number(m.finMs) || 0 }))
      : String(e.texte ?? "").split(/\s+/).filter(Boolean).map((t, i) => ({ texte: t, debutMs: i * MS_PAR_MOT_REPLI, finMs: (i + 1) * MS_PAR_MOT_REPLI - 40 }));
  const sortie: Tok[] = [];
  let dernierDebut = 0;
  for (const [idx, m] of brut.entries()) {
    const texte = m.texte.trim();
    if (!texte) continue;
    const debut = Math.round(Math.max(dernierDebut, m.debutMs));
    const fin = Math.round(Math.max(debut, m.finMs));
    dernierDebut = debut;
    sortie.push({ texte, n: nu(texte), m: sansElision(nu(texte)), debut, fin, idx });
  }
  return sortie;
}

function decouperPhrases(t: Tok[]): Phrase[] {
  const phrases: Phrase[] = [];
  let debut = 0;
  for (let i = 0; i < t.length; i++) {
    const finDePhrase = /[.?!…]["»”)]*$/.test(t[i].texte);
    if (finDePhrase || i === t.length - 1) {
      const texte = t.slice(debut, i + 1).map((m) => m.texte).join(" ");
      phrases.push({ premier: debut, dernier: i, texte, question: /\?["»”)]*$/.test(t[i].texte) });
      debut = i + 1;
    }
  }
  // Une « phrase » faite de ponctuation seule (« … ») n'est jamais une scène : fondue dans la suivante (ou la précédente).
  for (let k = 0; k < phrases.length && phrases.length > 1; k++) {
    if (/[\p{L}\p{N}]/u.test(phrases[k].texte)) continue;
    if (k === 0) {
      const s = phrases[1];
      phrases.splice(0, 2, { premier: 0, dernier: s.dernier, texte: `${phrases[0].texte} ${s.texte}`, question: s.question });
    } else {
      const a = phrases[k - 1];
      phrases.splice(k - 1, 2, { premier: a.premier, dernier: phrases[k].dernier, texte: `${a.texte} ${phrases[k].texte}`, question: a.question || phrases[k].question });
    }
    k = -1;
  }
  return phrases;
}

const brut = (t: Tok[], a: number, b: number): string[] => t.slice(a, b + 1).map((m) => m.texte);
const finVirgule = (m: Tok): boolean => /[,;:]["»”)]*$/.test(m.texte);
const estDeuxPoints = (m: Tok): boolean => m.texte === ":" || m.texte.endsWith(":");
const plageDe = (a: number, b: number): PlageMots => ({ premier: a, dernier: b });

/** Cherche une suite de mots pliés à partir de `depuis` dans [depuis, borne]. */
function suiteA(t: Tok[], i: number, mots: string[], borne: number): boolean {
  if (i + mots.length - 1 > borne) return false;
  return mots.every((w, k) => t[i + k].m === w || t[i + k].n === w);
}

/* ------------------------------------------------------------------ */
/* Détections                                                           */
/* ------------------------------------------------------------------ */

function trouverOutil(t: Tok[], p: Phrase): { index: number; titre: string } | null {
  for (let i = p.premier; i <= p.dernier; i++) {
    for (const o of TERMES_OUTIL) if (suiteA(t, i, o.mots, p.dernier)) return { index: i, titre: o.titre };
  }
  return null;
}

/** Découpe les éléments d'une énumération en segments (virgules, puis « et » si un seul segment). */
function segments(t: Tok[], a: number, b: number): [number, number][] {
  const sortie: [number, number][] = [];
  let debut = a;
  for (let i = a; i <= b; i++) {
    if (finVirgule(t[i]) && i < b) { sortie.push([debut, i]); debut = i + 1; }
  }
  if (debut <= b) sortie.push([debut, b]);
  if (sortie.length >= 1) {
    // « et » coupe le DERNIER segment, même sans virgule d'Oxford (« téléphone, adresse et notes »).
    const [x, y] = sortie[sortie.length - 1];
    const coupes: [number, number][] = [];
    let d = x;
    for (let i = x + 1; i < y; i++) if (t[i].n === "et") { coupes.push([d, i - 1]); d = i + 1; }
    if (coupes.length) { coupes.push([d, y]); return [...sortie.slice(0, -1), ...coupes]; }
  }
  return sortie;
}

function elements(t: Tok[], a: number, b: number, opt: { maxMots: number; maxCar: number }, remarques: string[], quoi: string, max: number): { libelle: string; aMs: number; source: PlageMots }[] {
  const sortie: { libelle: string; aMs: number; source: PlageMots }[] = [];
  for (const [x, y] of segments(t, a, b)) {
    if (sortie.length >= max) {
      // Retiré AVANT nettoyage : la remarque cite le texte brut, pas un libellé « raccourci ».
      remarques.push(`${quoi} : élément retiré : « ${nettoyerBords(brut(t, x, y).join(" "))} » (au plus ${max}).`);
      continue;
    }
    const l = nettoyerLibelle(brut(t, x, y), opt);
    if (!l) continue;
    if (l.tronque) remarques.push(`${quoi} « ${l.texte} » raccourci (suite contiguë du script, trop long pour la carte).`);
    sortie.push({ libelle: l.texte, aMs: t[x + l.premier].debut, source: plageDe(x + l.premier, x + l.dernier) });
  }
  return sortie;
}

function detecterCartes(t: Tok[], p: Phrase, remarques: string[]): Extract<EvenementEcran, { genre: "cartes-chiffres" }> | null {
  for (let i = p.premier; i <= p.dernier; i++) {
    if (!NOMS_ANNONCE.has(t[i].m)) continue;
    let deuxPoints = -1;
    for (let j = i; j <= Math.min(i + 3, p.dernier); j++) if (estDeuxPoints(t[j])) { deuxPoints = j; break; }
    if (deuxPoints < 0) continue;
    const cartes = elements(t, deuxPoints + 1, p.dernier, { maxMots: 6, maxCar: 30 }, remarques, "Carte", 3);
    if (cartes.length < 2) { remarques.push("Annonce de chiffres trouvée mais moins de deux éléments énumérés : cartes non dessinées."); return null; }
    const declencheur = i > p.premier && (NOMBRES.has(t[i - 1].n) || /^\d+$/.test(t[i - 1].n)) ? i - 1 : i;
    return { genre: "cartes-chiffres", aMs: t[declencheur].debut, cartes };
  }
  return null;
}

function detecterListe(t: Tok[], p: Phrase): Extract<EvenementEcran, { genre: "liste" }> | null {
  for (let i = p.premier; i < p.dernier; i++) {
    if (!NOMS_LISTE.has(t[i].n)) continue;
    const suivant = t[i + 1].n;
    const tableau = t[i].n.startsWith("tableau");
    let debut = -1;
    if (suivant === "des" || suivant === "du" || suivant.startsWith("d'")) debut = suivant.startsWith("d'") ? i + 1 : i + 2;
    else if (!tableau && suivant === "de") debut = i + 2;
    if (debut < 0 || debut > p.dernier) continue;
    let fin = debut;
    while (fin < p.dernier && fin - debut < 5 && !finVirgule(t[fin]) && !MOTS_TRI.has(t[fin + 1].n) && !RELATIFS.has(t[fin + 1].n)) fin++;
    const l = nettoyerLibelle(brut(t, debut, fin), { maxMots: 5, maxCar: 30, garderDeterminants: false });
    if (!l) continue;
    return { genre: "liste", aMs: t[i].debut, titre: l.texte, lignes: 4, source: plageDe(i, debut + l.dernier) };
  }
  return null;
}

function detecterTri(t: Tok[], p: Phrase): Extract<EvenementEcran, { genre: "tri" }> | null {
  for (let i = p.premier; i < p.dernier; i++) {
    if (!MOTS_TRI.has(t[i].n) || !PREPOSITIONS_TRI.has(t[i + 1].n)) continue;
    let fin = i + 1;
    while (fin < p.dernier && fin - (i + 1) < 3 && !finVirgule(t[fin])) fin++;
    const l = nettoyerLibelle(brut(t, i + 1, fin), { maxMots: 4, maxCar: 28, garderDeterminants: true });
    if (!l) continue;
    return { genre: "tri", aMs: t[i].debut, etiquette: l.texte, source: plageDe(i, i + 1 + l.dernier) };
  }
  return null;
}

function detecterClic(t: Tok[], p: Phrase, remarques: string[]): { clic: Extract<EvenementEcran, { genre: "clic" }>; panneau: Extract<EvenementEcran, { genre: "panneau" }> | null } | null {
  let c = -1;
  for (let i = p.premier; i <= p.dernier; i++) if (MOTS_CLIC.has(t[i].m)) { c = i; break; }
  if (c < 0) return null;
  const clic: Extract<EvenementEcran, { genre: "clic" }> = { genre: "clic", aMs: t[c].debut, cible: "ligne-1", source: plageDe(c, c) };
  let o = -1;
  for (let i = c + 1; i <= p.dernier; i++) if (MOTS_OUVRE.has(t[i].m)) { o = i; break; }
  if (o < 0) return { clic, panneau: null };
  clic.source = plageDe(c, o - 1 >= c ? o - 1 : c);
  let d = o + 1;
  if (d <= p.dernier && POSSESSIFS.has(t[d].n)) d++;
  let f = d;
  while (f < p.dernier && f - d < 2 && !finVirgule(t[f])) f++;
  const titre = d <= p.dernier ? nettoyerLibelle(brut(t, d, f), { maxMots: 3, maxCar: 28, garderDeterminants: false }) : null;
  let deuxPoints = -1;
  for (let j = o + 1; j <= p.dernier; j++) if (estDeuxPoints(t[j])) { deuxPoints = j; break; }
  if (!titre || deuxPoints < 0) {
    remarques.push("Un clic ouvre un panneau, mais son titre ou sa liste (« : a, b et c ») n'a pas été reconnu : panneau non dessiné.");
    return { clic, panneau: null };
  }
  const rubriques = elements(t, deuxPoints + 1, p.dernier, { maxMots: 8, maxCar: 44 }, remarques, "Rubrique", 4);
  if (!rubriques.length) return { clic, panneau: null };
  return { clic, panneau: { genre: "panneau", aMs: t[o].debut, titre: titre.texte, rubriques, source: plageDe(o, p.dernier) } };
}

const PREFIXE_ELIDE = /^(lorsqu|puisqu|quoiqu)['’]/i;

/**
 * Condition de la phrase, où que soit sa conjonction (quand / lorsque / lorsqu'un… / si / dès que…) : `conj` = mot de la
 * conjonction, `debut` = 1er mot du libellé (le mot même de la conjonction si elle est élidée : « lorsqu'un »), `fin` = mot à virgule.
 * Préfère une condition qui finit avant le mot d'alerte `k`.
 */
function condition(t: Tok[], p: Phrase, k = -1): { conj: number; debut: number; fin: number } | null {
  const trouvees: { conj: number; debut: number; fin: number }[] = [];
  for (let c = p.premier; c <= p.dernier; c++) {
    let debut = -1;
    if (/^(lorsqu|puisqu|quoiqu)'./.test(t[c].n)) debut = c;
    else {
      const conj = CONJONCTIONS_CONDITION.find((j) => suiteA(t, c, j, p.dernier));
      if (conj) debut = c + conj.length;
    }
    if (debut < 0) continue;
    for (let i = debut; i < p.dernier; i++) if (finVirgule(t[i])) { trouvees.push({ conj: c, debut, fin: i }); break; }
  }
  return trouvees.find((x) => k < 0 || x.fin < k) ?? trouvees[0] ?? null;
}

const CONJONCTIONS_FIN = new Set(["quand", "lorsque", "lorsqu'", "si", "que", "des", "chaque", "fois"]);

function detecterAlerte(t: Tok[], p: Phrase, cartes: Extract<EvenementEcran, { genre: "cartes-chiffres" }> | null): Extract<EvenementEcran, { genre: "alerte" }> | null {
  let k = -1;
  for (let i = p.premier; i <= p.dernier; i++) if (MOTS_ALERTE.has(t[i].m)) { k = i; break; }
  if (k < 0) return null;
  const opt = { maxMots: 8, maxCar: MAX_ALERTE, garderDeterminants: true };
  const candidats: [number, number][] = [];
  const cond = condition(t, p, k);
  if (cond && k > cond.fin) candidats.push([cond.debut, cond.fin]);
  candidats.push([p.premier, p.dernier]);
  const avantDet = k > p.premier && /^(un|une|l'|la|le|votre|des|les)$/.test(t[k - 1].n) ? k - 1 : k;
  candidats.push([avantDet, p.dernier]);
  let choisi: ReturnType<typeof nettoyerLibelle> = null;
  let base = 0;
  // « Lorsqu'un article… » : le préfixe élidé de la conjonction n'est pas affiché (« Un article… »).
  const motsDe = (a: number, b: number): string[] => brut(t, a, b).map((m, i) => (i === 0 ? m.replace(PREFIXE_ELIDE, "") : m));
  for (const [a, b] of candidats) {
    const brutLib = nettoyerBords(motsDe(a, b).join(" "));
    if (brutLib.length <= MAX_ALERTE) { choisi = nettoyerLibelle(motsDe(a, b), opt); base = a; if (choisi) break; }
  }
  if (!choisi) { const [a, b] = candidats[candidats.length - 1]; choisi = nettoyerLibelle(motsDe(a, b), opt); base = a; }
  if (!choisi) return null;
  // Un texte ne finit pas sur la conjonction de la condition (« …toute seule quand ») : coupe avant elle.
  while (choisi && CONJONCTIONS_FIN.has(nu(choisi.texte.split(/\s+/).pop() ?? ""))) {
    const fin = base + choisi.dernier - 1;
    const debut = base + choisi.premier;
    if (fin < debut) return null;
    choisi = nettoyerLibelle(motsDe(debut, fin), opt);
    base = debut;
  }
  if (!choisi) return null;
  const mots = new Set(choisi.texte.split(/\s+/).map(nu).filter((m) => m.length >= 5));
  let cartePulse: number | undefined;
  if (cartes) {
    let meilleur = 0;
    cartes.cartes.forEach((c, idx) => {
      const partages = c.libelle.split(/\s+/).map(nu).filter((m) => mots.has(m)).length;
      if (partages > meilleur) { meilleur = partages; cartePulse = idx; }
    });
  }
  const source = plageDe(Math.min(base + choisi.premier, k), Math.max(base + choisi.dernier, k));
  // aMs : la conjonction de la condition si elle existe (où qu'elle soit dans la phrase), sinon le début du texte AFFICHÉ.
  const aMs = cond && cond.conj <= source.premier ? t[cond.conj].debut : t[source.premier].debut;
  const ev: Extract<EvenementEcran, { genre: "alerte" }> = { genre: "alerte", aMs, texte: choisi.texte, declencheurAMs: t[k].debut, source };
  if (cartePulse !== undefined) ev.cartePulse = cartePulse;
  return ev;
}

function detecterRepere(t: Tok[], p: Phrase): { avant: string; apres: string; barreAMs: number; apresAMs: number } | null {
  for (let i = p.premier + 1; i < p.dernier - 1; i++) {
    if (!(t[i].n === "au" && t[i + 1].n === "lieu")) continue;
    let d = i + 2;
    if (d > p.dernier) continue;
    if (t[d].n === "de" || t[d].n === "d'") d++;
    if (d > p.dernier) continue;
    let e = -1;
    for (let j = i - 1; j >= Math.max(p.premier, i - 5); j--) if (t[j].n === "en") { e = j; break; }
    if (e < 0 || i - e < 2) continue;
    const opt = { maxMots: 4, maxCar: 32, garderDeterminants: true, minuscule: true };
    const apres = nettoyerLibelle(brut(t, e + 1, i - 1), opt);
    const avant = nettoyerLibelle(brut(t, d, p.dernier).map((m, k) => (k === 0 ? m.replace(/^d['’]/i, "") : m)), opt);
    if (!apres || !avant) continue;
    return { avant: avant.texte, apres: apres.texte, barreAMs: t[d + avant.premier].debut, apresAMs: t[e + 1 + apres.premier].debut };
  }
  return null;
}

function estAppel(t: Tok[], p: Phrase): boolean {
  for (let i = p.premier; i <= p.dernier; i++) if (MOTS_APPEL.has(t[i].m) || MOTS_APPEL.has(t[i].n) || MOTS_APPEL.has(nu(t[i].texte.split("-")[0]))) return true;
  return false;
}

function positionDite(t: Tok[], p: Phrase): "cartes" | "liste" | "panneau" | null {
  for (const pos of POSITIONS_DITES.slice().sort((a, b) => b.mots.length - a.mots.length)) {
    if (suiteA(t, p.premier, pos.mots, p.dernier)) return pos.cible;
  }
  return null;
}

/** Groupe nominal principal d'une phrase (carte-phrase), ≤ 48 caractères, suite contiguë du script. */
function groupeNominal(t: Tok[], p: Phrase): string {
  let a = p.premier;
  while (a < p.dernier && DEBUTS_VIDES.has(t[a].n)) a++;
  let b = a;
  while (b < p.dernier && b - a < 9 && !finVirgule(t[b]) && !RELATIFS.has(t[b + 1].n)) b++;
  const l = nettoyerLibelle(brut(t, a, b), { maxMots: 9, maxCar: MAX_CARTE_PHRASE, garderDeterminants: true });
  if (l) return l.texte;
  const secours = nettoyerLibelle(brut(t, p.premier, p.dernier), { maxMots: 9, maxCar: MAX_CARTE_PHRASE, garderDeterminants: true });
  if (secours) return secours.texte;
  return majuscule(nettoyerBords(t[p.premier].texte)).slice(0, MAX_CARTE_PHRASE);
}

/** Carte-phrase sans contenu propre (« Voici », « Merci », « Vous… ») : à fondre dans la scène voisine. */
function videDeSens(texte: string): boolean {
  const mots = texte.split(/\s+/).map(nu).map((m) => sansElision(m)).filter(Boolean);
  return mots.every((m) => DEBUTS_VIDES.has(m) || MOTS_SANS_SENS.has(m) || MOTS_VIDES_FIN.has(m) || DETERMINANTS.has(m));
}

const POLITESSES_FINALES: string[][] = [["merci"], ["bonne"], ["belle"], ["bon", "week-end"], ["a", "bientot"], ["a", "tres", "bientot"], ["a", "vite"], ["a", "demain"], ["au", "revoir"], ["cordialement"], ["bien", "cordialement"]];

/** Phrase de politesse finale : elle COMMENCE par merci, bonne (journée), à bientôt, au revoir… */
function politesseFinale(t: Tok[], p: Phrase): boolean {
  if (!POLITESSES_FINALES.some((m) => suiteA(t, p.premier, m, p.dernier))) return false;
  // « Merci de nous contacter », « Bonne nouvelle, prenez rendez-vous » : un VERBE d'appel, « rendez-vous » ou « devis » => c'est l'appel.
  // Un nom d'appel seul (« restons en contact ») reste une politesse.
  for (let i = p.premier; i <= p.dernier; i++) {
    const c = nu(t[i].texte.split("-")[0]);
    if (VERBES_APPEL.has(t[i].m) || VERBES_APPEL.has(t[i].n) || VERBES_APPEL.has(c)) return false;
    if (t[i].n.startsWith("rendez") || c === "rendez" || t[i].n === "devis" || t[i].n === "rdv") return false;
  }
  return true;
}

/** Titre plafonné (60 car.) : groupe de mots du début du script, coupé au mot, suite contiguë. */
const sansDebutPonctue = (s: string): string => s.replace(/^[\s.,;:!?…–—-]+/, "").trim();
const aDesMots = (s: string): boolean => /[\p{L}\p{N}]/u.test(s);

function titrePlafonne(mots: string[]): string {
  const brutTxt = sansDebutPonctue(mots.join(" "));
  if (nettoyerBords(brutTxt).length <= MAX_SURTITRE) return brutTxt;
  const l = nettoyerLibelle(mots.slice(0, 14), { maxMots: 12, maxCar: MAX_SURTITRE, garderDeterminants: true });
  if (l) return l.texte;
  return majuscule(nettoyerBords(mots[0] ?? "")).slice(0, MAX_SURTITRE);
}

/* ------------------------------------------------------------------ */
/* Composition                                                          */
/* ------------------------------------------------------------------ */

type CartesEv = Extract<EvenementEcran, { genre: "cartes-chiffres" }>;
type ListeEv = Extract<EvenementEcran, { genre: "liste" }>;
type TriEv = Extract<EvenementEcran, { genre: "tri" }>;
type AlerteEv = Extract<EvenementEcran, { genre: "alerte" }>;
type SansTemps<T> = T extends unknown ? Omit<T, "debutMs" | "finMs"> : never;
type Brouillon = { scene: SansTemps<SceneSansVoix>; premierMot: number };

export function composerPlanSansVoix(e: EntreePlanSansVoix): { plan: PlanComposeSansVoix; remarques: string[] } {
  const remarques: string[] = [];
  try {
    return composer(e, remarques);
  } catch (err) {
    remarques.push(`Composition interrompue (${err instanceof Error ? err.message : "erreur"}) : plan minimal.`);
    return { plan: planMinimal(e), remarques };
  }
}

function dureeImposee(e: EntreePlanSansVoix): number | null {
  const d = Number(e.dureeMs);
  return Number.isFinite(d) && d > 0 ? Math.round(d) : null;
}

/** Plan de secours : jamais de scène vide, une scène titre qui pave [0, dureeMs] ; plage de mots cohérente sans mots. */
function planMinimal(e: EntreePlanSansVoix): PlanComposeSansVoix {
  const sourceMots = [String(e.phraseTitre ?? ""), String(e.texte ?? "")].map((x) => x.trim()).find(aDesMots) ?? "";
  const texte = titrePlafonne(sourceMots.split(/\s+/).filter(Boolean));
  const nMots = Array.isArray(e.mots) ? e.mots.length : 0;
  const fins = (nMots ? e.mots : []).map((m) => Number(m?.finMs) || 0);
  const dureeMs = dureeImposee(e) ?? (fins.length ? Math.round(Math.max(...fins) + QUEUE_MS) : 1000);
  const mots = nMots ? plageDe(0, nMots - 1) : plageDe(0, -1);
  const scenes: SceneSansVoix[] = [{ id: "s1-titre", genre: "titre", texte, debutMs: 0, finMs: dureeMs, mots }];
  return { version: VERSION_SANS_VOIX, format: e.format, dureeMs, basPct: e.basPct, scenes };
}

/** Replace les indices de jetons (mots non vides) par les indices d'origine dans `mots` (contrat PlageMots). */
function remapperIndices(plan: PlanComposeSansVoix, t: Tok[], nMots: number): void {
  const vus = new Set<PlageMots>();
  const f = (r: PlageMots) => {
    if (vus.has(r)) return;
    vus.add(r);
    if (nMots === 0) { r.premier = 0; r.dernier = -1; return; }
    const p = t[Math.min(Math.max(r.premier, 0), t.length - 1)].idx;
    const d = t[Math.min(Math.max(r.dernier, 0), t.length - 1)].idx;
    r.premier = p;
    r.dernier = Math.max(p, d);
  };
  for (const sc of plan.scenes) {
    f(sc.mots);
    if (sc.genre !== "ecran") continue;
    for (const ev of sc.evenements) {
      if ("source" in ev) f(ev.source);
      if (ev.genre === "cartes-chiffres") ev.cartes.forEach((c) => f(c.source));
      if (ev.genre === "panneau") ev.rubriques.forEach((r) => f(r.source));
    }
  }
}

/** dureeMs plus courte que la parole : retire les scènes entièrement au-delà, et les événements hors de leur scène (ou les ramène à sa fin). */
function tronquerA(scenes: SceneSansVoix[], dureeMs: number, remarques: string[], t: Tok[]): void {
  const avant = scenes.length;
  for (let k = scenes.length - 1; k > 0; k--) if (scenes[k].debutMs >= dureeMs) scenes.splice(k, 1);
  if (scenes.length < avant) remarques.push(`${avant - scenes.length} scène(s) au-delà de dureeMs retirée(s).`);
  const dernier = scenes[scenes.length - 1];
  if (dernier) {
    dernier.finMs = Math.max(dernier.debutMs, dureeMs);
    // Dernier mot de la dernière scène : le dernier mot qui COMMENCE avant dureeMs.
    let lim = dernier.mots.premier;
    for (let k = 0; k < t.length; k++) if (t[k].debut < dureeMs) lim = k;
    if (dernier.mots.dernier > lim) dernier.mots = plageDe(dernier.mots.premier, Math.max(dernier.mots.premier, lim));
  }
  for (const sc of scenes) {
    if (sc.genre === "appel" && sc.clicAMs > sc.finMs) sc.clicAMs = sc.finMs;
    if (sc.genre === "repere") {
      sc.barreAMs = Math.min(sc.barreAMs, sc.finMs);
      sc.apresAMs = Math.min(sc.apresAMs, sc.finMs);
    }
    if (sc.genre !== "ecran") continue;
    const fin = sc.finMs;
    const gardes = sc.evenements
      .filter((ev) => ev.aMs < fin)
      .map((ev): EvenementEcran => {
        if (ev.genre === "focus") return ev.finMs > fin ? { ...ev, finMs: fin } : ev;
        if (ev.genre === "alerte") return ev.declencheurAMs !== undefined && ev.declencheurAMs > fin ? { ...ev, declencheurAMs: fin } : ev;
        if (ev.genre === "cartes-chiffres") {
          const cartes = ev.cartes.filter((c) => c.aMs < fin);
          return cartes.length === ev.cartes.length ? ev : { ...ev, cartes };
        }
        if (ev.genre === "panneau") {
          const rubriques = ev.rubriques.filter((r) => r.aMs < fin);
          return rubriques.length === ev.rubriques.length ? ev : { ...ev, rubriques };
        }
        return ev;
      })
      // Une liste vidée par la coupe retire son événement (jamais `cartes: []` ni `rubriques: []`).
      .filter((ev) => !(ev.genre === "cartes-chiffres" && !ev.cartes.length) && !(ev.genre === "panneau" && !ev.rubriques.length))
      .map((ev): EvenementEcran => {
        // Une carte retirée ne doit pas laisser `cartePulse` pointer dans le vide.
        if (ev.genre !== "alerte" || ev.cartePulse === undefined) return ev;
        const nCartes = sc.evenements.find((x) => x.genre === "cartes-chiffres");
        const restantes = nCartes && nCartes.genre === "cartes-chiffres" ? nCartes.cartes.filter((c) => c.aMs < fin).length : 0;
        if (ev.cartePulse < restantes) return ev;
        const { cartePulse: _retire, ...reste } = ev;
        void _retire;
        return reste;
      });
    // Un focus dont la cible a disparu avec la coupe vise l'ensemble.
    const genresRestants = new Set(gardes.map((ev) => ev.genre));
    const cibleExiste = (c: string): boolean => c === "ensemble" || (c === "cartes" && genresRestants.has("cartes-chiffres")) || genresRestants.has(c as "liste" | "panneau" | "alerte");
    for (let k = 0; k < gardes.length; k++) {
      const ev = gardes[k];
      if (ev.genre === "focus" && !cibleExiste(ev.cible)) gardes[k] = { ...ev, cible: "ensemble" };
    }
    if (gardes.length < sc.evenements.length) remarques.push(`${sc.evenements.length - gardes.length} événement(s) d'écran au-delà de dureeMs retiré(s).`);
    if (!gardes.length) gardes.push({ genre: "focus", aMs: sc.debutMs, finMs: sc.finMs, cible: "ensemble", source: plageDe(sc.mots.premier, sc.mots.dernier) });
    sc.evenements = gardes;
  }
}

/** Le repère démarre au plus tôt 600 ms avant son instant « après »/« barre » le plus précoce. */
const AVANCE_REPERE_MS = 600;

function composer(e: EntreePlanSansVoix, remarques: string[]): { plan: PlanComposeSansVoix; remarques: string[] } {
  const t = jetons(e);
  if (!t.length) {
    remarques.push("Script vide : aucune scène déduite.");
    return { plan: planMinimal(e), remarques };
  }
  if (!t.some((m) => aDesMots(m.texte))) {
    remarques.push("Script sans mots (ponctuation seule) : une seule scène titre, rien d'autre n'est déduit.");
    return { plan: planMinimal(e), remarques };
  }
  const phrases = decouperPhrases(t);
  const dureeMs = dureeImposee(e) ?? Math.round(Math.max(...t.map((m) => m.fin)) + QUEUE_MS);
  const finMots = Math.max(...t.map((m) => m.fin));
  if (dureeImposee(e) !== null && dureeMs < finMots) remarques.push(`dureeMs (${dureeMs} ms) plus courte que la fin des mots (${finMots} ms) : les derniers mots sont coupés.`);
  const nMots = Array.isArray(e.mots) ? e.mots.length : 0;
  if (nMots === 0) remarques.push("Aucun mot horodaté : instants estimés, plages de mots vides.");
  const nP = phrases.length;

  // Repères, appel final, outil.
  const reperes = new Map<number, NonNullable<ReturnType<typeof detecterRepere>>>();
  for (let i = 1; i < nP; i++) {
    const r = detecterRepere(t, phrases[i]);
    if (r) reperes.set(i, r);
  }
  let appel: { premier: number; appel: number; question: number | null } | null = null;
  // Les phrases finales sans sens (« Merci. ») ne comptent pas : l'appel est la dernière phrase significative.
  let nA = nP - 1;
  while (nA > 1 && (videDeSens(phrases[nA].texte) || politesseFinale(t, phrases[nA]))) nA--;
  if (nA >= 1 && estAppel(t, phrases[nA])) {
    const q = nA - 1 >= 1 && phrases[nA - 1].question ? nA - 1 : null;
    appel = { premier: q ?? nA, appel: nA, question: q };
  }
  const terminal = (i: number): boolean => reperes.has(i) || (appel !== null && i >= appel.premier);

  const outilParPhrase = phrases.map((p) => trouverOutil(t, p));
  const outil = outilParPhrase.find((o) => o) ?? null;
  const declencheEcran = (i: number): boolean => {
    const p = phrases[i];
    return detecterCartes(t, p, []) !== null || detecterListe(t, p) !== null || detecterClic(t, p, []) !== null || t.slice(p.premier, p.dernier + 1).some((m) => MOTS_ALERTE.has(m.m));
  };
  let eS = -1;
  if (outil) {
    for (let i = 1; i < nP && eS < 0; i++) if (outilParPhrase[i] || (!outilParPhrase.slice(1).some((o) => o) && declencheEcran(i))) eS = i;
  } else remarques.push("Aucun nom d'outil reconnu dans le script (« tableau de bord », « application », « outil »…) : pas d'écran dessiné, cartes-phrases à la place.");
  let eE = -1;
  if (eS >= 0) {
    eE = nP;
    for (let i = eS; i < nP; i++) if (terminal(i)) { eE = i; break; }
    if (eE <= eS) eS = -1;
  }

  // Événements de l'écran.
  let ecran: { eS: number; eE: number; titre: string; evenements: EvenementEcran[] } | null = null;
  if (eS >= 0) {
    let cartes = null as CartesEv | null;
    let liste = null as ListeEv | null;
    let tri = null as TriEv | null;
    let clic = null as Extract<EvenementEcran, { genre: "clic" }> | null;
    let panneau = null as Extract<EvenementEcran, { genre: "panneau" }> | null;
    let alerte = null as AlerteEv | null;
    const reconnue = new Set<number>();
    for (let i = eS; i < eE; i++) {
      const p = phrases[i];
      const c: CartesEv | null = cartes ? null : detecterCartes(t, p, remarques);
      if (c) { cartes = c; reconnue.add(i); }
      const l: ListeEv | null = liste ? null : detecterListe(t, p);
      if (l) { liste = l; reconnue.add(i); }
      const tr: TriEv | null = tri || !liste ? null : detecterTri(t, p);
      if (tr) { tri = tr; reconnue.add(i); }
      if (!clic) {
        const cp = detecterClic(t, p, remarques);
        if (cp) {
          if (liste) { clic = cp.clic; panneau = cp.panneau; reconnue.add(i); }
          else remarques.push("Un clic est dit mais aucune liste n'a été reconnue avant : clic non dessiné (pas de cible).");
        }
      }
      const a: AlerteEv | null = alerte ? null : detecterAlerte(t, p, cartes);
      if (a) { alerte = a; reconnue.add(i); }
    }
    const evenements: EvenementEcran[] = [];
    for (const ev of [cartes as EvenementEcran | null, liste, tri, clic, panneau, alerte]) if (ev) evenements.push(ev);
    if (!evenements.length) {
      remarques.push("Outil reconnu mais aucune énumération, liste, clic ou alerte reconnus : pas d'écran dessiné.");
    } else {
      const focus: EvenementEcran[] = [];
      for (let i = eS; i < eE; i++) {
        const p = phrases[i];
        const pos = positionDite(t, p);
        const existe = (c: string) => (c === "cartes" ? cartes : c === "liste" ? liste : c === "panneau" ? panneau : null) !== null;
        if (pos) {
          focus.push({ genre: "focus", aMs: t[p.premier].debut, finMs: t[p.dernier].fin, cible: existe(pos) ? pos : "ensemble", source: plageDe(p.premier, p.dernier) });
        } else if (!reconnue.has(i)) {
          focus.push({ genre: "focus", aMs: t[p.premier].debut, finMs: t[p.dernier].fin, cible: "ensemble", source: plageDe(p.premier, p.dernier) });
        }
      }
      const titreOutil = outilParPhrase[eS]?.titre ?? outilParPhrase.find((o) => o)?.titre;
      ecran = { eS, eE, titre: titreOutil || "Tableau de bord", evenements: [...evenements, ...focus] };
    }
  }

  // Scènes.
  const brouillons: Brouillon[] = [];
  const idDe = (g: string) => `s${brouillons.length + 1}-${g}`;
  const p0 = phrases[0];
  const texteP0 = sansDebutPonctue(p0.texte);
  // Même règle que le plan minimal : titre saisi plafonné à 60 caractères, coupé au mot.
  const saisi = sansDebutPonctue(String(e.phraseTitre ?? ""));
  const titreSaisi = saisi ? titrePlafonne(saisi.split(/\s+/).filter(Boolean)) : "";
  {
    const texte = titreSaisi || titrePlafonne(brut(t, p0.premier, p0.dernier));
    if (!titreSaisi && texte !== texteP0) remarques.push("1re phrase trop longue pour le titre : groupe de mots du début, coupé au mot.");
    const sur = titreSaisi && texteP0.length <= MAX_SURTITRE && nu(texteP0) !== nu(titreSaisi) ? texteP0 : undefined;
    brouillons.push({
      scene: { id: idDe("titre"), genre: "titre", texte, ...(sur ? { surTitre: sur } : {}), mots: plageDe(p0.premier, p0.dernier) },
      premierMot: p0.premier,
    });
    if (titreSaisi && !sur && nP > 1) remarques.push("La 1re phrase du script est trop longue pour servir de sur-titre : seule la phrase titre est affichée.");
  }
  let i = 1;
  while (i < nP) {
    const p = phrases[i];
    if (ecran && i === ecran.eS) {
      const f = phrases[ecran.eE - 1];
      brouillons.push({
        scene: { id: idDe("ecran"), genre: "ecran", titreFenetre: ecran.titre, evenements: ecran.evenements, mots: plageDe(p.premier, f.dernier) },
        premierMot: p.premier,
      });
      i = ecran.eE;
      continue;
    }
    if (appel && i === appel.premier) {
      const pa = phrases[appel.appel];
      const rdvIdx = t.findIndex((m, k) => k >= pa.premier && k <= pa.dernier && m.n.startsWith("rendez"));
      let motAppel = pa.premier;
      const estMotAppel = (k: number): boolean => MOTS_APPEL.has(t[k].m) || MOTS_APPEL.has(t[k].n) || MOTS_APPEL.has(nu(t[k].texte.split("-")[0]));
      const estVerbe = (k: number): boolean => VERBES_APPEL.has(t[k].m) || VERBES_APPEL.has(t[k].n) || VERBES_APPEL.has(nu(t[k].texte.split("-")[0]));
      // Un verbe d'appel (« Contactez-nous ») l'emporte sur un nom (« Devis »).
      const kVerbe = t.findIndex((_, k) => k >= pa.premier && k <= pa.dernier && estVerbe(k));
      if (kVerbe >= 0) motAppel = kVerbe;
      else for (let k = pa.premier; k <= pa.dernier; k++) if (estMotAppel(k)) { motAppel = k; break; }
      let bouton: string;
      if (e.fin === "rendez-vous") bouton = "Prendre rendez-vous";
      else {
        // Suite littérale de la PHRASE D'APPEL seule, à partir du mot d'appel.
        const l = nettoyerLibelle(brut(t, motAppel, Math.min(pa.dernier, motAppel + 2)), { maxMots: 3, maxCar: 30, garderDeterminants: true });
        bouton = l ? l.texte : majuscule(nettoyerBords(t[motAppel].texte));
      }
      const qTexte = appel.question !== null ? nettoyerBords(phrases[appel.question].texte) : "";
      const questionTexte = appel.question !== null ? phrases[appel.question].texte.trim() : "";
      const question = qTexte && qTexte.length <= MAX_SURTITRE ? questionTexte : undefined;
      if (qTexte && !question) remarques.push("La question finale est trop longue pour la scène d'appel : seul le bouton est affiché.");
      brouillons.push({
        scene: { id: idDe("appel"), genre: "appel", ...(question ? { question } : {}), bouton, clicAMs: t[rdvIdx >= 0 ? rdvIdx : motAppel].debut, mots: plageDe(p.premier, phrases[nP - 1].dernier) },
        premierMot: p.premier,
      });
      i = nP; // les politesses finales (« Merci, bonne journée. ») sont fondues dans la scène d'appel
      continue;
    }
    const r = reperes.get(i);
    if (r) {
      brouillons.push({ scene: { id: idDe("repere"), genre: "repere", ...r, mots: plageDe(p.premier, p.dernier) }, premierMot: p.premier });
      i++;
      continue;
    }
    const texte = groupeNominal(t, p);
    const precedent = brouillons[brouillons.length - 1];
    if (videDeSens(texte) && precedent) {
      remarques.push(`Phrase ${i + 1} sans contenu propre (« ${texte} ») : fondue dans la scène précédente.`);
      precedent.scene.mots = plageDe(precedent.scene.mots.premier, p.dernier);
      i++;
      continue;
    }
    remarques.push(`Phrase ${i + 1} non reconnue comme une action d'écran : reprise en carte-phrase « ${texte} ».`);
    brouillons.push({ scene: { id: idDe("carte-phrase"), genre: "carte-phrase", texte, mots: plageDe(p.premier, p.dernier) }, premierMot: p.premier });
    i++;
  }
  if (!reperes.size && outil) remarques.push("Pas de repère « en X au lieu de Y » reconnu.");
  if (!appel) remarques.push("Pas d'appel final reconnu (question + « rendez-vous » / « contactez ») : la carte de fin s'en charge.");

  // Pavage de [0, dureeMs] sans trou.
  const scenes: SceneSansVoix[] = [];
  let borne = 0;
  // Début naturel d'une scène = son premier mot. Exception : un repère démarre au plus tôt 600 ms avant son premier instant
  // (« une minute » ou « une heure »), lorsque cet instant est postérieur au début de sa phrase : la scène précédente
  // (l'écran, où se joue l'alerte) est prolongée d'autant. La plage `mots` du repère garde toute sa phrase (côté repère).
  const debutBrut = (b: Brouillon): number => {
    const d = t[b.premierMot].debut;
    if (b.scene.genre !== "repere") return d;
    const avant = Math.min(b.scene.barreAMs, b.scene.apresAMs) - AVANCE_REPERE_MS;
    // Jamais moins de 600 ms d'écran après le début de la phrase du repère (« Vous décidez en… »).
    return avant > d ? Math.max(avant, d + AVANCE_REPERE_MS) : d;
  };
  brouillons.forEach((b, k) => {
    const debut = Math.min(dureeMs, k === 0 ? 0 : Math.max(borne, debutBrut(b)));
    const suivant = brouillons[k + 1];
    const fin = suivant ? Math.min(dureeMs, Math.max(debut, debutBrut(suivant))) : Math.max(debut, dureeMs);
    scenes.push({ ...b.scene, debutMs: debut, finMs: fin } as SceneSansVoix);
    borne = fin;
  });
  if (dureeMs < finMots) tronquerA(scenes, dureeMs, remarques, t);
  const plan: PlanComposeSansVoix = { version: VERSION_SANS_VOIX, format: e.format, dureeMs, basPct: e.basPct, scenes };
  remapperIndices(plan, t, nMots);
  return { plan, remarques };
}
