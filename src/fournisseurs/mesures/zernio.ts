/**
 * STATISTIQUES ZERNIO PAR PUBLICATION (z4). LECTURE SEULE, via le client à liste fermée (GET /v1/analytics).
 *
 * Principe : une lecture ratée est « non lisible » ou « pas encore prête », JAMAIS zéro.
 *  - 200 avec chiffres        → valeurs (une statistique absente reste absente) ;
 *  - 202 (synchronisation en cours) → « pas encore prêtes » (à relire plus tard) ;
 *  - 424 (tous les réseaux en échec), 402 (offre sans statistiques), autre refus → « non lisible ».
 * Aucune écriture, aucune clé ici : le client la garde dans sa fermeture.
 */
import type { StatsPublication } from "@/domaine/types";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";

export type ResultatMesureZernio =
  | { etat: "lues"; valeurs: Partial<StatsPublication> & { portee?: number }; misesAJourLe?: string }
  | { etat: "pas-encore-pretes" }
  | { etat: "non-lisible"; raison: "indisponible-offre" | "echec-reseaux" | "refuse" | "illisible" | "reseau" };

export interface LecteurStatsZernio {
  mode: "reel" | "simulation";
  lire(postIdZernio: string): Promise<ResultatMesureZernio>;
}

/** Lecteur d'essai : ne lit rien, n'invente rien. */
export const lecteurZernioEssai: LecteurStatsZernio = { mode: "simulation", lire: async () => ({ etat: "non-lisible", raison: "indisponible-offre" }) };

function nombre(x: unknown): number | undefined {
  const n = typeof x === "string" ? Number.parseFloat(x) : x;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Réponse 200 d'un post → valeurs du studio (PUR). Null si aucun chiffre lisible. */
export function valeursDepuisAnalyticsZernio(corps: unknown): { valeurs: Partial<StatsPublication> & { portee?: number }; misesAJourLe?: string } | null {
  if (!corps || typeof corps !== "object") return null;
  const c = corps as Record<string, unknown>;
  const a = c.analytics && typeof c.analytics === "object" ? (c.analytics as Record<string, unknown>) : null;
  if (!a) return null;
  const valeurs: Partial<StatsPublication> & { portee?: number } = {};
  const lu = { vues: nombre(a.views) ?? nombre(a.impressions), portee: nombre(a.reach), likes: nombre(a.likes), commentaires: nombre(a.comments), partages: nombre(a.shares) };
  for (const [k, v] of Object.entries(lu)) if (v !== undefined) (valeurs as Record<string, number>)[k] = Math.round(v);
  if (!Object.keys(valeurs).length) return null;
  if (valeurs.partages !== undefined && valeurs.portee) valeurs.partagesParPortee = Math.round((valeurs.partages / valeurs.portee) * 10_000) / 100;
  return { valeurs, misesAJourLe: typeof a.lastUpdated === "string" ? a.lastUpdated : undefined };
}

/** Lecteur réel sur un client Zernio (le client porte la clé, le débit et la liste fermée). */
export function creerLecteurZernio(client: ClientZernio | null | undefined): LecteurStatsZernio {
  if (!client) return lecteurZernioEssai;
  return {
    mode: "reel",
    async lire(postId) {
      try {
        const rep = await client.requete({ methode: "GET", chemin: "/v1/analytics", query: { postId } });
        if (rep.statut === 202) return { etat: "pas-encore-pretes" };
        const lu = valeursDepuisAnalyticsZernio(rep.corps);
        return lu ? { etat: "lues", ...lu } : { etat: "non-lisible", raison: "illisible" };
      } catch (e) {
        if (!estErreurZernio(e)) return { etat: "non-lisible", raison: "reseau" };
        if (e.statut === 202) return { etat: "pas-encore-pretes" };
        if (e.statut === 424) return { etat: "non-lisible", raison: "echec-reseaux" };
        if (e.statut === 402) return { etat: "non-lisible", raison: "indisponible-offre" };
        return { etat: "non-lisible", raison: e.code === "acces" || e.code === "refuse" ? "refuse" : "reseau" };
      }
    },
  };
}
