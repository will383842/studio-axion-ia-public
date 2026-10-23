/**
 * INSCRIPTION DU FOURNISSEUR « claude » (lot G0, plan v5 B.0 n° 53-54, B.1) — sur le modèle de `heygen/inscription.ts`.
 *
 * - `scriptClaude()` n'inscrit Claude que si `ANTHROPIC_API_KEY` existe ; il s'active ensuite par le réglage
 *   « fournisseur.script » ou `FOURNISSEUR_SCRIPT=claude` (sinon : simulation).
 * - La ligne `...scriptClaude()` dans `fournisseurs/index.ts` est posée (correctif `docs/correctifs/G0-inscription-
 *   scriptClaude.patch`, appliqué au lot G4c).
 * - Les ANCIENNES méthodes (`generer`, `noter`, `ameliorerBloc`, `accroches`…) restent DÉLÉGUÉES à la simulation : elles
 *   ne passent pas par le pré-vol de la brique Crédits, elles ne dépensent donc jamais (B.0 n° 54).
 * - `executerRole` est le SEUL point qui appelle Claude, et il n'est appelé que par `services/generation-claude.ts`,
 *   APRÈS le pré-vol et la réservation.
 */
import "server-only";
import type { z } from "zod";
import { fournisseurScriptSimulation } from "../simulation/script";
import { fournisseurTexteReseauxSimulation } from "../simulation/autres";
import type { FournisseurScript, FournisseurTexteReseaux } from "../types";
import { restaurerNulls } from "@/generateur/roles/schema-api";
import { construireRequete, marqueurArret, type DefinitionRole, type EntreeRole, type MarqueurArret } from "@/generateur/roles/types";
import { SOURCES_ABONNEMENT } from "@/domaine/source-claude";
import { envoyerMessage, type ReponseClaude } from "./client";

export const VARIABLE_CLE_CLAUDE = "ANTHROPIC_API_KEY";

export interface ResultatRole<T = unknown> {
  reponse: ReponseClaude;
  /** Sortie structurée validée par le schéma du rôle. */
  donnees?: T;
  /** Motif d'une sortie qui ne respecte pas le schéma (réécriture ciblée en G4, jamais un appel identique). */
  invalide?: string;
  /** Éléments écartés par la lecture de l'enveloppe (`role.envoi`), avec leur motif. */
  ecartees?: string[];
  marqueur?: MarqueurArret;
}

export interface FournisseurScriptClaude extends FournisseurScript {
  executerRole<S extends z.ZodType>(role: DefinitionRole<S>, entree: EntreeRole): Promise<ResultatRole<z.infer<S>>>;
}

/**
 * Pourquoi une réponse n'est pas du JSON (PUR sauf le journal serveur) : « coupée » quand Claude a atteint `max_tokens`
 * (la pensée + le JSON dépassent le plafond de sortie), sinon « pas du JSON ». Le journal garde la raison d'arrêt, les
 * jetons et les 300 premiers caractères, pour qu'une panne se diagnostique sans nouvel appel payant.
 */
export function motifSortieIllisible(idRole: string, reponse: ReponseClaude): string {
  const coupee = reponse.stopReason === "max_tokens";
  console.warn(`[studio] rôle ${idRole} : réponse illisible (stopReason=${reponse.stopReason ?? "?"}, jetons sortie=${reponse.jetons.sortie}, entrée=${reponse.jetons.entree}) : « ${reponse.texte.slice(0, 300).replace(/\s+/g, " ")} »`);
  return coupee
    ? `Réponse COUPÉE par la limite de sortie (max_tokens, ${reponse.jetons.sortie} jetons) : le plan JSON n'a pas pu être écrit en entier.`
    : `Sortie qui n'est pas du JSON (raison d'arrêt : ${reponse.stopReason ?? "inconnue"}).`;
}

/** Lit la sortie d'un rôle (PUR) : marqueur d'arrêt, JSON validé par le schéma. */
export function lireSortie<S extends z.ZodType>(role: DefinitionRole<S>, reponse: ReponseClaude): ResultatRole<z.infer<S>> {
  const marqueur = marqueurArret(reponse.texte);
  if (!role.schema) return { reponse, marqueur };
  let brut: unknown;
  try {
    brut = JSON.parse(reponse.texte);
  } catch {
    if (marqueur) return { reponse, marqueur };
    return { reponse, marqueur, invalide: motifSortieIllisible(role.id, reponse) };
  }
  // Enveloppe allégée (`role.envoi`) : dépliée et validée élément par élément, avant la validation du rôle.
  let ecartees: string[] = [];
  if (role.envoi) {
    try {
      const lu = role.envoi.lire(brut);
      brut = lu.valeur;
      ecartees = lu.remarques;
    } catch {
      return { reponse, marqueur, invalide: "Sortie illisible (enveloppe)." };
    }
  }
  const avec = ecartees.length ? { ecartees } : {};
  // Champs nullables envoyés facultatifs (`schemaJson`) : absents → null, puis la validation stricte du rôle.
  const r = role.schema.safeParse(restaurerNulls(role.schema, brut));
  if (!r.success) return { reponse, marqueur, ...avec, invalide: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" ; ").slice(0, 300) };
  return { reponse, marqueur, ...avec, donnees: r.data };
}

export function creerFournisseurScriptClaude(cle: string, appeler?: typeof fetch): FournisseurScriptClaude {
  return {
    ...fournisseurScriptSimulation,
    id: "claude",
    nom: "Claude",
    reelPrevu: "Claude",
    mode: "reel",
    // CORRECTEUR 1 — B7 : le résumé de la veille n'est PAS fait par Claude (aucun rôle écrit pour lui) : la méthode
    // simulée n'est pas héritée sous l'étiquette « réel ». La veille résume alors par les règles fixes, marquées simulées.
    resumerNouveaute: undefined,
    async executerRole(role, entree) {
      const reponse = await envoyerMessage(construireRequete(role, entree), { cle, fetch: appeler, ...(role.delaiTotalMs ? { delaiTotalMs: role.delaiTotalMs } : {}) });
      return lireSortie(role, reponse);
    },
  };
}

/** Première clé de compte d'abonnement posée (1, 2 ou 3) : Claude est inscrit dès qu'AU MOINS une l'est. */
function premiereCleDeCompte(env: Record<string, string | undefined>): string | undefined {
  return SOURCES_ABONNEMENT.map((s) => env[s.variable]?.trim()).find((c): c is string => !!c);
}

/** Inscription : `{ claude }` seulement si la clé existe sur le serveur. */
export function scriptClaude(env: Record<string, string | undefined> = process.env): Record<string, FournisseurScriptClaude> {
  const cle = premiereCleDeCompte(env);
  return cle ? { claude: creerFournisseurScriptClaude(cle) } : {};
}

/**
 * Lot R2 (plan « outils réels » du 03/10) : Claude pour les TEXTES DE PUBLICATION, inscrit seulement si la clé existe ;
 * il s'active par le réglage « fournisseur.texte-reseaux » ou `FOURNISSEUR_TEXTE_RESEAUX=claude`.
 * `ecrire` reste DÉLÉGUÉ à la simulation : il ne dépense jamais. Claude n'écrit un texte que par
 * `services/depense-claude-video.ts` (`executerRolePourVideo`, rôle `publication`), après le plafond de la vidéo, la
 * limite du mois, le pré-vol et la réservation — et seulement sur un geste prévu (suites de fabrication, « Réécrire »),
 * jamais à l'affichage.
 */
export function texteReseauxClaude(env: Record<string, string | undefined> = process.env): Record<string, FournisseurTexteReseaux> {
  const cle = premiereCleDeCompte(env);
  return cle ? { claude: { ...fournisseurTexteReseauxSimulation, id: "claude", nom: "Claude", reelPrevu: "Claude", mode: "reel" } } : {};
}
