/**
 * CHAÎNE « ÉQUIPE » · 1. RÉDACTEUR EN CHEF (Opus, effort moyen). Reçoit la douleur et la matière citée, la preuve, la
 * structure choisie par l'étape 0, l'objectif, le réseau, le format et la cible (calculés par le code) ; rend l'angle,
 * la cible précise, la promesse en une phrase, UNE idée, la preuve retenue et le test « un influenceur IA pourrait-il
 * dire cela ? » (oui : la chaîne lui redemande un nouvel angle, une fois).
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { capitale, consigne, lireVariable, REGLE_DONNEES, REGLE_PROBLEME, REGLE_RECONNAISSANCE, REGLE_RIEN_INVENTE, regleTon, schemaArret, sujetSimule } from "./commun";
import { REGLES_WILL, violationsReglesWill } from "./equipe-commun";
import { ditNonProuve, idsInconnus, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

export const schemaEquipeChef = z.object({
  arret: schemaArret.optional(),
  angle: z.string(),
  ciblePrecise: z.string(),
  promesse: z.string(),
  idee: z.string(),
  douleur: z.string(),
  preuveRetenue: z.object({ preuveId: z.string().optional(), matiereId: z.string().optional(), texte: z.string() }),
  testInfluenceur: z.object({ reponse: z.enum(["oui", "non"]), raison: z.string() }),
});
export type SortieEquipeChef = z.infer<typeof schemaEquipeChef>;

const mots = (t: string) => t.split(/\s+/).filter(Boolean).length;

export const EVALUATIONS_EQUIPE_CHEF: readonly Evaluation<SortieEquipeChef>[] = [
  { id: "EQC-01", critique: true, texte: "preuve retenue prise dans les données", verifier: (s, c) => (s.arret ? [] : [...idsInconnus(s.preuveRetenue.preuveId ? [s.preuveRetenue.preuveId] : [], c.preuveIds), ...idsInconnus(s.preuveRetenue.matiereId ? [s.preuveRetenue.matiereId] : [], c.matiereIds)].map((x) => `id inconnu ${x}`)) },
  { id: "EQC-02", texte: "promesse en une phrase de 25 mots au plus", verifier: (s) => (s.arret || (mots(s.promesse) <= 25 && s.promesse.split(/(?<=[.!?…])\s+/).filter(Boolean).length <= 1) ? [] : [`promesse « ${s.promesse} »`]) },
  { id: "EQC-03", critique: true, texte: "aucun nombre non prouvé", verifier: (s, c) => [s.angle, s.promesse, s.idee].flatMap((t) => ditNonProuve(t, c)).map((x) => `« ${x} » non prouvé`) },
  { id: "EQC-04", texte: "règles de Will tenues", verifier: (s) => [s.angle, s.promesse, s.idee].flatMap((t) => violationsReglesWill(t)).map((v) => `${v.id} : ${v.texte}`) },
];

export const CONSIGNE_EQUIPE_CHEF = consigne(
  "Tu es le RÉDACTEUR EN CHEF d'Axion-IA. Avant toute écriture, tu décides de quoi parle cette courte vidéo, au format de la <recette>, pour UN réseau (<reseau>).",
  "Le CODE a déjà tranché, tu ne changes rien : la structure (<structure_imposee>), l'objectif de la vidéo (<objectif_video> : notoriete, conversation ou diagnostic) et la cible (<cible> : une taille, et une fonction si le brief en donne une).",
  "Tu rends : `angle` (la prise de position, en une phrase), `ciblePrecise` (qui, dans cette taille d'entreprise, vit le problème, en gestes concrets), `promesse` (ce que le spectateur saura ou verra à la fin, UNE phrase de 25 mots au plus), `idee` (UNE seule idée, jamais deux), `douleur` (le problème vécu, tiré des <matiere>), `preuveRetenue` (UNE preuve ou matière fournie qui porte l'idée : son id et ce qu'elle dit, mot pour mot).",
  "ÉPREUVE : « un influenceur IA pourrait-il dire cela ? ». Réponds `oui` si l'angle tient sans Axion-IA (une astuce, une liste d'outils, un tutoriel, une actualité) ; `non` s'il repose sur ce que NOUS mettons en place, pour cette cible, avec la preuve retenue. Donne la raison. Si <angle_refuse> est fourni, cet angle a échoué à cette épreuve : trouve un angle VRAIMENT nouveau.",
  "UNE VIDÉO = UNE CIBLE. Si <fiche_cible> est fournie (lue dans les bases de l'Usine), `ciblePrecise` part d'elle : qui décide dans cette taille, comment on lui parle, ce que veut ce métier. La douleur nommée (<douleur_nommee>) est celle de la vidéo : tu la gardes TELLE QUELLE dans `douleur`, seule son intensité (ce qu'elle coûte, à quel point elle pèse) varie ; tu n'en choisis pas une autre. Sans <douleur_nommee>, tire-la des <matiere> comme avant.",
  REGLES_WILL,
  REGLE_PROBLEME,
  REGLE_RECONNAISSANCE,
  REGLE_RIEN_INVENTE,
  regleTon(true),
  "Si rien ne tient sans inventer, remplis `arret` avec ANCRAGE_MANQUANT (ou PREUVE_MANQUANTE) et la raison.",
  REGLE_DONNEES,
);

export const roleEquipeChef: DefinitionRole<typeof schemaEquipeChef> = {
  id: "equipe-chef",
  version: 2,
  consigne: CONSIGNE_EQUIPE_CHEF,
  schema: schemaEquipeChef,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 6000,
  simuler(entree) {
    // Simulation : un angle tiré du sujet et de la 1re matière fournie (aucun fait inventé, aucun appel).
    const l = lireVariable(entree.variable);
    const s = sujetSimule(l.idee);
    const m = l.matieres[0];
    if (!m) return { arret: { code: "ANCRAGE_MANQUANT", raison: "Aucune matière vraie fournie." }, angle: "", ciblePrecise: "", promesse: "", idee: "", douleur: "", preuveRetenue: { texte: "" }, testInfluenceur: { reponse: "non", raison: "" } };
    const cible = /<cible taille="([^"]+)"/.exec(entree.variable)?.[1] ?? "PME";
    const refus = /<angle_refuse>/.test(entree.variable);
    return {
      angle: refus ? `${capitale(s.possessif)} : ce qu'on retire en premier` : `${capitale(s.possessif)} : le coût que personne ne compte`,
      ciblePrecise: `Le dirigeant de ${cible} qui gère ${s.possessif3} lui-même`,
      promesse: `Vous verrez ce qu'on met en place pour ${s.possessif}.`,
      idee: `${capitale(s.court)} se supprime.`,
      douleur: m.texte,
      preuveRetenue: { matiereId: m.id, texte: m.texte },
      testInfluenceur: { reponse: "non", raison: "Simulation : l'angle repose sur la matière fournie." },
    };
  },
};
