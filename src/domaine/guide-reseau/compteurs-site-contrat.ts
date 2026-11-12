/**
 * SUI-A — contrat PUR de lecture des compteurs du site : POST /api/interne/compteurs-guide-reseau, corps { v: 1 }.
 * Aucun import serveur, aucun réseau. Lecture STRICTE : le moindre nombre non entier ou négatif, un champ manquant
 * ou une forme fausse → `null` pour TOUTE la réponse (jamais de demi-chiffre).
 *
 * Forme exacte attendue (version 1), tous les compteurs sont des entiers ≥ 0 :
 * {
 *   "v": 1,
 *   "mots": [
 *     { "mot": "GUIDE",
 *       "formulaires": { "j7": 0, "j30": 0, "total": 0 },
 *       "envoisEmail": { "j7": 0, "j30": 0, "total": 0 },
 *       "clics":       { "j7": 0, "j30": 0, "total": 0 } } ],
 *   "publications": [ { "mot": "GUIDE", "postRef": "…", "formulaires": 0, "clics": 0 } ],
 *   "versions":     [ { "mot": "GUIDE", "versionTexte": "…", "clics": 0 } ]
 * }
 * Le mot passe par `normaliserMot` (un mot invalide ou en double → null). `postRef` et `versionTexte` : texte non vide.
 * Les champs inconnus en plus sont ignorés et jamais gardés.
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
export interface CompteursSite {
  /** Clé = mot normalisé. */
  readonly mots: ReadonlyMap<string, CompteursMotSite>;
  /** Clé = JSON.stringify([mot, postRef]). */
  readonly publications: ReadonlyMap<string, CompteursPublicationSite>;
  /** Clé = JSON.stringify([mot, versionTexte]) → clics. */
  readonly versions: ReadonlyMap<string, number>;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const entier = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;
const texteNonVide = (v: unknown): v is string =>
  typeof v === "string" && v !== "";

function fenetre(v: unknown): FenetreSite | null {
  if (!estObjet(v) || !entier(v.j7) || !entier(v.j30) || !entier(v.total))
    return null;
  return { j7: v.j7, j30: v.j30, total: v.total };
}

export const clePublicationSite = (mot: string, postRef: string): string =>
  JSON.stringify([mot, postRef]);
export const cleVersionSite = (mot: string, version: string): string =>
  JSON.stringify([mot, version]);

/** Lit la réponse du site. Tout écart au contrat → null (réponse entière écartée). */
export function lireCompteursSite(corps: unknown): CompteursSite | null {
  if (
    !estObjet(corps) ||
    corps.v !== 1 ||
    !Array.isArray(corps.mots) ||
    !Array.isArray(corps.publications) ||
    !Array.isArray(corps.versions)
  )
    return null;
  const mots = new Map<string, CompteursMotSite>();
  for (const l of corps.mots) {
    if (!estObjet(l)) return null;
    const mot = normaliserMot(l.mot);
    const formulaires = fenetre(l.formulaires);
    const envoisEmail = fenetre(l.envoisEmail);
    const clics = fenetre(l.clics);
    if (mot === null || !formulaires || !envoisEmail || !clics || mots.has(mot))
      return null;
    mots.set(mot, { formulaires, envoisEmail, clics });
  }
  const publications = new Map<string, CompteursPublicationSite>();
  for (const l of corps.publications) {
    if (!estObjet(l)) return null;
    const mot = normaliserMot(l.mot);
    if (
      mot === null ||
      !texteNonVide(l.postRef) ||
      !entier(l.formulaires) ||
      !entier(l.clics)
    )
      return null;
    const cle = clePublicationSite(mot, l.postRef);
    if (publications.has(cle)) return null;
    publications.set(cle, { formulaires: l.formulaires, clics: l.clics });
  }
  const versions = new Map<string, number>();
  for (const l of corps.versions) {
    if (!estObjet(l)) return null;
    const mot = normaliserMot(l.mot);
    if (mot === null || !texteNonVide(l.versionTexte) || !entier(l.clics))
      return null;
    const cle = cleVersionSite(mot, l.versionTexte);
    if (versions.has(cle)) return null;
    versions.set(cle, l.clics);
  }
  return { mots, publications, versions };
}

/** Forme sérialisable (copie en base) : le contrat se relit à la lecture de la copie. */
export function compteursVersJson(c: CompteursSite): unknown {
  return {
    v: 1,
    mots: [...c.mots].map(([mot, m]) => ({ mot, ...m })),
    publications: [...c.publications].map(([cle, p]) => {
      const [mot, postRef] = JSON.parse(cle) as [string, string];
      return { mot, postRef, ...p };
    }),
    versions: [...c.versions].map(([cle, clics]) => {
      const [mot, versionTexte] = JSON.parse(cle) as [string, string];
      return { mot, versionTexte, clics };
    }),
  };
}
