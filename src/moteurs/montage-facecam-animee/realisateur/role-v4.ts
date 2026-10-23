/**
 * RÔLE CLAUDE du réalisateur v4 (Lot I, 17/10/2026) — PUR. Branche `realiser` sur le chemin de dépense du studio
 * (`executerRolePourVideo` : plafond de la vidéo, limite du mois, pré-vol, réservation, coût réel).
 *
 * La consigne est celle du réalisateur (`consigneRealisateur`, catalogue v4) ; la forme de la réponse est donnée en JSON
 * (`envoi.schema` = `schemaSortieRealisateur`, posé dans la consigne). Le rôle ne valide RIEN lui-même (`schema` ouvert) :
 * `realiser` lit la réponse avec zod puis `verifierPlan`, et renvoie la liste EXACTE des erreurs à l'essai suivant.
 */
import { z } from "zod";
import type { DefinitionRole } from "@/generateur/roles/types";
import { MODELE_ECRITURE } from "@/fournisseurs/claude/tarifs";
import { consigneRealisateur } from "./consignes";
import { schemaSortieRealisateur, type RequeteRealisateur } from "./index";
import type { HistoriqueVideo } from "./regles";

/**
 * Plafond de SORTIE (pensée adaptative COMPRISE). Relevé du 17/10 (v-0b4613576e9b) : à 24 000 et effort `high`, 3 appels
 * sur 3 ont coûté 0,46 € chacun = ≈ 24 000 jetons × 20 $/M : la pensée mangeait le plafond, le JSON était coupé, jamais lu.
 * Un plan de 80 s ≈ 40 plaquettes ≈ 8 000 jetons : 32 000 laissent ≈ 24 000 à la pensée (effort `medium`).
 */
export const MAX_JETONS_REALISATEUR_V4 = 32_000;
export const DELAI_TOTAL_REALISATEUR_V4_MS = 900_000;

/** Longueur au plus d'une recherche de média (même borne que le schéma du plan). */
export const RECHERCHE_MAX_V4 = 60;
/** Longueur au plus d'un mot affiché par une plaquette (même borne que le schéma du plan). */
export const MOT_MAX_V4 = 40;

/**
 * Une recherche de média trop longue (essai réel du 18/10 : « elementsV4[15].recherches[0] : 61 caractères ») faisait refuser
 * tout le plan, 3 fois de suite, pour une requête sans conséquence : elle est raccourcie à la fin d'un mot. PUR ; le reste est intact.
 */
export function rognerRecherchesV4(brut: unknown): unknown {
  if (!brut || typeof brut !== "object" || !Array.isArray((brut as { elementsV4?: unknown }).elementsV4)) return brut;
  const rogner = (t: string, max: number) => {
    if (t.length <= max) return t;
    const coupe = t.slice(0, max);
    const i = coupe.lastIndexOf(" ");
    return (i > max * 0.5 ? coupe.slice(0, i) : coupe).trim();
  };
  // Chaînes vides retirées (essai réel du 18/10 : « elementsV4[3].mots[0] : trop court », plan refusé 3 fois), textes trop longs rognés.
  const nettoyer = (liste: unknown[], max: number) => liste.flatMap((r) => (typeof r !== "string" ? [r] : r.trim() ? [rogner(r.trim(), max)] : []));
  const elements = (brut as { elementsV4: unknown[] }).elementsV4.map((e) => {
    if (!e || typeof e !== "object") return e;
    const o = e as { recherches?: unknown; mots?: unknown };
    return {
      ...(e as object),
      ...(Array.isArray(o.recherches) ? { recherches: nettoyer(o.recherches, RECHERCHE_MAX_V4) } : {}),
      ...(Array.isArray(o.mots) ? { mots: nettoyer(o.mots, MOT_MAX_V4) } : {}),
    };
  });
  return { ...(brut as object), elementsV4: elements };
}

export function roleRealisateurV4(historique: readonly HistoriqueVideo[] = []): DefinitionRole {
  return {
    id: "realisateur-facecam-animee",
    version: 4,
    consigne: consigneRealisateur([...historique]),
    schema: z.unknown(),
    envoi: { schema: schemaSortieRealisateur, lire: (brut) => ({ valeur: rognerRecherchesV4(brut), remarques: [] }) },
    modele: MODELE_ECRITURE,
    // `low` : sur une prise de 2 min 10 (essai réel du 18/10), `medium` épuisait les 32 000 jetons dans la pensée (stopReason=max_tokens, sortie vide, 3 essais payés pour rien).
    effort: "low",
    maxTokens: MAX_JETONS_REALISATEUR_V4,
    // Une longue prise (2 min 10) demande plus de 300 s de pensée + JSON : 15 min au plus (la pause sans nouvelles reste 150 s).
    delaiTotalMs: DELAI_TOTAL_REALISATEUR_V4_MS,
    // Sans Claude relié : aucune sortie (le service rend « indisponible », `realiser` fait la version simple).
    simuler: () => ({}),
  };
}

/** La requête de `realiser` (consigne + message) → l'entrée du rôle (le message est la partie variable). */
export function entreeRoleRealisateurV4(requete: RequeteRealisateur): { contexte: Record<string, never>; variable: string } {
  return { contexte: {}, variable: requete.message };
}
