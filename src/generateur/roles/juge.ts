/**
 * RÔLE JUGE (plan v5 B.3.5 étapes 4, 9, 11 et 12 ; B.7.4 ; lot G4).
 * Sonnet, distinct du rédacteur Opus, effort `medium`. Questions oui/non versionnées (`questions.ts`), une sortie
 * structurée par tirage ; le code fait le total. Un juge servi par Opus (repli) est indicatif d'office. Il ÉLIMINE.
 */
import { z } from "zod";
import { MODELE_JUGE } from "@/fournisseurs/claude/tarifs";
import { consigne, REGLE_DONNEES } from "./commun";
import type { Evaluation } from "./evaluation";
import { QUESTIONS_JUGES, type QuestionJuge } from "./questions";
import type { DefinitionRole } from "./types";

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_JUGE: readonly Evaluation<SortieJuge>[] = [
  { id: "JUG-01", critique: true, texte: "une réponse par question posée et par élément", verifier: (s) => s.elements.filter((e) => !e.reponses.length).map((e) => `élément ${e.id} sans réponse`) },
  { id: "JUG-02", texte: "questions connues seulement", verifier: (s) => s.elements.flatMap((e) => e.reponses.filter((r) => !QUESTIONS_JUGES.some((q) => q.id === r.id)).map((r) => `question inconnue ${r.id}`)) },
];

export const CONSIGNE_JUGE = consigne(
  "Tu es un juge exigeant et indépendant : un directeur éditorial qui a vu des milliers de courtes vidéos d'experts. Tu ne réécris rien.",
  "Pour CHAQUE élément fourni (<element id=…>), réponds à CHAQUE question (<question id=…>) par « oui », « non » ou « sans-objet », avec un motif de 12 mots au plus qui cite le passage en cause. Juge le texte tel qu'il est dit, avec les preuves et matières fournies : un fait absent des données est une invention.",
  "Sois strict : en cas de doute, la réponse est celle qui élimine.",
  REGLE_DONNEES,
);

export const schemaJuge = z.object({
  elements: z.array(
    z.object({
      id: z.string(),
      reponses: z.array(z.object({ id: z.string(), reponse: z.enum(["oui", "non", "sans-objet"]), motif: z.string() })),
    }),
  ),
});
export type SortieJuge = z.infer<typeof schemaJuge>;

/** Partie variable d'un appel de juge : les éléments à juger et les questions. */
export function variableJuge(elements: { id: string; texte: string }[], questions: readonly QuestionJuge[], contexte = ""): string {
  return [
    contexte,
    ...elements.map((e) => `<element id="${e.id}">\n${e.texte}\n</element>`),
    ...questions.map((q) => `<question id="${q.id}">${q.texte}</question>`),
  ]
    .filter(Boolean)
    .join("\n");
}

export const roleJuge: DefinitionRole<typeof schemaJuge> = {
  id: "juge",
  version: 1,
  consigne: CONSIGNE_JUGE,
  schema: schemaJuge,
  modele: MODELE_JUGE,
  effort: "medium",
  maxTokens: 5000,
  simuler(entree) {
    const ids = [...entree.variable.matchAll(/<element id="([^"]+)"/g)].map((m) => m[1]);
    const qs = [...entree.variable.matchAll(/<question id="([^"]+)"/g)].map((m) => m[1]);
    return {
      elements: ids.map((id) => ({
        id,
        reponses: qs.map((q) => ({ id: q, reponse: QUESTIONS_JUGES.find((x) => x.id === q)?.attendu ?? ("oui" as const), motif: "Simulation." })),
      })),
    };
  },
};
