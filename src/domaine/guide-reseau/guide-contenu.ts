/**
 * GUIDES PDF (lot G1) · contenu d'un guide : schéma, JSON canonique, empreinte, contrôle du texte. Module PUR (zod et
 * node:crypto seulement) ; INERTE : rien ne l'appelle tant que la rédaction (G2) est éteinte.
 *
 * Le site recalcule la MÊME empreinte (JSON canonique NFC/UTF-8) et applique la MÊME liste de mots interdits : la liste est
 * exportée dans `tests/fixtures/guide-mots-interdits.json` (à copier à l'identique dans le site ; un test garde l'égalité).
 * Normalisation du contrôle : NFKD, sans accents, minuscules, apostrophes typographiques ramenées à l'apostrophe droite.
 * Le résultat d'un refus ne contient JAMAIS d'extrait du texte, seulement l'identifiant de la règle.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const BORNES_GUIDE = { sections: 20, titre: 120, paragraphes: 15, paragrapheCar: 1500, puces: 10, puceCar: 300, totalCar: 40_000 } as const;

/** Caractères de contrôle (C0, DEL, C1) et marques bidirectionnelles : refusés partout. */
const INTERDITS_CARACTERES = /[\u0000-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/;

const texte = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !INTERDITS_CARACTERES.test(s), "caractère interdit");

export const schemaSectionGuide = z
  .object({
    titre: texte(BORNES_GUIDE.titre),
    paragraphes: z.array(texte(BORNES_GUIDE.paragrapheCar)).min(1).max(BORNES_GUIDE.paragraphes),
    puces: z.array(texte(BORNES_GUIDE.puceCar)).max(BORNES_GUIDE.puces),
  })
  .strict();

export const schemaContenuGuide = z
  .object({
    titre: texte(BORNES_GUIDE.titre),
    sections: z.array(schemaSectionGuide).min(1).max(BORNES_GUIDE.sections),
  })
  .strict()
  .refine((c) => longueurTotale(c) <= BORNES_GUIDE.totalCar, "texte trop long");

export type SectionGuide = z.infer<typeof schemaSectionGuide>;
export type ContenuGuide = { titre: string; sections: SectionGuide[] };

function longueurTotale(c: ContenuGuide): number {
  return c.titre.length + c.sections.reduce((n, s) => n + s.titre.length + s.paragraphes.reduce((a, p) => a + p.length, 0) + s.puces.reduce((a, p) => a + p.length, 0), 0);
}

/** JSON canonique : NFC, UTF-8, compact, clés dans l'ordre {titre, sections:[{titre, paragraphes, puces}]}. */
export function jsonCanoniqueGuide(c: ContenuGuide): string {
  const nfc = (s: string) => s.normalize("NFC");
  return JSON.stringify({
    titre: nfc(c.titre),
    sections: c.sections.map((s) => ({ titre: nfc(s.titre), paragraphes: s.paragraphes.map(nfc), puces: s.puces.map(nfc) })),
  });
}

/** Empreinte SHA-256 (hex minuscule) du JSON canonique. */
export function empreinteGuide(c: ContenuGuide): string {
  return createHash("sha256").update(jsonCanoniqueGuide(c), "utf8").digest("hex");
}

export interface RegleMotInterdit {
  id: string;
  description: string;
  /** Expression régulière (drapeau `u`) appliquée au texte NORMALISÉ. */
  motif: string;
  exemples: string[];
}

/** Liste unique, dans l'ordre d'application. Copie exacte dans le site (fixture partagée). */
export const REGLES_MOTS_INTERDITS: RegleMotInterdit[] = [
  { id: "abonne", description: "abonné, abonnement… (dire « suivre le compte »)", motif: "\\babonn", exemples: ["abonné", "abonnement"] },
  { id: "grenoble", description: "Grenoble", motif: "grenoble", exemples: ["Grenoble"] },
  { id: "aucun-gain-garanti", description: "« Aucun gain garanti »", motif: "aucun\\s+gain\\s+garanti", exemples: ["Aucun gain garanti"] },
  { id: "garanti", description: "garanti, garantie, garantissons…", motif: "\\bgaranti", exemples: ["garanti", "garantissons"] },
  { id: "certifie", description: "certifié, certification…", motif: "\\bcertifi", exemples: ["certifiée", "certification"] },
  { id: "qualiopi", description: "Qualiopi", motif: "qualiopi", exemples: ["Qualiopi"] },
  { id: "tutoiement", description: "tutoiement : tu, toi, te, ta, tes, t'", motif: "\\b(?:tu|toi|te|ta|tes)\\b|\\bt'", exemples: ["Tu peux", "pour toi", "je t'explique"] },
  { id: "pourcentage", description: "promesse chiffrée : %", motif: "%", exemples: ["30 %"] },
  { id: "euro", description: "promesse chiffrée : €", motif: "€", exemples: ["100 €"] },
  { id: "x-fois", description: "promesse chiffrée : « x fois », « 3 fois »", motif: "\\bx\\s*fois\\b|\\b\\d+\\s*fois\\b", exemples: ["x fois mieux", "3 fois plus"] },
  { id: "double", description: "promesse chiffrée : doubler, tripler…", motif: "\\b(?:doubl|tripl)", exemples: ["doubler", "triplé"] },
];

/** NFKD, sans accents, minuscules, apostrophes droites. */
export function normaliserPourControle(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase();
}

const REGLES_COMPILEES = REGLES_MOTS_INTERDITS.map((r) => ({ id: r.id, re: new RegExp(r.motif, "u") }));

export type ResultatControleTexte = { ok: true } | { ok: false; regle: string };

/** Contrôle tous les textes du guide (titre, titres de section, paragraphes, puces). Aucun extrait dans le refus. */
export function controlerTexteGuide(c: ContenuGuide): ResultatControleTexte {
  const textes = [c.titre, ...c.sections.flatMap((s) => [s.titre, ...s.paragraphes, ...s.puces])].map(normaliserPourControle);
  for (const r of REGLES_COMPILEES) if (textes.some((t) => r.re.test(t))) return { ok: false, regle: r.id };
  return { ok: true };
}
