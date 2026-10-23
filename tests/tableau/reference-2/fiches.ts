/**
 * Fiches de test du style « reference/2 » (gabarit de page clair, 14/10/2026) : les quatre fiches RÉELLES
 * (`temoins/fiche-*-prod.json`) réécrites au gabarit (même texte dit, mot pour mot ; écrit structuré : titre, phrase
 * clé, détails, numéros dits, avant / après, « À retenir ») et la fiche « réponses types » de la maquette (7 pages).
 * Remises en forme comme en production, calées sur un minutage régulier (0,3 s par mot, aucune voix lue). Partagé par
 * les tests et les planches (`apercus.mts`, `video.mts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { remettreEnForme } from "../../../src/moteurs/montage-tableau/decoupage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";

export { caleeReguliere, contexteDe, motsReguliers } from "../reference-1/fiches";

const DOSSIER = join(__dirname, "..", "temoins");

export const FICHES_REFERENCE_2 = ["reponses-types", "relances", "taches-repetitives", "habitude-equipe", "consigne-ia"] as const;
export type NomFicheReference2 = (typeof FICHES_REFERENCE_2)[number];

/** La fiche brute, telle qu'écrite (au style « reference/2 »). */
export function ficheReference2Brute(nom: NomFicheReference2): FicheTableau {
  return JSON.parse(readFileSync(join(DOSSIER, `fiche-${nom}-reference-2.json`), "utf8")) as FicheTableau;
}

/** La fiche remise en forme comme en production. */
export function ficheReference2(nom: NomFicheReference2): FicheTableau {
  return remettreEnForme(ficheReference2Brute(nom));
}
