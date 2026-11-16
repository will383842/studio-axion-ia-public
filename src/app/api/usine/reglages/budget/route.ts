import type { NextRequest } from "next/server";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";
import { ErreurChampInvalide, plafondStudioCentimes, reglerBudgetUsine } from "@/services/budget-mensuel";
import { ErreurStudio } from "@/services/_commun";

/**
 * Porte v2, appel 5 : l'Usine règle son budget du mois en quantités (quotas), le montant en centimes restant toléré, et, depuis le 15/11, le plafond de l'Usine en automatique (paire `automatique` + `plafond_automatique_cents`, jamais l'un sans l'autre) ; un corps vide est accepté. Public pour
 * la session (pas de cookie), mais le jeton est vérifié dans le proxy PUIS de nouveau ici (`garderPorte`) : deux couches voulues. Un réglage, jamais un blocage.
 */
export const dynamic = "force-dynamic";

const ROUTE = "PUT /api/usine/reglages/budget";

export async function PUT(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["budget_mensuel_cents", "mois", "quotas", "automatique", "plafond_automatique_cents"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    const r = await reglerBudgetUsine({
      budget_mensuel_cents: porte.corps.budget_mensuel_cents,
      mois: porte.corps.mois,
      quotas: porte.corps.quotas,
      automatique: porte.corps.automatique,
      plafond_automatique_cents: porte.corps.plafond_automatique_cents,
    });
    const avecPaire = r.automatique !== undefined;
    // Réponse inchangée sans la paire. Avec la paire (déjà écrite), un plafond global illisible ne change pas la réponse en erreur : aucun refus lié à ce plafond.
    const plafondGlobal = avecPaire ? await plafondStudioCentimes().catch(() => null) : await plafondStudioCentimes();
    return reponseJson(200, {
      mois: r.mois,
      budget_mensuel_cents: r.budget_mensuel_cents,
      plafond_cents: plafondGlobal,
      deja: r.deja,
      ...(r.quotas ? { quotas: r.quotas } : {}),
      ...(avecPaire ? { automatique: r.automatique, plafond_automatique_cents: r.plafond_automatique_cents } : {}),
    });
  } catch (e) {
    if (e instanceof ErreurChampInvalide) {
      statut = 400;
      return reponseErreur(400, `Champ invalide : ${e.champ}. ${e.message}`, "champ_invalide");
    }
    statut = 500;
    if (e instanceof ErreurStudio && e.code === "BUDGET_ILLISIBLE") return reponseErreur(500, "Le plafond du studio est illisible.", "budget_illisible");
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
