/**
 * NOMBRES DITS EN FRANÇAIS (générateur, plan v5 B.7.2 C1, lot G3). PUR : importable côté client.
 *
 * Repère tous les nombres d'un texte, écrits en chiffres OU en lettres, pour que C1 (« chaque nombre a sa preuve ») ne
 * laisse rien passer : « 35 h », « trente-cinq heures », « une PME sur deux », « trois quarts », « la moitié »,
 * « deux fois plus », « x3 », « 10x », « 1,5 million », « 67 k€ », « 2 M€ », années, « 7j/7 ». Une liste blanche
 * (« GPT-5 », « 24 h/24 ») et les numéros de liste (« 1. », « Deuxième point ») sont reconnus à part : ils ne demandent
 * pas de preuve. Rien n'est réécrit ; on ne fait que lire.
 */

export type FormeNombre = "chiffres" | "lettres" | "fraction" | "multiplicateur" | "annee" | "liste" | "liste-blanche";

export interface NombreTrouve {
  /** Le texte tel qu'il est écrit (« trente-cinq heures », « 1,5 million »). */
  brut: string;
  /** Valeur numérique normalisée (« une sur deux » → 0,5 ; « 1,5 million » → 1 500 000 ; « 67 k€ » → 67 000). */
  valeur: number;
  unite?: string;
  forme: FormeNombre;
  debut: number;
  fin: number;
}

/** Expressions qui contiennent un nombre sans être une affirmation chiffrée (C1, liste blanche). */
export const LISTE_BLANCHE_NOMBRES: readonly string[] = [
  "GPT-3", "GPT-4", "GPT-4o", "GPT-5", "Claude 3", "Claude 4", "Web 2.0", "Web 3", "24 h/24", "24h/24", "24 heures sur 24", "7j/7", "7 j/7", "7 jours sur 7", "365 jours par an", "Covid-19", "B2B", "B2C", "Q1", "Q2", "Q3", "Q4",
];

const UNITES: Record<string, string> = {
  "%": "%", pourcent: "%", "pour cent": "%", "€": "€", euro: "€", euros: "€", "k€": "€", "m€": "€", "keur": "€",
  h: "h", heure: "h", heures: "h", min: "min", minute: "min", minutes: "min", s: "s", seconde: "s", secondes: "s",
  jour: "jour", jours: "jour", j: "jour", semaine: "semaine", semaines: "semaine", mois: "mois", an: "an", ans: "an", annee: "an", annees: "an",
  point: "point", points: "point", onglet: "onglet", onglets: "onglet", client: "client", clients: "client", salarie: "salarie", salaries: "salarie",
};

const UNITES_SIMPLES: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};
const MULTIPLES: Record<string, number> = { cent: 100, cents: 100, mille: 1000, milles: 1000, million: 1e6, millions: 1e6, milliard: 1e9, milliards: 1e9 };
const FRACTIONS: Record<string, number> = { demi: 2, deux: 2, trois: 3, tiers: 3, quatre: 4, quart: 4, quarts: 4, cinq: 5, cinquieme: 5, cinquiemes: 5, dix: 10, dixieme: 10, dixiemes: 10 };
const ORDINAUX_LISTE = /^(premier|premiere|deuxieme|second|seconde|troisieme|quatrieme|cinquieme|sixieme|septieme|huitieme|neuvieme|dixieme)$/;

function sansAccents(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Mot normalisé (minuscules, sans accents, apostrophes droites). */
function norm(m: string): string {
  return sansAccents(m.toLowerCase().replace(/[’`]/g, "'"));
}

/**
 * Lit un nombre écrit en lettres (« trente-cinq », « quatre-vingt-dix », « deux cent mille », « mille deux cents »).
 * Renvoie null si l'expression n'est pas un nombre complet.
 */
export function lireNombreEnLettres(expression: string): number | null {
  const mots = norm(expression)
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((m) => m && m !== "et");
  if (!mots.length) return null;
  let total = 0;
  let courant = 0;
  let vu = false;
  for (let i = 0; i < mots.length; i++) {
    const m = mots[i];
    if (m === "quatre" && (mots[i + 1] === "vingt" || mots[i + 1] === "vingts")) {
      courant += 80;
      i++;
      vu = true;
      continue;
    }
    if (m in UNITES_SIMPLES) {
      const v = UNITES_SIMPLES[m];
      // « soixante-dix », « quatre-vingt-dix » : la dizaine s'ajoute.
      courant += v;
      vu = true;
      continue;
    }
    if (m in MULTIPLES) {
      const mult = MULTIPLES[m];
      vu = true;
      if (mult === 100) courant = (courant || 1) * 100;
      else {
        total += (courant || 1) * mult;
        courant = 0;
      }
      continue;
    }
    return null;
  }
  return vu ? total + courant : null;
}

const MOT_NOMBRE = "(?:z[ée]ro|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|quarante|cinquante|soixante|cents?|mille|millions?|milliards?)";
const SUITE_LETTRES = new RegExp(`(?<![\\p{L}\\p{N}])${MOT_NOMBRE}(?:(?:[- ]|\\s+et\\s+)${MOT_NOMBRE})*(?![\\p{L}\\p{N}])`, "giu");
const APRES_UNITE = /^\s*(%|pour ?cent|€|euros?|k€|m€|keur|heures?|h\b|minutes?|min\b|secondes?|s\b|jours?|j\b|semaines?|mois|ans?\b|ann[ée]es?|points?|onglets?|clients?|salari[ée]s?)/i;

interface Zone {
  debut: number;
  fin: number;
}

function chevauche(z: Zone, zones: Zone[]): boolean {
  return zones.some((x) => z.debut < x.fin && x.debut < z.fin);
}

function uniteApres(texte: string, fin: number): { unite?: string; longueur: number } {
  const m = APRES_UNITE.exec(texte.slice(fin));
  if (!m) return { longueur: 0 };
  const cle = norm(m[1]).replace(/\s+/g, " ");
  return { unite: UNITES[cle] ?? UNITES[cle.replace(/s$/, "")] ?? cle, longueur: m[0].length };
}

/**
 * Tous les nombres d'un texte, dans l'ordre. Un article (« un client », « une PME ») n'est PAS un nombre ; « un »
 * ne compte que dans une fraction (« une PME sur deux ») ou un composé (« vingt et un »).
 */
export function trouverNombres(texte: string, options: { listeBlanche?: readonly string[] } = {}): NombreTrouve[] {
  const trouves: NombreTrouve[] = [];
  const prises: Zone[] = [];
  const ajouter = (n: NombreTrouve) => {
    if (chevauche(n, prises)) return;
    prises.push({ debut: n.debut, fin: n.fin });
    trouves.push(n);
  };
  const minuscule = texte.toLowerCase();

  // 1. Liste blanche.
  for (const blanc of options.listeBlanche ?? LISTE_BLANCHE_NOMBRES) {
    let i = minuscule.indexOf(blanc.toLowerCase());
    while (i >= 0) {
      ajouter({ brut: texte.slice(i, i + blanc.length), valeur: NaN, forme: "liste-blanche", debut: i, fin: i + blanc.length });
      i = minuscule.indexOf(blanc.toLowerCase(), i + blanc.length);
    }
  }

  // 2. Numéros de liste : « 1. », « 2) » en tête de phrase ; ordinaux « Premier point », « Deuxième, … ».
  for (const m of texte.matchAll(/(?:^|[.!?:]\s+|\n)\s*(\d{1,2})\s*[.)](?=\s)/g)) {
    const d = m.index! + m[0].indexOf(m[1]);
    ajouter({ brut: m[1], valeur: Number(m[1]), forme: "liste", debut: d, fin: d + m[1].length });
  }
  for (const m of texte.matchAll(/(?<![\p{L}])(premi[eè]re?|deuxi[eè]me|second(?:e)?|troisi[eè]me|quatri[eè]me|cinqui[eè]me|sixi[eè]me|septi[eè]me|huiti[eè]me|neuvi[eè]me|dixi[eè]me)(?![\p{L}])/giu)) {
    if (ORDINAUX_LISTE.test(norm(m[1]))) ajouter({ brut: m[1], valeur: NaN, forme: "liste", debut: m.index!, fin: m.index! + m[1].length });
  }

  // 3. Fractions dites : « une PME sur deux », « un sur trois », « trois quarts », « la moitié », « un tiers ».
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}])(un|une|deux|trois|quatre|\d+)\s+(?:[\p{L}'’-]+\s+){0,3}?sur\s+(deux|trois|quatre|cinq|dix|\d+)(?![\p{L}\p{N}])/giu)) {
    const num = /^\d+$/.test(m[1]) ? Number(m[1]) : (lireNombreEnLettres(m[1]) ?? NaN);
    const den = /^\d+$/.test(m[2]) ? Number(m[2]) : (lireNombreEnLettres(m[2]) ?? NaN);
    if (den > 0) ajouter({ brut: m[0], valeur: num / den, forme: "fraction", debut: m.index!, fin: m.index! + m[0].length });
  }
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}])(un|une|deux|trois)\s+(demi|tiers|quarts?|cinqui[eè]mes?|dixi[eè]mes?)(?![\p{L}\p{N}])/giu)) {
    const num = lireNombreEnLettres(m[1]) ?? 1;
    const den = FRACTIONS[norm(m[2])] ?? NaN;
    ajouter({ brut: m[0], valeur: num / den, forme: "fraction", debut: m.index!, fin: m.index! + m[0].length });
  }
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}])(la|une)\s+moiti[ée](?![\p{L}\p{N}])/giu)) {
    ajouter({ brut: m[0], valeur: 0.5, forme: "fraction", debut: m.index!, fin: m.index! + m[0].length });
  }

  // 4. Multiplicateurs : « x3 », « ×3 », « 10x », « deux fois plus », « 3 fois moins ».
  for (const m of texte.matchAll(/(?<![\p{L}\p{N}])[x×]\s?(\d+(?:[.,]\d+)?)(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)\s?[x×](?![\p{L}\p{N}])/giu)) {
    const v = Number((m[1] ?? m[2]).replace(",", "."));
    ajouter({ brut: m[0], valeur: v, unite: "x", forme: "multiplicateur", debut: m.index!, fin: m.index! + m[0].length });
  }
  for (const m of texte.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])(\\d+(?:[.,]\\d+)?|${MOT_NOMBRE}(?:[- ]${MOT_NOMBRE})*)\\s+fois\\s+(plus|moins)(?![\\p{L}\\p{N}])`, "giu"))) {
    const v = /^\d/.test(m[1]) ? Number(m[1].replace(",", ".")) : lireNombreEnLettres(m[1]);
    if (v !== null) ajouter({ brut: m[0], valeur: v, unite: "x", forme: "multiplicateur", debut: m.index!, fin: m.index! + m[0].length });
  }

  // 5. Chiffres : « 67 000 », « 1,5 million », « 35 h », « 12 % », « 67 k€ », « 2 M€ », années.
  for (const m of texte.matchAll(/(?<![\p{L}\p{N},.])(\d{1,3}(?:[  ]\d{3})+|\d+(?:[.,]\d+)?)(?:\s?(millions?|milliards?|mille))?(?:\s?([kKmM])€)?/gu)) {
    const brutNombre = m[1].replace(/[  ]/g, "");
    let valeur = Number(brutNombre.replace(",", "."));
    if (m[2]) valeur *= MULTIPLES[norm(m[2])];
    if (m[3]) valeur *= /k/i.test(m[3]) ? 1000 : 1e6;
    const fin = m.index! + m[0].length;
    const u = m[3] ? { unite: "€", longueur: 0 } : uniteApres(texte, fin);
    const annee = !m[2] && !m[3] && !u.unite && /^(19|20)\d{2}$/.test(brutNombre);
    ajouter({ brut: texte.slice(m.index!, fin + u.longueur).trim(), valeur, unite: u.unite, forme: annee ? "annee" : "chiffres", debut: m.index!, fin: fin + u.longueur });
  }

  // 6. Nombres en lettres (« trente-cinq heures », « deux cent mille euros », « zéro heure »).
  for (const m of texte.matchAll(SUITE_LETTRES)) {
    const n = norm(m[0]);
    if (/^(un|une)$/.test(n)) continue; // article
    const valeur = lireNombreEnLettres(m[0]);
    if (valeur === null) continue;
    const fin = m.index! + m[0].length;
    const u = uniteApres(texte, fin);
    ajouter({ brut: texte.slice(m.index!, fin + u.longueur).trim(), valeur, unite: u.unite, forme: "lettres", debut: m.index!, fin: fin + u.longueur });
  }

  return trouves.sort((a, b) => a.debut - b.debut);
}

/** Les nombres qui demandent une preuve (ni liste, ni liste blanche). */
export function nombresAffirmes(texte: string, options: { listeBlanche?: readonly string[] } = {}): NombreTrouve[] {
  return trouverNombres(texte, options).filter((n) => n.forme !== "liste" && n.forme !== "liste-blanche");
}

/** Deux valeurs sont-elles la même (tolérance relative de 0,1 %) ? */
export function memeValeur(a: number, b: number): boolean {
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  if (a === b) return true;
  return Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-3;
}

/** Nombre de nombres affirmés dans un texte (C41 : `nombresMaxAccroche`). */
export function compterNombres(texte: string): number {
  return nombresAffirmes(texte).length;
}
