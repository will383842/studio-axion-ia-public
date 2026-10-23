/**
 * RÔLE 5 · PLAN DE SCRIPT (plan v5 B.3.5 étape 5 ; K1, K4, K6, K9, K16, K18, K19, K23, K24 ; §2 bis à §2 quinquies ; lot G4).
 * Opus, effort `high` (au banc G4, `medium` rendait des plans de 2-3 segments). Aucune prose : un plan typé, contrôlé par le code (étape 6) AVANT toute phrase.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigne, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECIT, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, schemaArret, schemaMarqueur, schemaNature } from "./commun";
import { idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_PLAN: readonly Evaluation<SortiePlan>[] = [
  { id: "PLN-01", texte: "une accroche en tête, au plus un appel en fin", verifier: (s) => (s.arret ? [] : [s.segments[0]?.partie !== "accroche" ? "pas d'accroche en tête" : null, s.segments.filter((x) => x.partie === "appel").length > 1 ? "plusieurs appels" : null].filter((x): x is string => !!x)) },
  { id: "PLN-02", critique: true, texte: "appui principal, livraison et coût placés", verifier: (s) => (s.arret ? [] : [!s.segments[s.appuiPrincipalIndex] ? "appui hors plan" : null, !s.segments[s.livraisonIndex]?.fonction.includes("livraison") ? "livraison non marquée" : null, !s.segments.some((x) => x.fonction.includes("cout")) ? "coût jamais placé" : null].filter((x): x is string => !!x)) },
  { id: "PLN-08", critique: true, texte: "5 segments de corps au moins", verifier: (s) => (s.arret || s.segments.filter((x) => x.partie === "corps").length >= 5 ? [] : [`${s.segments.filter((x) => x.partie === "corps").length} segments de corps (5 au moins)`]) },
  { id: "PLN-03", critique: true, texte: "aucune preuve ni matière inventée", verifier: (s, c) => s.segments.flatMap((x) => [...idsInconnus(x.preuveIds, c.preuveIds), ...idsInconnus(x.matiereIds, c.matiereIds)]).map((x) => `id inconnu ${x}`) },
  { id: "PLN-04", texte: "au plus 2 « solution » de suite (C39)", verifier: (s) => (s.segments.some((_, i) => i >= 2 && [0, 1, 2].every((k) => s.segments[i - k].fonction.includes("solution"))) ? ["3 solutions de suite"] : []) },
  { id: "PLN-05", texte: "chaque segment du corps relié (K18)", verifier: (s) => s.segments.filter((x, i) => x.partie === "corps" && i > 1 && !x.lien).map((x) => `sans lien : ${x.resume}`) },
  { id: "PLN-06", texte: "une issue (solution, résultat, méthode)", verifier: (s) => (s.arret || s.segments.some((x) => x.fonction.some((f) => f === "solution" || f === "resultat" || f === "methode")) ? [] : ["aucune issue"]) },
  { id: "PLN-07", texte: "3 preuves dites au plus (K23)", verifier: (s) => (new Set(s.segments.flatMap((x) => x.preuveIds)).size > 3 ? [`${new Set(s.segments.flatMap((x) => x.preuveIds)).size} preuves dites`] : []) },
];

export const CONSIGNE_PLAN = consigne(
  "Tu fais le PLAN d'une courte vidéo d'Axion-IA dite face caméra. Pas une phrase de texte final : un résumé par segment. Le code contrôle ce plan avant toute prose.",
  "Suis la STRUCTURE de la combinaison retenue (fournie) et la recette (plafonds, débit). Un segment = une phrase-plan, une idée. Plan typé : `partie` (accroche, corps, appel), `fonction` (marqueurs), `nature` (fait, opinion, ressenti), preuves, matières, `citeMatiereId` quand le segment cite une matière mot pour mot.",
  "Le plan est COMPLET : l'accroche, puis 5 à 9 segments de corps (de quoi tenir 16 à 30 s), puis l'appel s'il y en a un. Le segment 0 est l'accroche finaliste fournie. L'APPUI PRINCIPAL est dit avant 10 s, au plus un appui secondaire, puis la LIVRAISON (marquée `livraison`, `promesseId` = celui de la promesse qu'elle tient). Le COÛT du problème est dans un segment marqué `cout` avant 5 s. Au plus 3 preuves dites ; les autres vont à l'écran ou dans la légende.",
  "La solution tient en 2 segments au plus : le reste, c'est ce que le client y a gagné. Chaque segment du corps, sauf le premier, est relié au précédent par une cause, une opposition ou une conséquence (`lien`). La question principale s'ouvre dans l'accroche (`ouvre`) et se ferme à la livraison (`ferme` = le même id), après 55 % et avant l'appel ; les autres `ouvre` / `ferme` sont facultatifs. Écris TOUS les segments jusqu'à la fin : `livraisonIndex` et `exceptionIndex` désignent des segments présents dans la liste.",
  "La dernière phrase d'information avant l'appel est une récompense (le fait le plus net), jamais une morale, ni le délai, ni le coût. L'appel est facultatif ; s'il existe, il porte l'objectif du sujet. Dans une structure de verdict, n'apaise que face à une menace ; sinon ouvre sur le verdict, avec un geste concret tiré d'une matière avant 5 s.",
  "LIMITE : ne la rédige jamais toi-même. Si le fond fournit une limite de matière, place-la (`exceptionIndex`) juste après l'affirmation qu'elle restreint ; si elle n'est que proposée, mets `exceptionIndex` à -1.",
  REGLE_PROBLEME,
  REGLE_RECIT,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  REGLE_DONNEES,
);

export const schemaPlan = z.object({
  arret: schemaArret.optional(),
  segments: z.array(
    z.object({
      partie: z.enum(["accroche", "corps", "appel"]),
      fonction: z.array(schemaMarqueur),
      nature: schemaNature,
      resume: z.string(),
      preuveIds: z.array(z.string()),
      matiereIds: z.array(z.string()),
      citeMatiereId: z.string().optional(),
      ouvre: z.object({ id: z.string(), question: z.string() }).optional(),
      ferme: z.string().optional(),
      lien: z.enum(["cause", "opposition", "consequence"]).optional(),
      promesseId: z.string().optional(),
      situation: z.enum(["menace", "neutre"]).optional(),
    }),
  ),
  exceptionIndex: z.number().int(),
  ancrageIndex: z.array(z.number().int()),
  appuiPrincipalIndex: z.number().int(),
  livraisonIndex: z.number().int(),
});
export type SortiePlan = z.infer<typeof schemaPlan>;

export const rolePlan: DefinitionRole<typeof schemaPlan> = {
  id: "plan",
  version: 1,
  consigne: CONSIGNE_PLAN,
  schema: schemaPlan,
  modele: MODELE_ECRITURE,
  effort: "high",
  maxTokens: 8000,
  simuler(entree) {
    const l = lireVariable(entree.variable, entree.contexte.preuves);
    const m = l.matieres[0];
    const p = m?.preuve ?? l.preuves[0];
    const limite = l.matieres.find((x) => x.type === "limite");
    const seg = (partie: "accroche" | "corps" | "appel", fonction: z.infer<typeof schemaMarqueur>[], resume: string, extra: Partial<SortiePlan["segments"][number]> = {}) => ({ partie, fonction, nature: "fait" as const, resume, preuveIds: [], matiereIds: [], ...extra });
    const segments = [
      seg("accroche", ["cout", "ancrage"], "Accroche finaliste", { matiereIds: m ? [m.id] : [], ouvre: { id: "q1", question: "Que s'est-il passé ?" } }),
      seg("corps", ["preuve"], "L'appui : la matière ou la preuve fournie", { preuveIds: p ? [p] : [] }),
      seg("corps", ["relance"], "Pourquoi la tâche coûte", { lien: "cause" }),
      seg("corps", ["solution"], "Ce qu'on retire de la tâche", { lien: "consequence" }),
      seg("corps", limite ? ["exception"] : ["relance"], limite ? "La limite de Will" : "Ce que ça change pour l'équipe", { lien: "opposition", matiereIds: limite ? [limite.id] : [], citeMatiereId: limite?.id }),
      seg("corps", ["livraison", "resultat"], "La tâche ne prend plus de temps", { lien: "consequence", ferme: "q1", promesseId: "p1" }),
      seg("appel", ["cta"], "L'appel"),
    ];
    return { segments, exceptionIndex: limite ? 4 : -1, ancrageIndex: [0], appuiPrincipalIndex: 1, livraisonIndex: 5 };
  },
};
