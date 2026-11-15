/**
 * GUIDES PDF (lot G5) · fabrication d'un guide depuis le Studio : règles PURES (aucune base, aucun réseau).
 * INERTE : tout est derrière `GUIDES_FABRIQUE_ECRAN` (vrai seulement pour la chaîne exacte « true »).
 * L'empreinte et le contrôle des mots interdits viennent de `guide-contenu.ts` : rien n'est recopié ici.
 */
import { createHash } from "node:crypto";
import { controlerTexteGuide, empreinteGuide, schemaContenuGuide, type ContenuGuide } from "./guide-contenu";

export const VARIABLE_INTERRUPTEUR_GUIDES_FABRIQUE = "GUIDES_FABRIQUE_ECRAN";
export const CHEMIN_GUIDES_CONTENU = "/api/interne/guides-reseau/contenu";
export const PREFIXE_PARAM_FABRIQUE = "guides.fabrique.";
const LONGUEUR_MAX_INTERRUPTEUR = 16;

type Env = Record<string, string | undefined>;

/** Seul le texte exact « true » allume (majuscules, espaces, valeur démesurée : éteint). */
export function guidesFabriqueActif(env: Env = process.env): boolean {
  const v = env[VARIABLE_INTERRUPTEUR_GUIDES_FABRIQUE];
  return typeof v === "string" && v.length <= LONGUEUR_MAX_INTERRUPTEUR && v === "true";
}

/** Code du guide dans le catalogue du site : stable pour un même mot (rejouer ne crée jamais un second guide). `gde-` + 12 hex. */
export function codeGuideDuMot(idMot: string): string {
  return `gde-${createHash("sha256").update(idMot, "utf8").digest("hex").slice(0, 12)}`;
}

/** Corps envoyé au site : le texte VALIDÉ, avec son empreinte recalculée ici (jamais celle d'un client). */
export interface CorpsContenuGuide {
  code: string;
  version: number;
  sha256Texte: string;
  titre: string;
  sections: ContenuGuide["sections"];
}

export function corpsContenuGuide(code: string, version: number, contenu: ContenuGuide): CorpsContenuGuide {
  return { code, version, sha256Texte: empreinteGuide(contenu), titre: contenu.titre, sections: contenu.sections };
}

export type ControleRelecture = { ok: true; contenu: ContenuGuide; empreinte: string } | { ok: false; raison: "texte_invalide" | "texte_refuse"; regle?: string };

/** Contrôle d'un texte relu : forme (schéma G1) puis mots interdits (v3). Un refus ne contient jamais d'extrait. */
export function controlerRelecture(brut: unknown): ControleRelecture {
  const analyse = schemaContenuGuide.safeParse(brut);
  if (!analyse.success) return { ok: false, raison: "texte_invalide" };
  const controle = controlerTexteGuide(analyse.data);
  if (!controle.ok) return { ok: false, raison: "texte_refuse", regle: controle.regle };
  return { ok: true, contenu: analyse.data, empreinte: empreinteGuide(analyse.data) };
}

export type IssueSite =
  | { issue: "fabrique"; cheminPdf: string | null; pages: number | null }
  | { issue: "deja_ou_perime" | "refus_contenu" | "rendu_en_cours" | "echec" | "site_absent"; phrase: string };

export const PHRASES_FABRICATION = {
  deja_ou_perime: "Le site a déjà ce guide, ou une version plus récente. Rien n'a été enregistré comme fabriqué : relisez l'état du guide.",
  refus_contenu: "Le site a refusé le texte de ce guide. Rien n'a été enregistré comme fabriqué : relisez le texte et corrigez-le.",
  rendu_en_cours: "Le site fabrique déjà ce guide. Patientez un moment, puis relisez l'état.",
  echec: "Le site n'a pas réussi à fabriquer le PDF. Rien n'a été enregistré comme fabriqué : réessayez plus tard.",
  site_absent: "La fabrication de PDF n'est pas encore en ligne sur le site (ou le site ne répond pas). Rien n'a été enregistré comme fabriqué.",
  non_relie: "Le site n'est pas relié au Studio : rien n'a été envoyé.",
  incertain: "Le site n'a pas répondu à temps : le PDF a peut-être été fabriqué. Rien n'a été enregistré ; réessayez, il ne sera pas fabriqué deux fois.",
} as const;

const CHEMIN_PDF_SUR = /^\/[A-Za-z0-9._\-/]{1,200}\.pdf$/;

/** Lit la réponse du site : 201 fabriqué ; 409, 422, 429, 503 ; 404 = route pas encore en ligne ; tout autre statut = échec. */
export function lireReponseSite(statut: number, corps: unknown): IssueSite {
  switch (statut) {
    case 201: {
      const o = typeof corps === "object" && corps !== null && !Array.isArray(corps) ? (corps as Record<string, unknown>) : {};
      const chemin = typeof o.cheminPdf === "string" && CHEMIN_PDF_SUR.test(o.cheminPdf) && !o.cheminPdf.includes("..") ? o.cheminPdf : null;
      const pages = typeof o.pages === "number" && Number.isInteger(o.pages) && o.pages > 0 && o.pages <= 500 ? o.pages : null;
      return { issue: "fabrique", cheminPdf: chemin, pages };
    }
    case 409:
      return { issue: "deja_ou_perime", phrase: PHRASES_FABRICATION.deja_ou_perime };
    case 422:
      return { issue: "refus_contenu", phrase: PHRASES_FABRICATION.refus_contenu };
    case 429:
      return { issue: "rendu_en_cours", phrase: PHRASES_FABRICATION.rendu_en_cours };
    case 404:
      return { issue: "site_absent", phrase: PHRASES_FABRICATION.site_absent };
    default:
      return { issue: "echec", phrase: PHRASES_FABRICATION.echec };
  }
}
