import type { NextRequest } from "next/server";
import { ecrireParametre, lireParametre } from "@/services/_commun";
import { lireBudgetUsine, plafondStudioCentimes } from "@/services/budget-mensuel";
import { resumeBudget } from "@/services/couts";
import { avecOrigineFournisseur, lireQuotasUsine, reserverQuota } from "@/services/plafond-fournisseur";
import { garderPorte, reponseErreur, reponseJson } from "@/usine/garde-porte";

/**
 * L6-06 : l'Usine commande un visuel au Studio, sous QUOTA DE QUANTITÉS (par jour ou par semaine, par réseau et par type),
 * réglé dans l'usine (`reserverQuota`, origine « usine »). Jamais de montant, jamais de 402.
 *  - Sous le quota : la commande est enregistrée (« usine-visuel-commande:<cle> », état « recue »). Cette porte n'appelle
 *    elle-même aucun fournisseur ni aucun réseau.
 *  - Quota atteint : l'excédent est MIS DE CÔTÉ (« usine-visuel-cote:<cle> », 202, code « quota_atteint »), jamais refusé :
 *    le fondateur le débloque d'un clic. Aucun appel au fournisseur.
 *  - Rejeu (même `cle`) : aucune seconde unité consommée, aucun doublon.
 *  - Budget de l'usine du mois absent ou épuisé (ou plafond du studio atteint) : refus propre « budget_epuise » (409, sans montant,
 *    jamais 402), avant toute réservation de quota. Couple réseau/type SANS quota défini : refus « quota_absent » (422), échec fermé :
 *    jamais « passe » sans borne pour l'origine usine. Le fondateur (origine « studio ») n'est jamais concerné.
 *  - Une unité de quota est consommée sous la clé « visuel:<cle> » dès la commande enregistrée ; la fabrication en aval réserve sous
 *    « budget:<travailId> » : au branchement, réutiliser la même clé pour éviter un double décompte.
 *  - « Tout arrêter » (`USINE_TOUT_ARRETER`, même lecture que la porte des commandes) : 423, rien n'est écrit.
 */
export const dynamic = "force-dynamic";

const ROUTE = "POST /api/usine/visuels";
const PREFIXE_COMMANDE = "usine-visuel-commande:";
const PREFIXE_COTE = "usine-visuel-cote:";
const CLE_VALIDE = /^[A-Za-z0-9._:-]{8,100}$/;
const NOM_COURT = /^[A-Za-z0-9._:-]{1,100}$/;

function toutArreterActif(): boolean {
  const v = (process.env.USINE_TOUT_ARRETER ?? "").trim().toLowerCase();
  return !["", "0", "false", "non"].includes(v);
}

export async function POST(requete: NextRequest) {
  const porte = await garderPorte(requete, { route: ROUTE, champs: ["cle", "reseau", "type", "repere"] });
  if (!porte.ok) return porte.reponse;
  let statut = 200;
  try {
    if (toutArreterActif()) {
      statut = 423;
      return reponseErreur(423, "Tout est arrêté : la commande est refusée.", "tout_arrete");
    }
    const { cle, reseau, type, repere } = porte.corps;
    const refus = (message: string) => {
      statut = 400;
      return reponseErreur(400, `Champ invalide : ${message}`, "champ_invalide");
    };
    if (typeof cle !== "string" || !CLE_VALIDE.test(cle)) return refus("cle (8 à 100 caractères simples).");
    if (typeof reseau !== "string" || !NOM_COURT.test(reseau)) return refus("reseau.");
    if (typeof type !== "string" || !NOM_COURT.test(type)) return refus("type.");
    if (repere !== undefined && (typeof repere !== "string" || !NOM_COURT.test(repere))) return refus("repere.");

    if (await lireParametre(`${PREFIXE_COMMANDE}${cle}`, null)) return reponseJson(200, { etat: "recue", deja: true });
    if (await lireParametre(`${PREFIXE_COTE}${cle}`, null)) return reponseJson(200, { etat: "mise_de_cote", code: "quota_atteint", deja: true });

    // Budget : lecture seule (le passage commun `controlerBudgetDuMois` n'est pas touché). Absent ou épuisé : refus avant tout quota.
    const usine = await lireBudgetUsine();
    const plafond = await plafondStudioCentimes();
    const vue = await resumeBudget();
    const utilise = vue.depense.centimes + vue.engage.centimes;
    if (!usine || (usine.budget_mensuel_cents !== null && utilise >= usine.budget_mensuel_cents) || (plafond !== null && utilise >= plafond)) {
      statut = 409;
      return reponseErreur(409, "Le budget du mois est épuisé : la commande n'est pas prise.", "budget_epuise");
    }
    // Échec fermé : aucun quota défini pour ce couple réseau/type = aucune borne = refus.
    if (!(await lireQuotasUsine()).some((q) => q.reseau === reseau && q.type === type)) {
      statut = 422;
      return reponseErreur(422, "Aucune limite n'est réglée pour ce réseau et ce type : la commande n'est pas prise.", "quota_absent");
    }

    // Même clé d'idempotence que les autres gardes : un rejeu ne consomme jamais une seconde unité.
    const reservation = await avecOrigineFournisseur("usine", () => reserverQuota(reseau, type, `visuel:${cle}`));
    if (reservation === null) {
      await ecrireParametre(`${PREFIXE_COTE}${cle}`, { cle, reseau, type, ...(typeof repere === "string" ? { repere } : {}) });
      statut = 202;
      return reponseJson(202, { etat: "mise_de_cote", code: "quota_atteint", deja: false });
    }
    await ecrireParametre(`${PREFIXE_COMMANDE}${cle}`, { cle, reseau, type, ...(typeof repere === "string" ? { repere } : {}) });
    statut = 201;
    return reponseJson(201, { etat: "recue", deja: false });
  } catch {
    statut = 500;
    return reponseErreur(500, "Erreur du studio.", "erreur_interne");
  } finally {
    await porte.terminer(statut);
  }
}
