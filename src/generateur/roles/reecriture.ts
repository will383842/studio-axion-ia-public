/**
 * RÔLE 10 · RÉÉCRITURE CIBLÉE (plan v5 B.3.5 étape 10 ; C1 ter ; lot G4).
 * Opus, effort `medium`. Seulement les segments en cause, 5 corrections au plus par passe, 2 tours au plus ;
 * déclenchée par les violations du code (avant G5). Ne fait que corriger ou RACCOURCIR : jamais allonger, rien ajouter.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigne, REGLE_DONNEES, REGLE_RIEN_INVENTE, regleTon, schemaMarqueur } from "./commun";
import { ditNonProuve, type Evaluation } from "./evaluation";
import type { DefinitionRole } from "./types";

/* Évaluations (écrites AVANT la consigne) */
export const EVALUATIONS_REECRITURE: readonly Evaluation<SortieReecriture>[] = [
  { id: "REE-01", texte: "5 corrections au plus", verifier: (s) => (s.corrections.length > 5 ? [`${s.corrections.length} corrections`] : []) },
  { id: "REE-02", critique: true, texte: "aucun nombre non prouvé", verifier: (s, c) => s.corrections.flatMap((x) => ditNonProuve(x.texte, c)).map((x) => `« ${x} » non prouvé`) },
];

export const CONSIGNE_REECRITURE = consigne(
  "Tu corriges un texte dit face caméra, segment par segment, à partir des défauts relevés par le code (<defaut segment=…>).",
  "Corrige SEULEMENT les segments en cause, 5 au plus. Pour chacun, renvoie son index et son nouveau texte (et ses marqueurs s'ils changent). Si un segment doit disparaître, renvoie un texte vide.",
  "Tu ne fais que corriger ou raccourcir : n'ajoute aucun fait, aucun chiffre, aucune promesse ; ne touche pas aux segments sains ; ne change pas le sens d'une matière citée mot pour mot.",
  REGLE_RIEN_INVENTE,
  regleTon(),
  REGLE_DONNEES,
);

export const schemaReecriture = z.object({
  corrections: z.array(z.object({ segmentIndex: z.number().int(), texte: z.string(), marqueurs: z.array(schemaMarqueur).optional(), motif: z.string() })),
});
export type SortieReecriture = z.infer<typeof schemaReecriture>;

export const roleReecriture: DefinitionRole<typeof schemaReecriture> = {
  id: "reecriture",
  version: 1,
  consigne: CONSIGNE_REECRITURE,
  schema: schemaReecriture,
  modele: MODELE_ECRITURE,
  effort: "medium",
  maxTokens: 6000,
  simuler(entree) {
    // Simulation : retire les segments en cause qui ne sont pas cités mot pour mot (aucune invention possible).
    const defauts = [...entree.variable.matchAll(/<defaut segment="(\d+)"/g)].map((m) => Number(m[1]));
    return { corrections: [...new Set(defauts)].slice(0, 5).map((i) => ({ segmentIndex: i, texte: "", motif: "Simulation : segment retiré." })) };
  },
};
