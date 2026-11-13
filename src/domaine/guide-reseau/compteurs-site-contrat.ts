/**
 * SUI-A — contrat PUR de lecture des compteurs du site : POST /api/interne/compteurs-guide-reseau, corps { v: 1 }.
 * 404 et 503 = site indisponible (traité par le service, comme tout statut autre que 200).
 * Aucun import serveur, aucun réseau. Lecture STRICTE : le moindre nombre non entier (ou hors entiers sûrs) ou négatif,
 * une fenêtre où j7 ≤ j30 ≤ total n'est pas respecté, un champ manquant ou une forme fausse → `null` pour TOUTE la réponse.
 *
 * Forme exacte attendue (version 1) :
 * {
 *   "v": 1,
 *   "genereLe": "<date ISO, texte non vide>",
 *   "lignes": [
 *     { "mot": "GUIDE", "reseau": "<texte non vide>",
 *       "postRef": "<texte non vide>" | null, "versionTexte": "<texte non vide>" | null,
 *       "cible": "<texte non vide>",
 *       "formulaires": { "j7": 0, "j30": 0, "total": 0 },
 *       "envois":      { "j7": 0, "j30": 0, "total": 0 },
 *       "clics":       { "j7": 0, "j30": 0, "total": 0 } } ]
 * }
 * Une ligne = un grain (mot, reseau, postRef, versionTexte, cible) ; deux lignes de même grain → null.
 * Le mot passe par `normaliserMot` (un mot invalide → null). Les champs inconnus en plus sont ignorés et jamais gardés.
 * Agrégation côté Studio (sommes de lignes) : par mot = toutes les lignes ; par publication = lignes de même (mot, postRef),
 * `postRef` nul = « sans-publication » ; par version = lignes de même (mot, versionTexte non nul) pour les clics.
 */
import { normaliserMot } from "./mot-normalise";

export const CHEMIN_COMPTEURS_GUIDE_RESEAU =
  "/api/interne/compteurs-guide-reseau";

export interface FenetreSite {
  readonly j7: number;
  readonly j30: number;
  readonly total: number;
}
export interface CompteursMotSite {
  readonly formulaires: FenetreSite;
  readonly envoisEmail: FenetreSite;
  readonly clics: FenetreSite;
}
export interface CompteursPublicationSite {
  readonly formulaires: number;
  readonly clics: number;
}
export interface LigneSite {
  readonly mot: string;
  readonly reseau: string;
  readonly postRef: string | null;
  readonly versionTexte: string | null;
  readonly cible: string;
  readonly formulaires: FenetreSite;
  readonly envois: FenetreSite;
  readonly clics: FenetreSite;
}
export interface CompteursSite {
  readonly genereLe: string;
  /** Lignes validées, telles que le site les a données. */
  readonly lignes: readonly LigneSite[];
  /** Clé = mot normalisé (somme de toutes ses lignes). */
  readonly mots: ReadonlyMap<string, CompteursMotSite>;
  /** Clé = JSON.stringify([mot, postRef ou "sans-publication"]) (total, sans fenêtre). */
  readonly publications: ReadonlyMap<string, CompteursPublicationSite>;
  /** Clé = JSON.stringify([mot, versionTexte]) → clics (total). */
  readonly versions: ReadonlyMap<string, number>;
}

const SANS_PUBLICATION_SITE = "sans-publication";

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const entier = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const texteNonVide = (v: unknown): v is string =>
  typeof v === "string" && v !== "";

function fenetre(v: unknown): FenetreSite | null {
  if (!estObjet(v) || !entier(v.j7) || !entier(v.j30) || !entier(v.total))
    return null;
  if (v.j7 > v.j30 || v.j30 > v.total) return null;
  return { j7: v.j7, j30: v.j30, total: v.total };
}
const somme = (a: FenetreSite, b: FenetreSite): FenetreSite => ({
  j7: a.j7 + b.j7,
  j30: a.j30 + b.j30,
  total: a.total + b.total,
});
const ZERO: FenetreSite = { j7: 0, j30: 0, total: 0 };

export const clePublicationSite = (mot: string, postRef: string): string =>
  JSON.stringify([mot, postRef]);
export const cleVersionSite = (mot: string, version: string): string =>
  JSON.stringify([mot, version]);

/** Lit la réponse du site. Tout écart au contrat → null (réponse entière écartée). */
export function lireCompteursSite(corps: unknown): CompteursSite | null {
  if (
    !estObjet(corps) ||
    corps.v !== 1 ||
    !texteNonVide(corps.genereLe) ||
    !Array.isArray(corps.lignes)
  )
    return null;
  const lignes: LigneSite[] = [];
  const grains = new Set<string>();
  for (const l of corps.lignes) {
    if (!estObjet(l)) return null;
    const mot = normaliserMot(l.mot);
    const formulaires = fenetre(l.formulaires);
    const envois = fenetre(l.envois);
    const clics = fenetre(l.clics);
    if (
      mot === null ||
      !texteNonVide(l.reseau) ||
      !(l.postRef === null || texteNonVide(l.postRef)) ||
      !(l.versionTexte === null || texteNonVide(l.versionTexte)) ||
      !texteNonVide(l.cible) ||
      !formulaires ||
      !envois ||
      !clics
    )
      return null;
    const grain = JSON.stringify([mot, l.reseau, l.postRef, l.versionTexte, l.cible]);
    if (grains.has(grain)) return null;
    grains.add(grain);
    lignes.push({
      mot,
      reseau: l.reseau,
      postRef: l.postRef,
      versionTexte: l.versionTexte,
      cible: l.cible,
      formulaires,
      envois,
      clics,
    });
  }
  const mots = new Map<string, CompteursMotSite>();
  const publications = new Map<string, CompteursPublicationSite>();
  const versions = new Map<string, number>();
  for (const l of lignes) {
    const m = mots.get(l.mot);
    mots.set(l.mot, {
      formulaires: somme(m?.formulaires ?? ZERO, l.formulaires),
      envoisEmail: somme(m?.envoisEmail ?? ZERO, l.envois),
      clics: somme(m?.clics ?? ZERO, l.clics),
    });
    const kp = clePublicationSite(l.mot, l.postRef ?? SANS_PUBLICATION_SITE);
    const p = publications.get(kp);
    publications.set(kp, {
      formulaires: (p?.formulaires ?? 0) + l.formulaires.total,
      clics: (p?.clics ?? 0) + l.clics.total,
    });
    if (l.versionTexte !== null) {
      const kv = cleVersionSite(l.mot, l.versionTexte);
      versions.set(kv, (versions.get(kv) ?? 0) + l.clics.total);
    }
  }
  return { genereLe: corps.genereLe, lignes, mots, publications, versions };
}

/** Forme sérialisable (copie en base) : le contrat se relit à la lecture de la copie. */
export function compteursVersJson(c: CompteursSite): unknown {
  return { v: 1, genereLe: c.genereLe, lignes: c.lignes };
}
