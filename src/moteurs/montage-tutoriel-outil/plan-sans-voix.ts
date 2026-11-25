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
} from "./plan-sans-voix-regles";

const QUEUE_MS = 500;
const MS_PAR_MOT_REPLI = 385;
const MAX_SURTITRE = 60;
const MAX_ALERTE = 40;
const MAX_CARTE_PHRASE = 48;

interface Tok { texte: string; n: string; debut: number; fin: number }
interface Phrase { premier: number; dernier: number; texte: string; question: boolean }

export interface EntreePlanSansVoix {
  texte: string;
  mots: MotMinute[];
  format: FormatImage;
  phraseTitre?: string;
  basPct: number;
  fin?: "aucune" | "rendez-vous";
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
  for (const m of brut) {
    const texte = m.texte.trim();
    if (!texte) continue;
    const debut = Math.round(Math.max(dernierDebut, m.debutMs));
    const fin = Math.round(Math.max(debut, m.finMs));
    dernierDebut = debut;
    sortie.push({ texte, n: nu(texte), debut, fin });
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
  return phrases;
}

const brut = (t: Tok[], a: number, b: number): string[] => t.slice(a, b + 1).map((m) => m.texte);
const finVirgule = (m: Tok): boolean => /[,;:]["»”)]*$/.test(m.texte);
const estDeuxPoints = (m: Tok): boolean => m.texte === ":" || m.texte.endsWith(":");
const plageDe = (a: number, b: number): PlageMots => ({ premier: a, dernier: b });

/** Cherche une suite de mots pliés à partir de `depuis` dans [depuis, borne]. */
function suiteA(t: Tok[], i: number, mots: string[], borne: number): boolean {
  if (i + mots.length - 1 > borne) return false;
  return mots.every((w, k) => t[i + k].n === w);
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
  if (sortie.length === 1) {
    const [x, y] = sortie[0];
    const coupes: [number, number][] = [];
    let d = x;
    for (let i = x + 1; i < y; i++) if (t[i].n === "et") { coupes.push([d, i - 1]); d = i + 1; }
    if (coupes.length) { coupes.push([d, y]); return coupes; }
  }
  return sortie;
}

function elements(t: Tok[], a: number, b: number, opt: { maxMots: number; maxCar: number }, remarques: string[], quoi: string): { libelle: string; aMs: number; source: PlageMots }[] {
  const sortie: { libelle: string; aMs: number; source: PlageMots }[] = [];
  for (const [x, y] of segments(t, a, b)) {
    const l = nettoyerLibelle(brut(t, x, y), opt);
    if (!l) continue;
    if (l.tronque) remarques.push(`${quoi} « ${l.texte} » raccourci (suite contiguë du script, trop long pour la carte).`);
    sortie.push({ libelle: l.texte, aMs: t[x + l.premier].debut, source: plageMots(x + l.premier, x + l.dernier) });
  }
  return sortie;
}
const plageMots = plageDe;

function detecterCartes(t: Tok[], p: Phrase, remarques: string[]): Extract<EvenementEcran, { genre: "cartes-chiffres" }> | null {
  for (let i = p.premier; i <= p.dernier; i++) {
    if (!NOMS_ANNONCE.has(t[i].n)) continue;
    let deuxPoints = -1;
    for (let j = i; j <= Math.min(i + 3, p.dernier); j++) if (estDeuxPoints(t[j])) { deuxPoints = j; break; }
    if (deuxPoints < 0) continue;
    const cartes = elements(t, deuxPoints + 1, p.dernier, { maxMots: 6, maxCar: 30 }, remarques, "Carte").slice(0, 3);
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
  for (let i = p.premier; i <= p.dernier; i++) if (MOTS_CLIC.has(t[i].n)) { c = i; break; }
  if (c < 0) return null;
  const clic: Extract<EvenementEcran, { genre: "clic" }> = { genre: "clic", aMs: t[c].debut, cible: "ligne-1", source: plageDe(c, c) };
  let o = -1;
  for (let i = c + 1; i <= p.dernier; i++) if (MOTS_OUVRE.has(t[i].n)) { o = i; break; }
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
  const rubriques = elements(t, deuxPoints + 1, p.dernier, { maxMots: 8, maxCar: 44 }, remarques, "Rubrique").slice(0, 4);
  if (!rubriques.length) return { clic, panneau: null };
  return { clic, panneau: { genre: "panneau", aMs: t[o].debut, titre: titre.texte, rubriques, source: plageDe(o, p.dernier) } };
}

function condition(t: Tok[], p: Phrase): { debut: number; fin: number } | null {
  for (const conj of CONJONCTIONS_CONDITION) {
    if (!suiteA(t, p.premier, conj, p.dernier)) continue;
    const debut = p.premier + conj.length;
    for (let i = debut; i < p.dernier; i++) if (finVirgule(t[i])) return { debut, fin: i };
  }
  return null;
}

function detecterAlerte(t: Tok[], p: Phrase, cartes: Extract<EvenementEcran, { genre: "cartes-chiffres" }> | null): Extract<EvenementEcran, { genre: "alerte" }> | null {
  let k = -1;
  for (let i = p.premier; i <= p.dernier; i++) if (MOTS_ALERTE.has(t[i].n)) { k = i; break; }
  if (k < 0) return null;
  const opt = { maxMots: 8, maxCar: MAX_ALERTE, garderDeterminants: true };
  const candidats: [number, number][] = [];
  const cond = condition(t, p);
  if (cond && k > cond.fin) candidats.push([cond.debut, cond.fin]);
  candidats.push([p.premier, p.dernier]);
  const avantDet = k > p.premier && /^(un|une|l'|la|le|votre|des|les)$/.test(t[k - 1].n) ? k - 1 : k;
  candidats.push([avantDet, p.dernier]);
  let choisi: ReturnType<typeof nettoyerLibelle> = null;
  let base = 0;
  for (const [a, b] of candidats) {
    const brutLib = nettoyerBords(brut(t, a, b).join(" "));
    if (brutLib.length <= MAX_ALERTE) { choisi = nettoyerLibelle(brut(t, a, b), opt); base = a; if (choisi) break; }
  }
  if (!choisi) { const [a, b] = candidats[candidats.length - 1]; choisi = nettoyerLibelle(brut(t, a, b), opt); base = a; }
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
  const ev: Extract<EvenementEcran, { genre: "alerte" }> = { genre: "alerte", aMs: t[k].debut, texte: choisi.texte, source: plageDe(Math.min(base + choisi.premier, k), Math.max(base + choisi.dernier, k)) };
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
    return { avant: avant.texte, apres: apres.texte, barreAMs: t[d].debut, apresAMs: t[e + 1 + apres.premier].debut };
  }
  return null;
}

function estAppel(t: Tok[], p: Phrase): boolean {
  for (let i = p.premier; i <= p.dernier; i++) if (MOTS_APPEL.has(t[i].n) || MOTS_APPEL.has(nu(t[i].texte.split("-")[0]))) return true;
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

function planMinimal(e: EntreePlanSansVoix): PlanComposeSansVoix {
  const texte = (e.phraseTitre ?? e.texte ?? "").trim();
  const dureeMs = 1000;
  const scenes: SceneSansVoix[] = texte ? [{ id: "s1-titre", genre: "titre", texte, debutMs: 0, finMs: dureeMs, mots: plageDe(0, 0) }] : [];
  return { version: VERSION_SANS_VOIX, format: e.format, dureeMs, basPct: e.basPct, scenes };
}

function composer(e: EntreePlanSansVoix, remarques: string[]): { plan: PlanComposeSansVoix; remarques: string[] } {
  const t = jetons(e);
  if (!t.length) {
    remarques.push("Script vide : aucune scène déduite.");
    return { plan: planMinimal(e), remarques };
  }
  const phrases = decouperPhrases(t);
  const dureeMs = Math.round(Math.max(...t.map((m) => m.fin)) + QUEUE_MS);
  const nP = phrases.length;

  // Repères, appel final, outil.
  const reperes = new Map<number, NonNullable<ReturnType<typeof detecterRepere>>>();
  for (let i = 1; i < nP; i++) {
    const r = detecterRepere(t, phrases[i]);
    if (r) reperes.set(i, r);
  }
  let appel: { premier: number; appel: number; question: number | null } | null = null;
  if (nP >= 2 && estAppel(t, phrases[nP - 1])) {
    const q = nP - 2 >= 1 && phrases[nP - 2].question ? nP - 2 : null;
    appel = { premier: q ?? nP - 1, appel: nP - 1, question: q };
  }
  const terminal = (i: number): boolean => reperes.has(i) || (appel !== null && i >= appel.premier);

  const outilParPhrase = phrases.map((p) => trouverOutil(t, p));
  const outil = outilParPhrase.find((o) => o) ?? null;
  const declencheEcran = (i: number): boolean => {
    const p = phrases[i];
    return detecterCartes(t, p, []) !== null || detecterListe(t, p) !== null || detecterClic(t, p, []) !== null || t.slice(p.premier, p.dernier + 1).some((m) => MOTS_ALERTE.has(m.n));
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
      ecran = { eS, eE, titre: outil ? (outilParPhrase.find((o) => o)?.titre ?? "Tableau de bord") : "Tableau de bord", evenements: [...evenements, ...focus] };
      const titreOutil = outilParPhrase[eS]?.titre ?? outilParPhrase.find((o) => o)?.titre;
      if (titreOutil) ecran.titre = titreOutil;
    }
  }

  // Scènes.
  const brouillons: Brouillon[] = [];
  const idDe = (g: string) => `s${brouillons.length + 1}-${g}`;
  const p0 = phrases[0];
  const texteP0 = nettoyerBords(p0.texte) === "" ? p0.texte : p0.texte.trim();
  const titreSaisi = (e.phraseTitre ?? "").trim();
  {
    const texte = titreSaisi || texteP0;
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
      const rdvDit = t.some((m) => m.n.startsWith("rendez"));
      const rdvIdx = t.findIndex((m, k) => k >= pa.premier && k <= pa.dernier && m.n.startsWith("rendez"));
      let bouton: string;
      if (e.fin === "rendez-vous" || rdvDit) bouton = "Prendre rendez-vous";
      else {
        const l = nettoyerLibelle(brut(t, pa.premier, Math.min(pa.dernier, pa.premier + 2)), { maxMots: 3, maxCar: 30, garderDeterminants: true });
        bouton = l ? l.texte : majuscule(nettoyerBords(t[pa.premier].texte));
      }
      const qTexte = appel.question !== null ? nettoyerBords(phrases[appel.question].texte) : "";
      const questionTexte = appel.question !== null ? phrases[appel.question].texte.trim() : "";
      const question = qTexte && qTexte.length <= MAX_SURTITRE ? questionTexte : undefined;
      if (qTexte && !question) remarques.push("La question finale est trop longue pour la scène d'appel : seul le bouton est affiché.");
      brouillons.push({
        scene: { id: idDe("appel"), genre: "appel", ...(question ? { question } : {}), bouton, clicAMs: t[rdvIdx >= 0 ? rdvIdx : pa.premier].debut, mots: plageDe(p.premier, pa.dernier) },
        premierMot: p.premier,
      });
      i = appel.appel + 1;
      continue;
    }
    const r = reperes.get(i);
    if (r) {
      brouillons.push({ scene: { id: idDe("repere"), genre: "repere", ...r, mots: plageDe(p.premier, p.dernier) }, premierMot: p.premier });
      i++;
      continue;
    }
    const texte = groupeNominal(t, p);
    remarques.push(`Phrase ${i + 1} non reconnue comme une action d'écran : reprise en carte-phrase « ${texte} ».`);
    brouillons.push({ scene: { id: idDe("carte-phrase"), genre: "carte-phrase", texte, mots: plageDe(p.premier, p.dernier) }, premierMot: p.premier });
    i++;
  }
  if (!reperes.size && outil) remarques.push("Pas de repère « en X au lieu de Y » reconnu.");
  if (!appel) remarques.push("Pas d'appel final reconnu (question + « rendez-vous » / « contactez ») : la carte de fin s'en charge.");

  // Pavage de [0, dureeMs] sans trou.
  const scenes: SceneSansVoix[] = [];
  let borne = 0;
  brouillons.forEach((b, k) => {
    const debut = k === 0 ? 0 : Math.max(borne, t[b.premierMot].debut);
    const suivant = brouillons[k + 1];
    const fin = suivant ? Math.max(debut, t[suivant.premierMot].debut) : Math.max(debut, dureeMs);
    scenes.push({ ...b.scene, debutMs: debut, finMs: fin } as SceneSansVoix);
    borne = fin;
  });
  return { plan: { version: VERSION_SANS_VOIX, format: e.format, dureeMs, basPct: e.basPct, scenes }, remarques };
}
