/**
 * GUIDES PDF (lot G2, branché sur l'argent par 0a phase 2) · appel Claude GARDÉ pour la rédaction d'un brouillon de guide.
 * Vit ici (dossier du fournisseur Claude) pour que les services n'importent pas directement l'envoi du client : ce n'est
 * PAS une méthode d'envoi de message d'un réseau social, et la garde du port Inbox ne doit pas la confondre avec une.
 *
 * Plus AUCUN envoi direct : l'appel passe par le chemin gardé des autres appels Claude, avec les briques existantes
 * (rien n'est recalculé ici) :
 *  1. Claude choisi et un compte prêt (`claudeActif`, `peutEcrire`) ; sinon refus, aucun appel ;
 *  2. sous le VERROU DU MOIS (`sousVerrouMois`, le même que l'écriture et le comité) : limite Claude du mois
 *     (`plafondMensuelClaudeUsd`, `engageClaudeDuMoisCentimes`) contre le PIRE CAS de l'appel (`pireCasRequete`, marge
 *     `MARGE_CREDITS`) ; au-delà → refus « plafond », aucun appel. Puis pré-vol, réservation et engagement de la brique
 *     Crédits (`verifierEtReserverSelonOrigine`, commande du fondateur, aucun accord de prix en dur) ;
 *  3. appel par `appelerAvecRotation` (seul chemin vers `executerRole`) ;
 *  4. après l'appel : dépense RÉELLE enregistrée (`depenses.enregistrer`, modèle, jetons → coût `coutReelUsd`), ou le
 *     pire cas en dépense ESTIMÉE si la coupure est survenue après l'envoi (réseau, délai : peut-être facturé) ;
 *     réservation et engagement rendus (`libererReservation` : « consommee » si une dépense est comptée, sinon « liberee »).
 * La limite du mois REFUSE ici toujours (fiche 0a phase 2 : « plafond atteint → refus propre »), même quand le budget est
 * en mode indicatif : un brouillon de guide n'est jamais une commande qui doit passer coûte que coûte.
 * Rien n'est chargé à l'import (imports différés) : interrupteur éteint, aucun service, aucune base.
 */
import { ErreurClaude, type RequeteClaude } from "./client";
import type { OrigineLancement } from "@/services/budget-mensuel";
import { marqueurArret, pireCasRequete, type MarqueurArret, type DefinitionRole, type EntreeRole } from "@/generateur/roles/types";

/** Étape inscrite sur la dépense (lignes de coût) : le suivi des dépenses retrouve la rédaction des guides. */
export const ETAPE_DEPENSE_REDACTION_GUIDE = "Guide PDF · rédaction";
export const PREFIXE_APPEL_REDACTION_GUIDE = "guide-redaction";

export type MotifRefusArgent = "plafond-mois" | "credit" | "prix-a-confirmer" | "claude-indisponible";

/** Refus de la garde d'argent : RIEN n'est parti chez Claude, rien n'est payé, aucune réservation ne reste. */
export class RefusArgentRedaction extends Error {
  readonly refusArgent = true;
  constructor(readonly motif: MotifRefusArgent) {
    super(`refus argent : ${motif}`);
    this.name = "RefusArgentRedaction";
  }
}

/** Rôle de la rédaction : la requête du service (modèle, sortie max, effort, consigne) passée au contrat commun des rôles. */
export function roleRedactionGuide(requete: RequeteClaude): DefinitionRole {
  return {
    id: "guide-redaction",
    version: 1,
    consigne: requete.systeme.map((b) => b.texte).join("\n\n"),
    modele: requete.modele,
    effort: requete.effort,
    maxTokens: requete.maxTokens,
    sansPhrasesFixes: true,
    simuler: () => "",
  };
}

/**
 * Appel gardé. `_cle` : gardé pour la signature historique (`DepsRedaction.appeler`) ; le compte qui répond est choisi
 * par `claudeActif`, comme pour tous les rôles (rotation des comptes comprise). `origine` (OBLIGATOIRE) est celle de l'appelant
 * réel (« studio » : geste d'une personne connectée ; « usine » : lancement automatique) : elle est transmise telle quelle à la
 * brique Crédits, jamais écrite ici. Lève `RefusArgentRedaction` sur un refus
 * de la garde (aucun appel), ou l'erreur de Claude telle quelle (la dépense éventuelle est déjà enregistrée).
 */
export async function appelerClaudeRedaction(requete: RequeteClaude, _cle: string, origine: OrigineLancement): Promise<{ texte: string; marqueur?: MarqueurArret }> {
  const gc = await import("@/services/generation-claude");
  const credits = await import("@/services/credits");
  const commun = await import("@/services/_commun");
  const { centimesDuPlafond } = await import("@/lib/montants");
  const { nouvelId } = await import("@/lib/ids");

  const actif = await gc.claudeActif("script");
  if (!gc.peutEcrire(actif)) throw new RefusArgentRedaction("claude-indisponible");

  const role = roleRedactionGuide(requete);
  const entree: EntreeRole = { contexte: {}, variable: requete.messages.map((m) => m.contenu).join("\n\n") };
  const pireUsd = pireCasRequete(role, entree);
  const appelId = nouvelId(PREFIXE_APPEL_REDACTION_GUIDE);
  const t = await gc.taux();
  const lignes = [gc.ligne(ETAPE_DEPENSE_REDACTION_GUIDE, pireUsd, t, "estime")];
  const demande = Math.ceil(pireUsd * 100 * (1 + credits.MARGE_CREDITS));

  const refus = await gc.sousVerrouMois(async (): Promise<MotifRefusArgent | null> => {
    const plafond = await gc.plafondMensuelClaudeUsd();
    const engage = await gc.engageClaudeDuMoisCentimes();
    if (engage.depense + engage.reserve + demande > centimesDuPlafond(plafond)) return "plafond-mois";
    try {
      await credits.verifierEtReserverSelonOrigine(origine, { lignes, total: lignes[0]!.total }, false, "Cette rédaction de guide", { travailId: appelId });
    } catch (e) {
      if (e instanceof commun.ErreurStudio && e.code === "CONFIRMATION_REQUISE") return "prix-a-confirmer";
      if (e instanceof commun.ErreurStudio && ["CREDIT_INSUFFISANT", "BUDGET_DEPASSE", "BUDGET_USINE_ABSENT", "BUDGET_MENSUEL_ATTEINT", "USINE_PLAFOND_ATTEINT"].includes(e.code)) return "credit";
      throw e;
    }
    return null;
  });
  if (refus) {
    await commun.journaliser("generateur", `Guide PDF : rédaction refusée (${refus === "plafond-mois" ? "limite Claude du mois atteinte" : refus === "credit" ? "crédit ou budget insuffisant" : "prix à confirmer"}), rien n'est parti`).catch(() => undefined);
    throw new RefusArgentRedaction(refus);
  }

  // Réservé : la réservation est rendue après l'écriture de la dépense (ou libérée si rien n'a coûté) ; toute dépense possible est comptée.
  let cout = 0;
  let nature: "reel" | "estime" = "reel";
  try {
    const r = await gc.appelerAvecRotation(actif, role, entree);
    cout = gc.coutReelUsd(r.reponse);
    const marqueur = marqueurArret(r.reponse.texte);
    return { texte: r.reponse.texte, ...(marqueur ? { marqueur } : {}) };
  } catch (e) {
    // Coupure après l'envoi (réseau, délai, erreur inconnue) : la réponse a pu être facturée ; son pire cas reste compté.
    const err = e instanceof ErreurClaude ? e : null;
    if (!err || err.code === "reseau" || err.code === "delai") {
      cout = pireUsd;
      nature = "estime";
    }
    throw e;
  } finally {
    if (cout > 0) {
      // Dépense d'abord : si son écriture lève, la réservation reste ACTIVE (donc comptée dans la limite du mois)
      // et l'erreur remonte — même règle que executerRoleFacture et comite-editorial.
      const l = [gc.ligne(ETAPE_DEPENSE_REDACTION_GUIDE, cout, t, nature)];
      await commun.depots().depenses.enregistrer({ id: nouvelId("dep"), travailId: appelId, lignes: l, total: l[0]!.total, date: commun.maintenant(), sourceClaude: actif.source, ...commun.horodatage() });
      await credits.libererReservation(appelId, "consommee");
    } else {
      await credits.libererReservation(appelId, "liberee");
    }
  }
}
