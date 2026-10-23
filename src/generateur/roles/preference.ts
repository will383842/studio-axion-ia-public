/**
 * RÔLE PRÉFÉRENCE · PREF-01 (plan v5 B.3.5 étape 9, duel des deux corps ; B.7.4 ; lot G4).
 * Sonnet, effort `medium`, lu dans les DEUX ordres (A/B puis B/A) ; seul le gagnant continue.
 */
import { z } from "zod";
import { MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { consigne, REGLE_DONNEES } from "./commun";
import type { Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_PREFERENCE: readonly Evaluation<SortiePreference>[] = [
  { id: "PRF-01", texte: "une raison citée", verifier: (s) => (s.raison.trim() ? [] : ["raison absente"]) },
];

export const CONSIGNE_PREFERENCE = consigne(
  "Tu es un dirigeant de PME pressé, sceptique, qui fait défiler des vidéos courtes. On te montre deux textes dits face caméra, A et B, sur le même sujet.",
  "Lequel regarderais-tu jusqu'au bout ET enverrais-tu à quelqu'un de ton entourage professionnel ? Réponds « A », « B » ou « egal », avec la raison en une phrase qui cite le passage décisif.",
  REGLE_DONNEES,
);

export const schemaPreference = z.object({ preference: z.enum(["A", "B", "egal"]), raison: z.string() });
export type SortiePreference = z.infer<typeof schemaPreference>;

export function variablePreference(a: string, b: string): string {
  return `<texte id="A">\n${a}\n</texte>\n<texte id="B">\n${b}\n</texte>`;
}

export const rolePreference: DefinitionRole<typeof schemaPreference> = {
  id: "preference",
  version: 1,
  consigne: CONSIGNE_PREFERENCE,
  schema: schemaPreference,
  modele: MODELE_JUGE,
  effort: "medium",
  maxTokens: 3000,
  simuler() {
    return { preference: "A", raison: "Simulation : le premier texte." };
  },
};

/** Résultat du duel lu dans les deux ordres (le 2e appel a reçu B en « A »). */
export function gagnantDuel(ordreAB: SortiePreference["preference"], ordreBA: SortiePreference["preference"]): "A" | "B" | "egal" {
  const ba = ordreBA === "A" ? "B" : ordreBA === "B" ? "A" : "egal";
  if (ordreAB === ba) return ordreAB;
  if (ordreAB === "egal") return ba;
  if (ba === "egal") return ordreAB;
  return "egal";
}
