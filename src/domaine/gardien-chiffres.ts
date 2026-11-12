/**
 * GARDIEN DES CHIFFRES CLÉS — partie pure (fiche KB-04). Ni réseau, ni base, ni horloge, ni IA.
 *
 * Quatre chiffres clés, désignés par leur LIBELLÉ seulement (aucun montant écrit ici). Pour chacun : la requête de
 * recherche, les mots qu'une phrase doit contenir pour parler de cette donnée, et l'unité attendue.
 * `extraireValeur` lit une valeur normalisée dans un texte ; `comparer` dit « accord », « écart » ou « non comparé » ;
 * `phraseEcart` écrit la phrase de la cloche (jamais un chiffre ni une monnaie).
 */
import { createHash } from "node:crypto";
import type { Preuve } from "./types";

export type DimensionChiffre = "duree" | "jours" | "prix";
export type SourceChiffre = "site" | "preuve" | "usine";
export type Verdict = "accord" | "ecart" | "non-compare";

export interface ChiffreCle {
  code: string;
  /** Groupe nominal, utilisable après « sur » (« Écart sur la garantie… »). */
  libelle: string;
  /** Recherche envoyée à la porte du site. */
  requete: string;
  /** Mots (sans accent, en minuscules) que la phrase doit tous contenir. */
  mots: string[];
  dimension: DimensionChiffre;
}

export const CHIFFRES_CLES: readonly ChiffreCle[] = [
  { code: "prix-journee", libelle: "le prix de la Journée IA", requete: "prix journée IA", mots: ["journee"], dimension: "prix" },
  { code: "duree-journee", libelle: "la durée de la Journée IA", requete: "durée journée IA", mots: ["journee"], dimension: "duree" },
  { code: "duree-rdv", libelle: "la durée du rendez-vous gratuit", requete: "durée rendez-vous gratuit", mots: ["rendez-vous"], dimension: "duree" },
  { code: "garantie", libelle: "la garantie", requete: "garantie", mots: ["garantie"], dimension: "jours" },
];

export const TITRE_NOTIFICATION_GARDIEN = "Gardien des chiffres";
/** Paramètre qui garde l'empreinte de chaque écart déjà signalé (donnée → empreinte). Jamais affiché. */
export const REGLAGE_EMPREINTES = "gardien.chiffres.empreintes";
export const REGLAGE_DERNIER_CONTROLE = "gardien.chiffres.dernier";

const NOMS_SOURCES: Record<SourceChiffre, string> = { site: "le site", preuve: "une preuve du Studio", usine: "la base de l'usine" };
const ORDRE_SOURCES: readonly SourceChiffre[] = ["site", "preuve", "usine"];

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

/** Minuscules, sans accent, espaces insécables remplacés. */
export function normaliserTexte(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[  ]/g, " ")
    .toLowerCase();
}

const arrondir = (n: number): number => Math.round(n * 100) / 100;
const SYMBOLE_EURO = "€";

const NB = String.raw`\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;
const versNombre = (s: string): number => Number(s.replace(/ /g, "").replace(",", "."));

/** « 1h30 », « 1 heure 30 » (deux chiffres), « 2 h », « 1,5 heures », « 45 min ». Résultat en minutes. */
const RE_DUREE = new RegExp(String.raw`(\d+) ?(?:h|heures?) ?(\d{2})(?!\d)(?: ?min[a-z]*)?|(${NB}) ?(?:h|heures?)(?![a-z])|(${NB}) ?(?:minutes?|mins?)(?![a-z])`, "g");
/** Jours, semaines, mois, ans — en jours. */
const RE_JOURS = new RegExp(String.raw`(${NB}) ?(jours?|j|semaines?|mois|ans?|annees?)(?![a-z])`, "g");
/** Nombre puis devise (avec « k » possible), ou devise puis nombre. Sur le texte déjà normalisé. */
const DEVISE = String.raw`(?:${SYMBOLE_EURO}|\$|euros?(?![a-z])|eur(?![a-z])|dollars?(?![a-z])|usd(?![a-z]))`;
const RE_PRIX = new RegExp(String.raw`(${NB}) ?(k)? ?${DEVISE}|(?:${SYMBOLE_EURO}|\$) ?(${NB})`, "g");

const FACTEUR_JOURS: Record<string, number> = { j: 1, jour: 1, jours: 1, semaine: 7, semaines: 7, mois: 30, an: 365, ans: 365, annee: 365, annees: 365 };

/** Valeurs d'une phrase pour une dimension, en unité de base (minutes, jours, euros). */
function valeursDePhrase(phrase: string, dimension: DimensionChiffre): number[] {
  const sortie: number[] = [];
  if (dimension === "duree") {
    for (const m of phrase.matchAll(RE_DUREE)) {
      if (m[1] !== undefined) sortie.push(Number(m[1]) * 60 + Number(m[2]));
      else if (m[3] !== undefined) sortie.push(versNombre(m[3]) * 60);
      else if (m[4] !== undefined) sortie.push(versNombre(m[4]));
    }
  } else if (dimension === "jours") {
    for (const m of phrase.matchAll(RE_JOURS)) sortie.push(versNombre(m[1]) * (FACTEUR_JOURS[m[2]] ?? 1));
  } else {
    for (const m of phrase.matchAll(RE_PRIX)) {
      if (m[1] !== undefined) sortie.push(versNombre(m[1]) * (m[2] ? 1000 : 1));
      else if (m[3] !== undefined) sortie.push(versNombre(m[3]));
    }
  }
  return sortie.filter((n) => Number.isFinite(n) && n >= 0).map(arrondir);
}

/** Une seule valeur distincte → elle ; aucune ou plusieurs différentes (ambigu) → null. */
export function valeurUnique(valeurs: readonly number[]): number | null {
  const u = [...new Set(valeurs.map(arrondir))];
  return u.length === 1 ? u[0] : null;
}

function phrasesDe(texte: string): string[] {
  return normaliserTexte(texte)
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const parleDe = (phrase: string, cle: ChiffreCle): boolean => cle.mots.every((m) => phrase.includes(m));

/** Valeurs d'un texte, dans les seules phrases qui parlent de la donnée. */
export function valeursDuTexte(texte: string, cle: ChiffreCle): number[] {
  return phrasesDe(texte)
    .filter((p) => parleDe(p, cle))
    .flatMap((p) => valeursDePhrase(p, cle.dimension));
}

/** Valeur normalisée de la donnée dans un texte (extrait du site, énoncé d'une preuve) ; null si absente ou ambiguë. */
export function extraireValeur(texte: string, cle: ChiffreCle): number | null {
  return valeurUnique(valeursDuTexte(texte, cle));
}

/** Extrait d'un fait du site : titre et extrait forment un seul texte (« Titre : extrait »). */
export function valeurDuFaitSite(f: { title: string; excerpt: string }, cle: ChiffreCle): number[] {
  return valeursDuTexte(`${f.title} : ${f.excerpt}`, cle);
}

/* ------------------------------------------------------------------ */
/* Preuves du Studio                                                   */
/* ------------------------------------------------------------------ */

/** Preuve utilisable pour le contrôle : validée, ni archivée, ni retirée, ni périmée. */
export function preuveComptable(p: Preuve, maintenantMs: number): boolean {
  if (p.statut !== "validee" || p.archiveLe || p.retrait) return false;
  if (p.perimeLe) {
    const fin = Date.parse(p.perimeLe);
    if (Number.isFinite(fin) && fin <= maintenantMs) return false;
  }
  return true;
}

const UNITES_PREUVE: Record<DimensionChiffre, Record<string, number>> = {
  duree: { min: 1, mn: 1, minute: 1, minutes: 1, h: 60, heure: 60, heures: 60 },
  jours: { j: 1, jour: 1, jours: 1, semaine: 7, semaines: 7, mois: 30, an: 365, ans: 365 },
  prix: { eur: 1, euro: 1, euros: 1, [SYMBOLE_EURO]: 1 },
};

/** Valeurs d'UNE preuve pour la donnée ; vide si elle n'en parle pas. L'énoncé fait foi, les valeurs enregistrées complètent. */
export function valeursDePreuve(p: Preuve, cle: ChiffreCle): number[] {
  const sujet = normaliserTexte(`${p.enonce} ${(p.motsCles ?? []).join(" ")}`);
  if (!cle.mots.every((m) => sujet.includes(m))) return [];
  const depuisEnonce = valeursDuTexte(p.enonce, cle);
  if (depuisEnonce.length) return depuisEnonce;
  const table = UNITES_PREUVE[cle.dimension];
  const sortie: number[] = [];
  for (const v of p.valeurs ?? []) {
    const facteur = table[normaliserTexte(v.unite ?? "").trim()];
    if (facteur !== undefined && Number.isFinite(v.normalise)) sortie.push(arrondir(v.normalise * facteur));
  }
  return sortie;
}

/** Côté Studio : toutes les preuves comptables, une valeur si elles s'accordent entre elles, sinon null. */
export function valeurDesPreuves(preuves: readonly Preuve[], cle: ChiffreCle, maintenantMs: number): number | null {
  return valeurUnique(preuves.filter((p) => preuveComptable(p, maintenantMs)).flatMap((p) => valeursDePreuve(p, cle)));
}

/* ------------------------------------------------------------------ */
/* Comparaison, phrase, empreinte                                      */
/* ------------------------------------------------------------------ */

export type ValeursParSource = Record<SourceChiffre, number | null>;

/** Accord (toutes les sources présentes disent pareil), écart, ou non comparé (moins de deux sources). */
export function comparer(v: Partial<ValeursParSource>): { verdict: Verdict; sources: SourceChiffre[] } {
  const presentes = ORDRE_SOURCES.filter((s) => typeof v[s] === "number" && Number.isFinite(v[s] as number));
  if (presentes.length < 2) return { verdict: "non-compare", sources: presentes };
  const distinctes = new Set(presentes.map((s) => arrondir(v[s] as number)));
  return { verdict: distinctes.size === 1 ? "accord" : "ecart", sources: presentes };
}

/** « Écart sur la durée du rendez-vous gratuit entre le site et une preuve du Studio » — sans chiffre ni monnaie. */
export function phraseEcart(cle: ChiffreCle, sources: readonly SourceChiffre[]): string {
  const noms = ORDRE_SOURCES.filter((s) => sources.includes(s)).map((s) => NOMS_SOURCES[s]);
  const liste = noms.length <= 2 ? noms.join(" et ") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
  return `Écart sur ${cle.libelle} entre ${liste}`;
}

/** Empreinte stable d'un écart (donnée + valeurs par source), écrite en lettres seulement. Ne se montre jamais. */
export function empreinteEcart(code: string, v: Partial<ValeursParSource>): string {
  const trace = [code, ...ORDRE_SOURCES.map((s) => `${s}=${typeof v[s] === "number" ? arrondir(v[s] as number) : "-"}`)].join("|");
  const hex = createHash("sha256").update(trace).digest("hex").slice(0, 16);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}
