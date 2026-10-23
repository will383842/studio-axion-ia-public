/**
 * Cas de test : un cas de master dont l'étape 4 se passe dans la console (derrière une connexion). P3 ne dépend pas des
 * cas de la phase 2 (P2) : le test fabrique lui-même l'étape à fournir, sans toucher au catalogue.
 */
import type { CasConcret } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";

export const ID_CAS_CONSOLE = "recrutement-apporteurs";
export const ETAPE_CONSOLE = 4;

export function casConsole(): CasConcret {
  const cas = structuredClone(trouverCas(ID_CAS_CONSOLE)!);
  const e = cas.etapes[ETAPE_CONSOLE - 1];
  cas.etapes[ETAPE_CONSOLE - 1] = { ...e, titre: "La session", ligne: "La session est créée dans la console.", detail: "Une personne la crée, et tout le reste suit." };
  return cas;
}
