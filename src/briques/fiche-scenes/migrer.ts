/**
 * MIGRATION de la fiche de scènes : passage d'une version à la SUIVANTE, pas à pas, jusqu'à la version courante.
 * Une version inconnue est REFUSÉE, jamais devinée. Une vidéo garde sa version : la migration ne sert qu'à relire une
 * fiche ancienne pour une nouvelle fabrication (le résultat repasse ensuite par `validerFiche`).
 */
import { VERSION_FICHE_SCENES, type ProblemeFiche, type ResultatFiche } from "./types";

/** Une marche : de `de` vers `vers`, fonction pure qui ne modifie pas son entrée. */
export interface MarcheMigration {
  de: string;
  vers: string;
  migrer: (fiche: Record<string, unknown>) => Record<string, unknown>;
}

/** Marches connues. Vide tant que `fiche-scenes/1` est la seule version. */
export const MIGRATIONS_FICHE: readonly MarcheMigration[] = [];

const REGLE = "version connue";

function refus(detail: string): { ok: false; problemes: ProblemeFiche[] } {
  return { ok: false, problemes: [{ regle: REGLE, message: `Fiche · règle « ${REGLE} » : ${detail}` }] };
}

/** Versions connues : la version courante et chaque version de départ d'une marche. */
export function versionsConnues(marches: readonly MarcheMigration[] = MIGRATIONS_FICHE, cible: string = VERSION_FICHE_SCENES): string[] {
  return [...new Set([...marches.map((m) => m.de), cible])];
}

/**
 * Amène une fiche brute à la version `cible` (la version courante par défaut). Renvoie une COPIE ; l'entrée n'est
 * jamais modifiée. Refuse une version absente ou inconnue, et une chaîne de marches qui boucle ou ne mène pas à la cible.
 */
export function migrerFiche(
  brute: unknown,
  marches: readonly MarcheMigration[] = MIGRATIONS_FICHE,
  cible: string = VERSION_FICHE_SCENES,
): ResultatFiche<Record<string, unknown>> {
  if (typeof brute !== "object" || brute === null || Array.isArray(brute)) return refus("la fiche doit être un objet.");
  const depart = (brute as { version?: unknown }).version;
  if (typeof depart !== "string") return refus("la version est absente ; impossible de savoir comment lire la fiche.");

  let fiche = structuredClone(brute) as Record<string, unknown>;
  const parcourues = new Set<string>();
  let version = depart;
  while (version !== cible) {
    if (parcourues.has(version)) return refus(`la migration repasse par la version « ${version} » ; chaîne de versions incohérente.`);
    parcourues.add(version);
    const marche = marches.find((m) => m.de === version);
    if (!marche) {
      return refus(`la version « ${version} » est inconnue ; versions connues : ${versionsConnues(marches, cible).map((v) => `« ${v} »`).join(", ")}.`);
    }
    fiche = { ...marche.migrer(structuredClone(fiche)), version: marche.vers };
    version = marche.vers;
  }
  return { ok: true, fiche };
}
