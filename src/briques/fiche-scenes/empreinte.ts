/**
 * EMPREINTES STABLES de la fiche de scènes : même contenu = même empreinte, quel que soit l'ordre des clés.
 * PUR, sans `node:crypto` ni alias « @/ » (lisible par `studio-rendu`). Les empreintes existantes du dépôt vivent dans
 * des modules serveur (`src/veille/http.ts`, `node:crypto`) ou chargés de dépendances « @/ »
 * (`src/moteurs/montage-facecam/retouche.ts`) : même famille de hachage (FNV-1a), recopiée ici pour rester autonome.
 *
 * L'empreinte d'une scène sert de clé au rendu de la scène (cache naturel) : elle compte tout ce qui change son image —
 * la scène elle-même (`debutMs`/`finMs` compris) et le cadre figé de la fiche (version, format, habillage, stylo, ratio).
 * Pas de sécurité : seulement l'égalité.
 */
import type { FicheScenes, SceneFiche } from "./types";

/** Texte canonique d'une valeur JSON : clés triées à tous les niveaux, champs `undefined` omis, listes dans l'ordre. */
export function jsonCanonique(valeur: unknown): string {
  if (valeur === null || typeof valeur !== "object") {
    if (typeof valeur === "number" && !Number.isFinite(valeur)) throw new Error("Empreinte : nombre non fini refusé.");
    return JSON.stringify(valeur) ?? "null";
  }
  if (Array.isArray(valeur)) return `[${valeur.map((v) => (v === undefined ? "null" : jsonCanonique(v))).join(",")}]`;
  const objet = valeur as Record<string, unknown>;
  const cles = Object.keys(objet)
    .filter((k) => objet[k] !== undefined)
    .sort();
  return `{${cles.map((k) => `${JSON.stringify(k)}:${jsonCanonique(objet[k])}`).join(",")}}`;
}

/** FNV-1a 64 bits (deux passes de 32 bits indépendantes) + longueur : 16 caractères hexadécimaux, tiret, longueur. */
function hacher(texte: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x0100019d) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}-${texte.length.toString(36)}`;
}

/** Cadre figé d'une fiche, compté dans l'empreinte de chaque scène. */
export type CadreScene = Pick<FicheScenes, "version" | "formatId" | "habillage" | "stylo" | "ratio">;

export function cadreDeFiche(fiche: FicheScenes<unknown>): CadreScene {
  return { version: fiche.version, formatId: fiche.formatId, habillage: fiche.habillage, stylo: fiche.stylo, ratio: fiche.ratio };
}

/** Empreinte de la fiche entière. */
export function empreinteFiche(fiche: FicheScenes<unknown>): string {
  return `fiche-${hacher(jsonCanonique(fiche))}`;
}

/** Empreinte d'une scène dans son cadre (sa clé de rendu). */
export function empreinteScene(scene: SceneFiche<unknown>, cadre: CadreScene): string {
  return `scene-${hacher(jsonCanonique({ cadre, scene }))}`;
}

/** Empreintes de toutes les scènes, par identifiant de scène. */
export function empreintesScenes(fiche: FicheScenes<unknown>): Record<string, string> {
  const cadre = cadreDeFiche(fiche);
  return Object.fromEntries(fiche.scenes.map((s) => [s.id, empreinteScene(s, cadre)]));
}
