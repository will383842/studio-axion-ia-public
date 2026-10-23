/**
 * SOUS-TITRES du face caméra animé (lot C) — PUR. Groupes « mot à mot cumulatifs » de la référence (ANALYSE-COMPLETE-v2
 * § 3.2) : 1 à 3 mots visibles, puis la phrase repart à zéro.
 *
 * Coupure APRÈS un mot quand : il porte une ponctuation, c'est un mot fort (il finit sa plaque), le groupe a 3 mots, ou
 * le blanc jusqu'au mot suivant dépasse 0,35 s. `fin` = début du groupe suivant, au plus fin du dernier mot + 0,5 s
 * (même calcul que `donnees-galerie-mots.ts`, vérifié sur la galerie).
 *
 * Revue passe 3 : jamais un groupe de 1 ou 2 PETITS mots (« ET CE », « ALORS ») — il est absorbé par son voisin (4 mots
 * au plus dans ce cas) ; `etiquetteDoubleSousTitre` sert au contrôle « une étiquette ne double pas le sous-titre ».
 *
 * Mots forts (plaque) : chiffres et nombres dits, noms concrets et verbes d'action clés d'un petit lexique, plus la liste
 * passée par le réalisateur (les mots qu'il illustre).
 */
import type { GroupeSousTitrePlan } from "@/domaine/facecam-animee/plan";
import { estMotOutil, estNombreDit, estUnite, nettoyer, nombreDeLettres, ponctuationFinale, recollerElisions, sansElision, sansMotsInterditsEcran, simplifier, valeurEnLettres, type MotTranscrit } from "./mots";

export const BLANC_COUPURE_SEC = 0.35;
export const MOTS_PAR_GROUPE = 3;
export const TRAINE_FIN_SEC = 0.5;
/** Au plus 22 caractères affichés par groupe (espaces comprises). */
export const CARACTERES_PAR_GROUPE = 22;
/** Un mot de plus de 12 lettres s'affiche seul. */
export const LETTRES_MOT_SEUL = 12;
/** Aucun groupe n'est affiché moins de 0,18 s. */
export const DUREE_MIN_GROUPE_SEC = 0.18;

/** Lexique des mots forts par défaut (forme simplifiée : minuscules, sans accents). */
const LEXIQUE_FORTS = new Set(
  (
    "temps argent euro euros devis relance relances facture factures client clients chiffre chiffres equipe equipes outil outils ia " +
    "automatiser automatise automatisez automatisation diagnostic gratuit gratuite fuite travail soiree soirees journee journees week-end " +
    "apres-midi dirigeant dirigeants entreprise entreprises recruter recrutement embauche gagner gagnez reservez reserver commentez " +
    "former forme formation audit audite auditer accompagne accompagnement priorites minutes heures jours semaine mois resultat " +
    "resultats vente ventes prospects rendez-vous appel mail mails email emails telephone stack logiciel site miracle"
  ).split(/\s+/),
);

export interface OptionsSousTitres {
  /** Mots forts choisis par le réalisateur (ceux qu'il illustre) : comparés sans casse ni accents ni ponctuation. */
  motsForts?: readonly string[];
}

/** Vrai pour un mot fort : chiffre ou nombre dit (sauf l'article « un/une »), mot du lexique ou de la liste fournie. */
export function estMotFort(w: string, motsForts: ReadonlySet<string> = new Set()): boolean {
  const propre = nettoyer(w);
  if (!propre) return false;
  if (/\d/.test(propre)) return true;
  const s = simplifier(propre);
  const lettres = valeurEnLettres(propre);
  if (lettres !== null && s !== "un" && s !== "une") return true;
  const base = simplifier(sansElision(propre));
  return motsForts.has(s) || motsForts.has(base) || LEXIQUE_FORTS.has(s) || LEXIQUE_FORTS.has(base);
}

/** Ensemble simplifié des mots forts fournis (« Devis, » → « devis »). */
export function ensembleMotsForts(liste: readonly string[] = []): Set<string> {
  const e = new Set<string>();
  for (const x of liste) for (const morceau of x.split(/\s+/)) {
    const s = simplifier(nettoyer(morceau));
    if (s) e.add(s);
  }
  return e;
}

/** Un mot prêt à afficher : texte sans ponctuation, début, fin, plaque, et ce qui ferme le groupe après lui. */
interface Jeton {
  w: string;
  a: number;
  f: number;
  fort: boolean;
  /** Ponctuation finale ou signe seul juste après : la phrase se coupe ici. */
  coupe: boolean;
  /** Ce signe (« . », « , », « ? »…), quand il y en a un. */
  ponctuation?: string;
}

/** Mots horodatés → jetons affichables : ponctuation retirée, signes seuls absorbés, « nombre + unité » fondus en un seul. */
function jetons(mots: readonly MotTranscrit[], forts: ReadonlySet<string>): Jeton[] {
  const tries = [...mots].sort((x, y) => x.a - y.a);
  const sortie: Jeton[] = [];
  for (let i = 0; i < tries.length; i++) {
    const m = tries[i];
    const propre = nettoyer(m.w);
    // Un signe seul (« ? ») ne s'affiche pas, mais il ferme la phrase en cours.
    if (!propre) {
      if (sortie.length) {
        const d = sortie[sortie.length - 1];
        d.coupe = true;
        d.ponctuation = ponctuationFinale(m.w) ?? m.w.trim().charAt(0);
      }
      continue;
    }
    const suivant = tries[i + 1];
    if (suivant && estNombreDit(m.w) && !ponctuationFinale(m.w) && estUnite(suivant.w) && suivant.a - m.f <= BLANC_COUPURE_SEC) {
      const p = ponctuationFinale(suivant.w);
      sortie.push({ w: `${propre} ${nettoyer(suivant.w)}`, a: m.a, f: suivant.f, fort: true, coupe: p !== null, ...(p ? { ponctuation: p } : {}) });
      i++;
      continue;
    }
    const p = ponctuationFinale(m.w);
    sortie.push({ w: propre, a: m.a, f: m.f, fort: estMotFort(m.w, forts), coupe: p !== null, ...(p ? { ponctuation: p } : {}) });
  }
  return sortie;
}

/**
 * Mots de LIAISON (articles, prépositions, conjonctions, possessifs, pronoms courts) : ils ne restent jamais seuls à
 * l'écran ni en fin de groupe — ils se rattachent au mot qui les suit (« EN », « ET », « LA », « QUI » seuls : revue
 * passe 2). Minuscules, accents GARDÉS (« là », « où » n'en sont pas) ; une forme élidée est jugée sur ce qui suit
 * l'apostrophe (« qu'à » → « à », « d'un » → « un »). Même liste que `LIAISONS` de `SousTitres.tsx` (test).
 */
export const MOTS_LIAISON: readonly string[] = Object.freeze(
  (
    "le la les l un une des de du d au aux a à en et ou mais que qu qui quoi ce cet cette ces se sa son ses leur leurs vos votre " +
    "notre nos mon ma mes ton ta tes par pour sur sous dans avec sans chez vers je j on il ils elle elles ne n y"
  ).split(/\s+/),
);
const LIAISON = new Set(MOTS_LIAISON);

/** Vrai pour un mot de liaison (jamais un nombre ni un mot fort). */
export function estMotLiaison(w: string): boolean {
  const propre = nettoyer(w);
  if (!propre || /\d/.test(propre)) return false;
  return LIAISON.has(propre.toLowerCase()) || LIAISON.has(sansElision(propre).toLowerCase());
}

/** Caractères affichés d'un groupe (mots séparés par une espace). */
export function caracteresAffiches(mots: readonly { w: string }[]): number {
  return mots.reduce((n, m, i) => n + m.w.length + (i ? 1 : 0), 0);
}

/** Vrai si une suite de mots tient dans un groupe (1 à 3 mots, ≤ 22 caractères). */
const tient = (mots: readonly { w: string }[]) => mots.length >= 1 && mots.length <= MOTS_PAR_GROUPE && caracteresAffiches(mots) <= CARACTERES_PAR_GROUPE;

/**
 * Groupes de sous-titres depuis les mots horodatés (ordre du temps) — nerveux comme la référence :
 * 1 à 3 mots et ≤ 22 caractères ; un mot fort ferme le groupe ; un mot de plus de 12 lettres est seul ; un nombre et
 * son unité sur la même plaque ; coupure à la ponctuation et sur un blanc > 0,35 s ; aucun groupe affiché moins de
 * 0,18 s (fondu avec le suivant, sinon avec le précédent).
 */
export function groupesSousTitres(mots: readonly MotTranscrit[], options: OptionsSousTitres = {}): GroupeSousTitrePlan[] {
  // Mots interdits à l'écran (Certifexemple, certifié, Villeexemple, gain garanti…) : jamais affichés, même dits par Will ; le groupe saute le mot.
  const liste = jetons(sansMotsInterditsEcran(recollerElisions(mots)), ensembleMotsForts(options.motsForts));
  const bruts: Jeton[][] = [];
  let courant: Jeton[] = [];
  const fermer = () => {
    if (courant.length) bruts.push(courant);
    courant = [];
  };
  liste.forEach((j, i) => {
    const long = nombreDeLettres(j.w) > LETTRES_MOT_SEUL;
    if (long || !tient([...courant, j])) fermer();
    courant.push(j);
    const suivant = liste[i + 1];
    const blanc = suivant ? suivant.a - j.f : Infinity;
    if (long || j.coupe || j.fort || courant.length >= MOTS_PAR_GROUPE || blanc > BLANC_COUPURE_SEC) fermer();
  });
  fermer();

  // Fin d'affichage : début du groupe suivant, au plus fin du dernier mot + 0,5 s.
  const finDe = (gs: Jeton[][], i: number) => {
    const g = gs[i];
    const plafond = g[g.length - 1].f + TRAINE_FIN_SEC;
    return gs[i + 1] ? Math.min(gs[i + 1][0].a, plafond) : plafond;
  };
  const gs = bruts;
  // Les mots de liaison se rattachent au mot suivant (avant le contrôle des durées).
  rattacherLiaisons(gs, () => true);
  // Aucun groupe trop bref : fondu avec le suivant s'il tient, sinon il lui emprunte ses premiers mots, sinon fondu
  // avec le précédent.
  for (let i = 0; i < gs.length; ) {
    if (finDe(gs, i) - gs[i][0].a >= DUREE_MIN_GROUPE_SEC - 1e-9) {
      i++;
      continue;
    }
    const prochain = gs[i + 1];
    let emprunt = 0;
    if (prochain) while (emprunt + 1 < prochain.length && tient([...gs[i], ...prochain.slice(0, emprunt + 1)])) emprunt++;
    if (prochain && tient([...gs[i], ...prochain])) {
      gs.splice(i, 2, [...gs[i], ...prochain]);
    } else if (prochain && emprunt > 0) {
      gs.splice(i, 2, [...gs[i], ...prochain.slice(0, emprunt)], prochain.slice(emprunt));
    } else if (i > 0 && tient([...gs[i - 1], ...gs[i]])) {
      gs.splice(i - 1, 2, [...gs[i - 1], ...gs[i]]);
      i--;
    } else i++;
  }
  // Second passage (les fusions ont pu reposer un mot de liaison en fin de groupe) : seulement si le groupe qui le
  // perd reste affiché 0,18 s au moins.
  rattacherLiaisons(gs, (g, w) => w.a - g[0].a >= DUREE_MIN_GROUPE_SEC - 1e-9);
  // Revue passe 3 : jamais un groupe fait de 1 ou 2 PETITS mots (« ET CE », « ALORS », « PLUS » seuls).
  absorberPetitsGroupes(gs, finDe);

  return gs.map((g, i) => {
    // Filet de sécurité (rarissime : un mot éclair coincé entre deux groupes pleins) : il reste 0,18 s à l'écran.
    const fin = Math.max(finDe(gs, i), g[0].a + DUREE_MIN_GROUPE_SEC);
    return { mots: g.map((j) => (j.fort ? { w: j.w, a: j.a, fort: true } : { w: j.w, a: j.a })), fin: arrondi(fin) };
  });
}

/**
 * Rattache au mot suivant les mots de liaison laissés en FIN de groupe ou formant à eux seuls un groupe (« un problème
 * de » + « travail » → « un problème » + « de travail » ; « qu'à » seul → « qu'à partir ») :
 *  - fin de groupe (le groupe garde au moins un autre mot) : la suite de liaisons passe en tête du groupe suivant
 *    s'il la reçoit en entier (≤ 3 mots, ≤ 22 caractères), sinon — un seul mot de liaison — elle emporte les premiers
 *    mots du groupe suivant (le reste forme un groupe, jamais fait que de liaisons). Rien ne bouge si le dernier mot porte
 *    une ponctuation, s'il est suivi d'un blanc > 0,35 s, si le mot suivant est un mot long (seul par règle) ou si
 *    `peutRaccourcir` le refuse ;
 *  - groupe fait d'UN seul mot de liaison : il se rattache toujours, au suivant (premiers mots), sinon au précédent.
 * Un seul passage de gauche à droite (terminaison garantie).
 */
function rattacherLiaisons(gs: Jeton[][], peutRaccourcir: (g: Jeton[], w: Jeton) => boolean): void {
  const liaisons = (g: readonly Jeton[]) => {
    let r = 0;
    while (r < g.length && estMotLiaison(g[g.length - 1 - r].w)) r++;
    return r;
  };
  /** Tête = `run` + les k premiers mots de `suivant` (k maximal qui tient, le dernier n'étant pas une liaison si possible). */
  const decouper = (run: Jeton[], suivant: Jeton[]) => {
    let k = 0;
    while (k < suivant.length && tient([...run, ...suivant.slice(0, k + 1)])) k++;
    while (k > 1 && estMotLiaison(suivant[k - 1].w)) k--;
    const reste = suivant.slice(k);
    if (k === 0 || (reste.length && liaisons(reste) === reste.length)) return null;
    return { tete: [...run, ...suivant.slice(0, k)], reste };
  };
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i];
    const r = liaisons(g);
    if (r === 0) continue;
    const suivant = gs[i + 1];
    if (r === g.length) {
      // Groupe fait de liaisons : un seul mot se rattache toujours ; plusieurs (« et ce qui »), seulement s'ils tiennent
      // en entier avec le groupe suivant.
      const d = suivant ? (r === 1 ? decouper(g, suivant) : tient([...g, ...suivant]) ? { tete: [...g, ...suivant], reste: [] } : null) : null;
      if (d) gs.splice(i, 2, d.tete, ...(d.reste.length ? [d.reste] : []));
      else if (r === 1 && i > 0 && tient([...gs[i - 1], ...g])) {
        gs[i - 1].push(...g);
        gs.splice(i, 1);
        i--;
      }
      continue;
    }
    const w = g[g.length - 1];
    const run = g.slice(g.length - r);
    if (!suivant || w.coupe || nombreDeLettres(suivant[0].w) > LETTRES_MOT_SEUL || suivant[0].a - w.f > BLANC_COUPURE_SEC || !peutRaccourcir(g, run[0])) continue;
    const d = tient([...run, ...suivant]) ? { tete: [...run, ...suivant], reste: [] as Jeton[] } : r === 1 ? decouper(run, suivant) : null;
    if (!d) continue;
    g.splice(g.length - r, r);
    gs.splice(i + 1, 1, d.tete, ...(d.reste.length ? [d.reste] : []));
  }
}

/**
 * PETIT mot : mot de liaison ou mot-outil (« alors », « plus », « est », « pas », « je »…), jamais un nombre ni un mot
 * fort (plaque). Un groupe qui n'en contient que 1 ou 2 ne dit rien à l'écran (revue passe 3 : « ET CE » à 6 s,
 * « ALORS » à 50 s).
 */
export function estPetitMot(w: string, fort = false): boolean {
  if (fort) return false;
  const propre = nettoyer(w);
  if (!propre || /\d/.test(propre) || estNombreDit(propre)) return false;
  return estMotLiaison(propre) || estMotOutil(propre);
}

/** Groupe « vide de sens » : 1 ou 2 mots, tous petits. */
export const groupeDePetitsMots = (g: readonly { w: string; fort?: boolean }[]) => g.length >= 1 && g.length <= 2 && g.every((m) => estPetitMot(m.w, m.fort));

/** Au plus 4 mots (schéma du plan) quand un petit groupe est absorbé, et seulement si deux d'entre eux au moins sont petits. */
export const MOTS_PAR_GROUPE_ABSORPTION = 4;
const tientAbsorbe = (mots: readonly Jeton[]) =>
  tient(mots) ||
  (mots.length === MOTS_PAR_GROUPE_ABSORPTION && caracteresAffiches(mots) <= CARACTERES_PAR_GROUPE && mots.filter((m) => estPetitMot(m.w, m.fort)).length >= 2);
/** Mots qui OUVRENT une proposition : un petit groupe qui commence par eux va vers l'avant. */
const OUVRANTS = new Set(["et", "mais", "ou", "donc", "alors", "puis", "car", "or", "si", "quand", "comme", "ensuite", "enfin"]);
/** Fin de phrase (point, ? !, …) : on ne fond pas par-dessus. Une virgule (« Alors, ») ne compte pas. */
const finDePhrase = (j: Jeton) => j.coupe && /[.!?…]/.test(j.ponctuation ?? "");

/**
 * Absorbe les groupes faits de 1 ou 2 petits mots :
 *  - VERS L'AVANT (fondu avec le groupe suivant, sinon il lui emprunte ses premiers mots — dont un mot porteur, jamais
 *    en finissant sur un mot de liaison — sans laisser derrière un reste de petits mots ni un reste trop bref) :
 *    « Alors » + « on vous propose », « Et ce qui » + « suit » ;
 *  - VERS L'ARRIÈRE (fondu avec le précédent, sinon il prend ses derniers mots en lui laissant un mot porteur) :
 *    « un outil » + « de plus ».
 * L'arrière passe d'abord quand le petit groupe FERME une proposition (il porte une ponctuation, « de plus, »), que le
 * précédent n'en ferme pas et qu'il ne commence pas par un mot qui ouvre (« et », « alors »…) ; sinon l'avant d'abord. Jamais par-dessus une fin de phrase (. ? ! …) ni un blanc > 0,6 s.
 * Un groupe de 3 petits mots (« Et ce qui ») emprunte un 4ᵉ mot au suivant s'il le peut (« Et ce qui suit »).
 * Chaque fusion respecte 4 mots et 22 caractères ; un passage, terminaison garantie.
 */
function absorberPetitsGroupes(gs: Jeton[][], finDe: (gs: Jeton[][], i: number) => number): void {
  const blancMax = 0.6;
  const toutPetit = (g: readonly Jeton[]) => g.every((m) => estPetitMot(m.w, m.fort));
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i];
    const trois = g.length === MOTS_PAR_GROUPE && toutPetit(g);
    if (!groupeDePetitsMots(g) && !trois) continue;
    const suivant = gs[i + 1];
    const precedent = gs[i - 1];
    const dernier = g[g.length - 1];
    const finPrecedent = precedent?.[precedent.length - 1];
    const versSuivant = !!suivant && !finDePhrase(dernier) && suivant[0].a - dernier.f <= blancMax;
    const versPrecedent = !!precedent && !finDePhrase(finPrecedent!) && g[0].a - finPrecedent!.f <= blancMax;
    const avant = (): boolean => {
      if (!versSuivant) return false;
      if (tientAbsorbe([...g, ...suivant])) {
        gs.splice(i, 2, [...g, ...suivant]);
        return true;
      }
      let k = 0;
      while (k < suivant.length - 1 && tientAbsorbe([...g, ...suivant.slice(0, k + 1)])) k++;
      // Le mot emprunté ne laisse ni un reste fait de petits mots, ni un reste trop bref.
      // Ce qui est emprunté ne finit pas sur un mot de liaison et apporte un mot porteur (le but : donner du sens).
      const empruntValide = (n: number) =>
        !estMotLiaison(suivant[n - 1].w) && !toutPetit(suivant.slice(0, n)) && !groupeDePetitsMots(suivant.slice(n)) && !resteTropBref(gs, i, suivant.slice(n), finDe);
      while (k > 0 && !empruntValide(k)) k--;
      if (k === 0) return false;
      gs.splice(i, 2, [...g, ...suivant.slice(0, k)], suivant.slice(k));
      return true;
    };
    const arriere = (): boolean => {
      if (!versPrecedent || trois) return false;
      if (tientAbsorbe([...precedent, ...g])) {
        precedent.push(...g);
        gs.splice(i, 1);
        i--;
        return true;
      }
      for (let k = 1; k < precedent.length; k++) {
        const reste = precedent.slice(0, precedent.length - k);
        const pris = [...precedent.slice(precedent.length - k), ...g];
        if (!tientAbsorbe(pris)) return false;
        // Ce qui reste du précédent garde un mot porteur.
        if (toutPetit(reste)) continue;
        gs.splice(i - 1, 2, reste, pris);
        return true;
      }
      return false;
    };
    // « et lui, » / « Alors, » OUVRENT une proposition (vers l'avant) ; « de plus, » en FERME une (vers l'arrière).
    const ouvre = OUVRANTS.has(simplifier(g[0].w));
    const fermeUneProposition = !ouvre && dernier.coupe && !!finPrecedent && !finPrecedent.coupe;
    if (fermeUneProposition) arriere() || avant();
    else avant() || arriere();
  }
}

/* ---------------- Étiquette qui DOUBLE le sous-titre (revue passe 3) ---------------- */

/**
 * Forme comparable d'un mot pour le contrôle des doublons : minuscules sans accents ni élision ; un mot porteur perd
 * son pluriel et se compare sur 5 lettres (« former » = « forme ») ; un nombre garde ses chiffres.
 */
function cleDoublon(w: string): string | null {
  const propre = nettoyer(w);
  if (!propre) return null;
  if (/\d/.test(propre)) return propre.replace(",", ".");
  const n = simplifier(sansElision(propre)) || simplifier(propre);
  if (estMotOutil(propre) || estMotLiaison(propre)) return n;
  return n.replace(/(s|x)$/, "").slice(0, 5);
}
const clesDoublon = (texte: string) =>
  texte
    .split(/[\s.,;:!?…«»"“”()/·]+/)
    .map(cleDoublon)
    .filter((x): x is string => !!x);

/** Une étiquette de 2 mots ou plus peut doubler le sous-titre ; un mot seul est le NOM de la chose (mot-clé), permis. */
export const MOTS_MIN_DOUBLON = 2;

/**
 * Le sous-titre affiché pendant [debut ; fin] répète-t-il MOT POUR MOT l'étiquette ? Vrai quand TOUS les mots de
 * l'étiquette (2 au moins, petits mots compris) se suivent, dans le même ordre, dans les groupes à l'écran pendant
 * l'étiquette : « Une fuite » sur « Vous avez une fuite », « Son week-end », « Leur après-midi », « Former les
 * équipes » sur « on forme les équipes ». « Devis le soir » sur « le soir, vous tapez les devis » ne double pas (ordre
 * différent) ; « Miracle » (un mot-clé seul) non plus. Rend le bout de sous-titre doublé, ou null.
 */
export function etiquetteDoubleSousTitre(texte: string, debut: number, fin: number, groupes: readonly GroupeSousTitrePlan[]): string | null {
  const cles = clesDoublon(texte);
  if (cles.length < MOTS_MIN_DOUBLON) return null;
  const affiches = groupes.filter((g) => g.mots[0].a < fin - 1e-6 && g.fin > debut + 1e-6).flatMap((g) => g.mots);
  const sequence = affiches.flatMap((m) => m.w.split(/\s+/)).map((w) => ({ c: cleDoublon(w), w })).filter((x) => x.c);
  for (let i = 0; i + cles.length <= sequence.length; i++) {
    if (cles.every((c, k) => sequence[i + k].c === c)) return sequence.slice(i, i + cles.length).map((x) => x.w).join(" ");
  }
  return null;
}

/** Vrai si `reste` (qui remplacerait le groupe i + 1) serait affiché moins de 0,18 s. */
function resteTropBref(gs: Jeton[][], i: number, reste: Jeton[], finDe: (gs: Jeton[][], i: number) => number): boolean {
  if (!reste.length) return true;
  const essai = [...gs.slice(0, i + 1), reste, ...gs.slice(i + 2)];
  return finDe(essai, i + 1) - reste[0].a < DUREE_MIN_GROUPE_SEC - 1e-9;
}

const arrondi = (x: number) => Math.round(x * 1000) / 1000;
