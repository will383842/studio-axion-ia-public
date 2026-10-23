/**
 * CHAÎNE « ÉQUIPE » · 4. RELECTEUR UNIQUE (Opus, effort moyen : la même famille de modèle que les rôles d'écriture, il
 * RELIT le socle en cache au lieu de le réécrire). Reçoit les matières, le script et la grille ; JUGE sans réécrire, avec
 * une priorité fixe (conformité > positionnement > rétention > clarté et voix) ; rend au plus 5 corrections ciblées.
 * Le CODE les trie, les applique, refuse celle qui ferait perdre une citation d'ancrage (`garderCitationsAncrage`), qui
 * dirait un nombre non prouvé ou qui enfreindrait une règle de Will, puis recontrôle la version.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigne, REGLE_DONNEES, REGLE_RIEN_INVENTE } from "./commun";
import { REGLES_WILL } from "./equipe-commun";
import type { Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/** Les axes de la grille, dans l'ORDRE DE PRIORITÉ fixe. */
export const AXES_RELECTURE = ["conformite", "positionnement", "retention", "clarte-voix"] as const;
export type AxeRelecture = (typeof AXES_RELECTURE)[number];
export const CORRECTIONS_MAX = 5;

export const schemaEquipeRelecteur = z.object({
  verdicts: z.array(z.object({ axe: z.enum(AXES_RELECTURE), ok: z.boolean(), remarque: z.string() })),
  corrections: z.array(
    z.object({
      axe: z.enum(AXES_RELECTURE),
      ou: z.enum(["accroche", "segment"]),
      /** Index du segment du corps (`ou` = segment). */
      segmentIndex: z.number().int().optional(),
      /** Le texte de remplacement (vide : supprimer le segment). */
      texte: z.string(),
      motif: z.string(),
    }),
  ),
});
export type SortieEquipeRelecteur = z.infer<typeof schemaEquipeRelecteur>;
export type CorrectionEquipe = SortieEquipeRelecteur["corrections"][number];

export const EVALUATIONS_EQUIPE_RELECTEUR: readonly Evaluation<SortieEquipeRelecteur>[] = [
  { id: "EQR-01", texte: `${CORRECTIONS_MAX} corrections au plus`, verifier: (s) => (s.corrections.length > CORRECTIONS_MAX ? [`${s.corrections.length} corrections`] : []) },
  { id: "EQR-02", texte: "un verdict par axe de la grille", verifier: (s) => AXES_RELECTURE.filter((a) => !s.verdicts.some((v) => v.axe === a)).map((a) => `axe ${a} sans verdict`) },
  { id: "EQR-03", texte: "chaque correction de segment a son index", verifier: (s) => s.corrections.filter((x) => x.ou === "segment" && x.segmentIndex === undefined).map((x) => `correction sans index : ${x.motif}`) },
];

/** Les corrections dans l'ordre de priorité fixe (stable à priorité égale), coupées à `CORRECTIONS_MAX`. */
export function trierCorrections(corrections: readonly CorrectionEquipe[]): CorrectionEquipe[] {
  return corrections
    .map((x, i) => ({ x, i }))
    .sort((a, b) => AXES_RELECTURE.indexOf(a.x.axe) - AXES_RELECTURE.indexOf(b.x.axe) || a.i - b.i)
    .slice(0, CORRECTIONS_MAX)
    .map((y) => y.x);
}

export const CONSIGNE_EQUIPE_RELECTEUR = consigne(
  "Tu es le RELECTEUR UNIQUE d'Axion-IA. Tu relis le script d'une courte vidéo tel qu'il sera dit (<accroche>, <corps>, <appel>, <boucle>), avec les <matiere> citées pour vérifier les citations et la <grille> du format. Tu JUGES : tu ne réécris pas le script.",
  "PRIORITÉ FIXE, dans cet ordre : 1. CONFORMITÉ (rien d'inventé, chiffres prouvés, citations mot pour mot, règles de Will) ; 2. POSITIONNEMENT (une seule cible, ce que NOUS mettons en place, aucun « faites-le vous-même ») ; 3. RÉTENTION (gain livré tôt, relance au milieu, rien après l'appel, aucune phrase molle) ; 4. CLARTÉ ET VOIX (phrases de 14 mots au plus, ton oral de Will, aucun tic d'IA). Un défaut d'un axe plus haut passe toujours avant.",
  "`verdicts` : un par axe (`ok`, et la remarque en une phrase). <alertes_code> liste ce que le code a déjà relevé : vérifie-le.",
  `\`corrections\` : ${CORRECTIONS_MAX} au plus, CIBLÉES (une phrase, un segment), chacune avec son axe : \`ou\` = accroche ou segment (\`segmentIndex\`), \`texte\` = le remplacement (vide pour supprimer un segment), \`motif\`. L'appel est fixé par le code : jamais corrigé.`,
  "Si <alertes_code> relève une REPETITION : supprime la répétition, ne réécris pas le reste ; une correction qui ajoute une répétition est refusée par le code.",
  "Une correction ne fait que corriger, couper ou resserrer : aucun fait, aucun chiffre, aucune promesse ajoutés. Une matière citée mot pour mot (comparée à sa <matiere>) reste telle quelle : une correction qui la ferait perdre est refusée par le code. « [LIMITE À VALIDER] » reste tel quel.",
  "Si <fiche_cible> est fournie, relis DANS LA PEAU DE LA CIBLE (<cible> et <fiche_cible>) : reconnaît-elle sa journée, ses mots (<mots_de_la_cible>) ? Ses objections (<objections_de_la_cible>) restent-elles sans réponse ? Une phrase d'une autre taille ou d'un autre métier est un défaut de POSITIONNEMENT (UNE vidéo = UNE cible). Tu ne fais entrer aucun mot, fait ni chiffre qui ne soit déjà dans le script ou les <matiere>.",
  REGLES_WILL,
  REGLE_RIEN_INVENTE,
  REGLE_DONNEES,
);

export const roleEquipeRelecteur: DefinitionRole<typeof schemaEquipeRelecteur> = {
  id: "equipe-relecteur",
  version: 2,
  consigne: CONSIGNE_EQUIPE_RELECTEUR,
  schema: schemaEquipeRelecteur,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 6000,
  simuler() {
    // Simulation : aucune relecture réelle, aucune correction.
    return { verdicts: AXES_RELECTURE.map((axe) => ({ axe, ok: true, remarque: "Simulation : aucune relecture réelle." })), corrections: [] };
  },
};
