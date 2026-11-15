/**
 * GUIDES PDF (lot G6) · réconciliation Studio ↔ site des guides fabriqués. Module PUR : aucune entrée-sortie, aucun effet.
 * Il AFFICHE les écarts, il ne corrige rien. Un écart ne porte JAMAIS de texte du guide : seulement le code, la version et
 * les 12 premiers caractères d'empreinte (hexadécimal, sinon « ? »). Un code illisible venu du site est remplacé par « ? ».
 */

export type TypeEcart = "manquant_au_site" | "manquant_au_studio" | "empreinte_differente" | "version_en_retard" | "echec_au_site" | "pdf_incoherent";

/** Ordre fixe des types : sert au tri stable quand code et version sont égaux. */
export const ORDRE_TYPES_ECART: readonly TypeEcart[] = ["manquant_au_site", "version_en_retard", "empreinte_differente", "echec_au_site", "pdf_incoherent", "manquant_au_studio"];

export type StatutSite = "pret" | "echec" | "en_cours";

export interface VersionStudio {
  code: string;
  version: number;
  /** Empreinte SHA-256 du texte validé (`empreinteGuide`). */
  empreinte: string;
}

export interface VersionSite {
  code: string;
  version: number;
  sha256Texte: string;
  statut: StatutSite;
  sha256Pdf: string | null;
  tailleOctets: number;
}

export interface Ecart {
  type: TypeEcart;
  code: string;
  version: number;
  /** 12 premiers caractères de l'empreinte côté Studio (si l'écart en a une). */
  empreinteStudio?: string;
  /** 12 premiers caractères de l'empreinte du texte côté site (si l'écart en a une). */
  empreinteSite?: string;
}

const RE_CODE = /^(gde|adr)-[a-z0-9-]{6,24}$|^guide-ia$/;

export const courteEmpreinte = (e: unknown): string => (typeof e === "string" && /^[0-9a-f]{12,}$/i.test(e) ? e.slice(0, 12).toLowerCase() : "?");
const codeSur = (c: unknown): string => (typeof c === "string" && RE_CODE.test(c) ? c : "?");
const versionSure = (v: unknown): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : -1);
/** Empreinte SHA-256 du PDF : exactement 64 caractères hexadécimaux. */
const RE_SHA256 = /^[0-9a-f]{64}$/i;
const cle = (code: string, version: number): string => `${code}\u0000${version}`;

function indexer<T extends { code: string; version: number }>(lignes: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const l of lignes) {
    const k = cle(codeSur(l.code), versionSure(l.version));
    if (!m.has(k)) m.set(k, l); // doublon : la première ligne fait foi
  }
  return m;
}

/** Compare les versions du Studio à celles du site. Tri stable : code, puis version, puis type (ordre de `ORDRE_TYPES_ECART`). */
export function comparerVersions(studio: readonly VersionStudio[], site: readonly VersionSite[]): Ecart[] {
  const s = indexer(studio);
  const t = indexer(site);
  const maxSite = new Map<string, number>();
  for (const l of t.values()) {
    const c = codeSur(l.code);
    maxSite.set(c, Math.max(maxSite.get(c) ?? -1, versionSure(l.version)));
  }
  const ecarts: Ecart[] = [];
  for (const l of s.values()) {
    const code = codeSur(l.code);
    const version = versionSure(l.version);
    const autre = t.get(cle(code, version));
    const empreinteStudio = courteEmpreinte(l.empreinte);
    if (!autre) {
      const retard = maxSite.has(code) && version > (maxSite.get(code) ?? -1);
      ecarts.push({ type: retard ? "version_en_retard" : "manquant_au_site", code, version, empreinteStudio });
      continue;
    }
    const empreinteSite = courteEmpreinte(autre.sha256Texte);
    if (typeof l.empreinte !== "string" || typeof autre.sha256Texte !== "string" || l.empreinte.toLowerCase() !== autre.sha256Texte.toLowerCase())
      ecarts.push({ type: "empreinte_differente", code, version, empreinteStudio, empreinteSite });
    if (autre.statut === "echec") ecarts.push({ type: "echec_au_site", code, version });
    else if (
      autre.statut === "pret" &&
      // « pret » exige un PDF complet : taille positive ET empreinte du PDF (null, absente ou non hexadécimale de 64 signes = incohérent).
      !(typeof autre.tailleOctets === "number" && Number.isFinite(autre.tailleOctets) && autre.tailleOctets > 0 && typeof autre.sha256Pdf === "string" && RE_SHA256.test(autre.sha256Pdf))
    )
      ecarts.push({ type: "pdf_incoherent", code, version });
  }
  for (const [k, l] of t) {
    if (!s.has(k)) ecarts.push({ type: "manquant_au_studio", code: codeSur(l.code), version: versionSure(l.version), empreinteSite: courteEmpreinte(l.sha256Texte) });
  }
  const rang = (e: Ecart) => ORDRE_TYPES_ECART.indexOf(e.type);
  return ecarts.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.version - b.version || rang(a) - rang(b)));
}

/** Lit la liste du site : lignes illisibles écartées et comptées (jamais recopiées). */
export function lireVersionsSite(brut: unknown): { versions: VersionSite[]; ignorees: number } | null {
  if (!Array.isArray(brut)) return null;
  const versions: VersionSite[] = [];
  let ignorees = 0;
  for (const l of brut as unknown[]) {
    const o = typeof l === "object" && l !== null ? (l as Record<string, unknown>) : null;
    if (
      !o ||
      typeof o.code !== "string" ||
      !RE_CODE.test(o.code) ||
      !Number.isSafeInteger(o.version) ||
      (o.version as number) < 0 ||
      typeof o.sha256Texte !== "string" ||
      (o.statut !== "pret" && o.statut !== "echec" && o.statut !== "en_cours") ||
      !(typeof o.sha256Pdf === "string" || o.sha256Pdf === null || o.sha256Pdf === undefined) ||
      typeof o.tailleOctets !== "number" ||
      !Number.isFinite(o.tailleOctets)
    ) {
      ignorees++;
      continue;
    }
    versions.push({ code: o.code, version: o.version as number, sha256Texte: o.sha256Texte, statut: o.statut, sha256Pdf: (o.sha256Pdf as string | null | undefined) ?? null, tailleOctets: o.tailleOctets });
  }
  return { versions, ignorees };
}
