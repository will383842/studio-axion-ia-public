/**
 * OUTILS DE LANGUE du réalisateur (lot C) — PURS, sans dépendance.
 *
 * Les mots horodatés de la transcription (`{ w, a, f }`, secondes sur la vidéo MONTÉE), nettoyés de leur ponctuation ;
 * les mots-outils (articles, pronoms, auxiliaires…) ; les nombres DITS (chiffres et nombres en lettres, ordinaux
 * compris) ; les textes INTERDITS d'Axion-IA. Partagés par les sous-titres, les contrôles et les règles fixes.
 */

/** Un mot de la transcription : texte brut (avec sa ponctuation), début `a` et fin `f` en secondes. */
export interface MotTranscrit {
  w: string;
  a: number;
  f: number;
}

const BORDS = /^[\s.,;:!?…«»"“”()[\]—–-]+|[\s.,;:!?…«»"“”()[\]—–-]+$/g;

/** Le mot sans sa ponctuation de bord (« fuite. » → « fuite », « ? » → « »). */
export function nettoyer(w: string): string {
  return w.replace(BORDS, "");
}

/** Ponctuation finale d'un mot brut (« fuite. » → « . », « Un : » → « : »), ou null. */
export function ponctuationFinale(w: string): string | null {
  const m = /([.,;:!?…])[\s»"”)]*$/.exec(w);
  return m ? m[1] : null;
}

/** Minuscules sans accents (comparaisons). */
export function simplifier(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Retire l'élision de tête (« l'IA » → « IA », « qu'est-ce » → « est-ce »). */
export function sansElision(w: string): string {
  // Apostrophe de tête restée seule : la transcription coupe « l'administratif » en « l » + « 'administratif. » (essai réel du 18/10 : « administratif » jugé non dit, plan refusé 3 fois).
  return w.replace(/^(jusqu|lorsqu|puisqu|qu|l|d|n|s|c|j|m|t)['’]/i, "").replace(/^['’]+/, "");
}

/**
 * Recolle les élisions coupées par la transcription (« l » + « 'IA » → « l'IA »), pour que les sous-titres n'affichent jamais
 * une apostrophe de tête (vidéo v-e5d262bd9da5). Le mot recollé garde le début du premier et la fin du second ; sans mot précédent
 * (ou après une ponctuation), l'apostrophe de tête est simplement retirée.
 */
export function recollerElisions(mots: readonly MotTranscrit[]): MotTranscrit[] {
  const sortie: MotTranscrit[] = [];
  for (const m of mots) {
    if (!/^['’]/.test(m.w)) {
      sortie.push({ ...m });
      continue;
    }
    const prec = sortie[sortie.length - 1];
    if (prec && ponctuationFinale(prec.w) === null) sortie[sortie.length - 1] = { w: prec.w + m.w, a: prec.a, f: m.f };
    else sortie.push({ ...m, w: m.w.replace(/^['’]+/, "") });
  }
  return sortie;
}

/** Mots-outils : jamais un sous-élément, jamais un mot fort (forme simplifiée, sans élision). */
const MOTS_OUTILS = new Set(
  (
    "le la les un une des de du au aux a à en et ou mais que qui quoi ce cet cette ces se sa son ses leur leurs vos votre notre nos mon ma mes ton ta tes " +
    "il elle ils elles on je tu nous vous lui eux y ne pas plus moins est sont ai as avez avons ont ete etre avoir fait fais faire font sur sous dans par pour avec sans chez " +
    "entre vers si alors donc car comme tout tous toute toutes tres trop bien meme aussi encore deja peut peux peuvent quand ou dont puis la ca cela ceci " +
    "voici voila chaque autre autres quel quelle quels quelles quelque quelques celui celle ceux celles ici oui non va vais vont aller fois rien " +
    "elle-meme est-ce c'est n'est qu'a d'un d'une l'on moi toi soi veut veux vraie vrai juste lors avez-vous peut-etre est-il sommes etes suis etait"
  ).split(/\s+/),
);

/** Vrai pour un mot-outil (ou un mot vide après nettoyage). */
export function estMotOutil(w: string): boolean {
  const n = simplifier(sansElision(nettoyer(w)));
  if (!n) return true;
  if (/\d/.test(n)) return false;
  return MOTS_OUTILS.has(n) || MOTS_OUTILS.has(simplifier(nettoyer(w))) || n.length < 2;
}

/* ---------------- Nombres ---------------- */

const NOMBRES_LETTRES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  cent: 100, cents: 100, mille: 1000,
  premier: 1, premiere: 1, second: 2, seconde: 2, deuxieme: 2, troisieme: 3, quatrieme: 4, cinquieme: 5, sixieme: 6, septieme: 7,
  huitieme: 8, neuvieme: 9, dixieme: 10,
};

const MULTIPLICATEURS: Record<string, number> = { mille: 1000, million: 1_000_000, millions: 1_000_000, milliard: 1_000_000_000, milliards: 1_000_000_000 };

/** Valeur d'un nombre écrit en lettres (« quarante-cinq » → 45, « troisième » → 3), ou null. */
export function valeurEnLettres(w: string): number | null {
  const n = simplifier(nettoyer(w));
  if (!n) return null;
  if (NOMBRES_LETTRES[n] !== undefined) return NOMBRES_LETTRES[n];
  const parts = n.split("-").filter((p) => p && p !== "et");
  if (parts.length < 2 || parts.some((p) => NOMBRES_LETTRES[p] === undefined)) return null;
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const v = NOMBRES_LETTRES[parts[i]];
    if (parts[i] === "quatre" && (parts[i + 1] === "vingt" || parts[i + 1] === "vingts")) {
      total += 80;
      i++;
    } else if (v === 100) total = (total || 1) * 100;
    else total += v;
  }
  return total;
}

/** Vrai pour un nombre DIT (« 45 », « 2,5 », « deux », « troisième »), hors article « un / une ». */
export function estNombreDit(w: string): boolean {
  const propre = nettoyer(w);
  if (!propre) return false;
  if (/^\d+(?:[.,]\d+)?$/.test(propre)) return true;
  const s = simplifier(propre);
  return s !== "un" && s !== "une" && valeurEnLettres(propre) !== null;
}

/** Unités qui restent collées à leur nombre sur la même plaque (« 39 minutes », « 2 millions », « 30 % »). */
const UNITES = new Set(
  (
    "% pourcent min minute minutes sec seconde secondes h heure heures jour jours semaine semaines mois an ans annee annees " +
    "€ euro euros k€ ke centimes million millions milliard milliards mille fois points clients salaries personnes"
  ).split(/\s+/),
);

/** Vrai pour une unité (forme simplifiée, sans ponctuation de bord). */
export function estUnite(w: string): boolean {
  return UNITES.has(simplifier(nettoyer(w)));
}

/** Nombre de lettres et de chiffres d'un mot (sans apostrophes, traits d'union ni ponctuation). */
export function nombreDeLettres(w: string): number {
  return (w.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

/** Nombres écrits en chiffres dans un texte (« 45 min », « 2,5 h » → [45, 2.5]). */
export function nombresDansTexte(texte: string): number[] {
  return [...texte.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
}

/**
 * Tous les nombres DITS dans la transcription : chiffres, nombres en lettres et ordinaux, et les produits avec
 * « mille / million(s) / milliard(s) » (« 2 millions » → 2 et 2 000 000).
 */
export function nombresDits(mots: readonly MotTranscrit[]): Set<number> {
  const dits = new Set<number>();
  let precedent: number | null = null;
  for (const m of mots) {
    const chiffres = nombresDansTexte(m.w);
    const lettres = valeurEnLettres(m.w);
    const mult = MULTIPLICATEURS[simplifier(nettoyer(m.w))];
    if (mult && precedent !== null) dits.add(precedent * mult);
    chiffres.forEach((n) => dits.add(n));
    if (lettres !== null) dits.add(lettres);
    precedent = chiffres.length ? chiffres[chiffres.length - 1] : lettres;
  }
  return dits;
}

/* ---------------- Textes interdits (règles d'Axion-IA) ---------------- */

const INTERDITS: { nom: string; motif: RegExp }[] = [
  { nom: "Villeexemple", motif: /villeexemple/ },
  { nom: "gain garanti", motif: /gains?\s+garantis?/ },
  // Décision de Will du 17/10 : « Certifexemple » (toutes casses, avec ou sans apostrophe : « à Certifexemple », « CERTIFEXEMPLE ») n'apparaît JAMAIS à l'écran.
  { nom: "Certifexemple", motif: /certifexemple/ },
  { nom: "certifié / certification", motif: /\bcertifi(?:e|ee|es|ees|s|cation|cations)?\b|\bcertifier\b/ },
];

/** Les textes interdits présents dans `texte` (comparaison sans accents ni casse). */
export function motsInterditsDans(texte: string): string[] {
  const s = simplifier(texte);
  return INTERDITS.filter((x) => x.motif.test(s)).map((x) => x.nom);
}

/**
 * Indices des mots DITS à ne jamais afficher dans les sous-titres (liste de mots interdits à l'écran) : un mot interdit en lui-même
 * (« Certifexemple », « certifié », « Villeexemple »…) ou une expression interdite sur deux mots consécutifs (« gain garanti »).
 */
export function indicesMotsInterditsEcran(mots: readonly { w: string }[]): Set<number> {
  const bannis = new Set<number>();
  mots.forEach((m, k) => {
    if (motsInterditsDans(m.w).length) { bannis.add(k); return; }
    const suivant = mots[k + 1];
    // Expression de deux mots (« gain garanti ») : seulement si aucun des deux n'est interdit seul (sinon « à » serait banni avec « Certifexemple »).
    if (suivant && !motsInterditsDans(suivant.w).length && motsInterditsDans(`${m.w} ${suivant.w}`).length) { bannis.add(k); bannis.add(k + 1); }
  });
  return bannis;
}

/** Les mots sans ceux qu'il est interdit d'afficher : le groupe de sous-titres « saute » le mot (les autres gardent leurs instants, aucun décalage). */
export function sansMotsInterditsEcran<T extends { w: string }>(mots: readonly T[]): T[] {
  const bannis = indicesMotsInterditsEcran(mots);
  return bannis.size ? mots.filter((_, k) => !bannis.has(k)) : [...mots];
}

/** Majuscule initiale (les textes affichés sont en majuscules naturelles, jamais tout en capitales). */
export function majuscule(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1) : s;
}
