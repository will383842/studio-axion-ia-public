/**
 * Rôle « sonde » (lot G0) : le plus petit appel utile, pour l'essai réel (`outils/generateur/essai-claude.mts`) et les
 * tests. Une phrase, sortie structurée, effort bas : quelques millièmes de dollar.
 */
import { z } from "zod";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import type { DefinitionRole } from "./types";

export const schemaSonde = z.object({ phrase: z.string() });

export const roleSonde: DefinitionRole<typeof schemaSonde> = {
  id: "sonde",
  version: 1,
  consigne: "Tu vérifies le branchement du studio vidéo Axion-IA. Réponds par une seule phrase courte, en français, qui reprend le sujet donné.",
  schema: schemaSonde,
  modele: MODELE_ECRITURE,
  effort: "low",
  maxTokens: 1024,
  simuler(entree) {
    return { phrase: `Essai : ${entree.variable.trim().slice(0, 60)}` };
  },
};
