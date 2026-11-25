import type { NextRequest } from "next/server";
import { moisParis } from "@/services/couts";
import { lireReglageEnVigueur, usageDuMoisUsine } from "@/services/autonomie-usine";
import { maintenant } from "@/services/_commun";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * Porte v2 : l'Usine lit l'état de son autonomie (allumée ou non, plafond du mois, utilisé ce mois-ci, qui la règle). LECTURE SEULE
 * (POST parce que la porte exige un corps JSON) : aucune écriture de réglage, aucune cloche, aucune ligne de journal du budget.
 * Le jeton est vérifié par `garderPorte`.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/reglages/autonomie";

export async function POST(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: [] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    const mois = moisParis(maintenant());
    const reglage = await lireReglageEnVigueur();
    if (!reglage.lu) throw new Error("lecture du réglage impossible"); // jamais « éteint, 0 » à la place d'un état inconnu : l'Usine affiche « inconnu »
    const utilise = await usageDuMoisUsine(mois);
    return reponseJson(200, {
      automatique: reglage.actif,
      plafond_automatique_cents: reglage.plafondCents,
      utilise_automatique_cents: utilise,
      mois,
      pilote: reglage.pilote,
    });
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
