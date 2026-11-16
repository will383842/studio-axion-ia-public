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

/** Chemin définitif du PDF dans le stockage du site, DÉRIVÉ ici (le site ne le renvoie jamais) : `guides-reseau/<code>/v<version>.pdf`. */
export function cheminPdfDuGuide(code: string, version: number): string | null {
  if (!/^gde-[0-9a-f]{12}$/.test(code) || !Number.isInteger(version) || version < 1 || version > 1000) return null;
  const c = `guides-reseau/${code}/v${version}.pdf`;
  // Même forme que `validerCheminPdf` du site : relatif (pas de slash initial), sans « .. » ni « // », extension .pdf.
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*\.pdf$/.test(c) && !c.includes("..") && !c.includes("//") ? c : null;
}

export type IssueSite =
  | { issue: "fabrique"; pages: number | null; deja: boolean }
  | { issue: "deja_ou_perime" | "version_perimee" | "version_existante" | "site_en_cours" | "refus_contenu" | "rendu_en_cours" | "echec" | "indisponible" | "site_absent"; phrase: string };

export const PHRASES_FABRICATION = {
  deja_ou_perime: "Le site a déjà ce guide, ou une version plus récente. Rien n'a été enregistré comme fabriqué : relisez l'état du guide.",
  version_perimee: "Le site a déjà une version plus récente de ce guide : celle-ci est périmée. Rien n'a été enregistré comme fabriqué.",
  version_existante: "Le site a déjà fabriqué cette version avec un texte différent. Rien n'a été enregistré comme fabriqué : rédigez une nouvelle version.",
  site_en_cours: "Le site est déjà en train de fabriquer cette version. Patientez quelques minutes, puis refaites « Fabriquer le PDF ».",
  refus_contenu: "Le site a refusé le texte de ce guide. Rien n'a été enregistré comme fabriqué : relisez le texte et corrigez-le.",
  rendu_en_cours: "Le site fabrique déjà ce guide. Patientez un moment, puis relisez l'état.",
  echec: "Le site n'a pas réussi à fabriquer le PDF. Rien n'a été enregistré comme fabriqué : réessayez plus tard.",
  indisponible: "Le site est momentanément indisponible (base ou stockage des fichiers). Rien n'a été enregistré comme fabriqué : réessayez dans quelques minutes.",
  site_absent: "La fabrication de PDF n'est pas encore en ligne sur le site (ou le site ne répond pas). Rien n'a été enregistré comme fabriqué.",
  non_relie: "Le site n'est pas relié au Studio : rien n'a été envoyé.",
  incertain: "Le site n'a pas répondu à temps : le PDF a peut-être été fabriqué. Rien n'a été enregistré ; réessayez, il ne sera pas fabriqué deux fois.",
} as const;

/** Lit la réponse du site : 201 ou 200 `{ok:true}` (renvoi identique, `deja`) = fabriqué ; 409 selon `erreur` ; 422, 429, 503 ; 404 = route pas en ligne ; autre = échec. */
export function lireReponseSite(statut: number, corps: unknown): IssueSite {
  const o = typeof corps === "object" && corps !== null && !Array.isArray(corps) ? (corps as Record<string, unknown>) : {};
  switch (statut) {
    case 200:
    case 201: {
      if (statut === 200 && o.ok !== true) return { issue: "echec", phrase: PHRASES_FABRICATION.echec };
      const pages = typeof o.pages === "number" && Number.isInteger(o.pages) && o.pages > 0 && o.pages <= 500 ? o.pages : null;
      return { issue: "fabrique", pages, deja: o.deja === true };
    }
    case 409: {
      const e = o.erreur;
      if (e === "version_perimee") return { issue: "version_perimee", phrase: PHRASES_FABRICATION.version_perimee };
      if (e === "version_existante") return { issue: "version_existante", phrase: PHRASES_FABRICATION.version_existante };
      if (e === "en_cours") return { issue: "site_en_cours", phrase: PHRASES_FABRICATION.site_en_cours };
      return { issue: "deja_ou_perime", phrase: PHRASES_FABRICATION.deja_ou_perime };
    }
    case 422:
      return { issue: "refus_contenu", phrase: PHRASES_FABRICATION.refus_contenu };
    case 429:
      return { issue: "rendu_en_cours", phrase: PHRASES_FABRICATION.rendu_en_cours };
    case 503:
      return { issue: "indisponible", phrase: PHRASES_FABRICATION.indisponible };
    case 404:
      return { issue: "site_absent", phrase: PHRASES_FABRICATION.site_absent };
    default:
      return { issue: "echec", phrase: PHRASES_FABRICATION.echec };
  }
}
