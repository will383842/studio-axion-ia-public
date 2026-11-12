/**
 * JOURNAL DURABLE DES ÉCHECS (GV-EC-01a) : écrit, pour chaque échec d'un travail, une ligne qui ne s'efface jamais
 * (dépôt `evenements`, type `echec-detail`). Ne lance JAMAIS d'erreur : un échec de journal ne doit rien casser.
 */
import "server-only";
import { familleDe, identifiantEchec, nettoyerDetail, TYPE_EVENEMENT_ECHEC, type EvenementEchec, type LigneEchec } from "@/domaine/journal-echecs";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { moteurDeCommande } from "@/moteurs";
import { depots, horodatage, maintenant } from "./_commun";

/**
 * Consigne l'échec porté par `travail.erreur`. Identifiant `ev-echec-<travailId>-<tentatives>` : rejouer n'écrit pas
 * deux fois. Sans erreur sur le travail, rien n'est écrit.
 */
export async function consignerEchec(travail: Travail, commande: Pick<CommandeFabrication, "moteurId" | "formatId">): Promise<void> {
  try {
    const erreur = travail.erreur;
    if (!erreur) return;
    const id = identifiantEchec(travail.id, travail.tentatives);
    if (await depots().evenements.obtenir(id)) return;
    let moteur = "?";
    try {
      moteur = moteurDeCommande(commande).id;
    } catch {
      /* moteur inconnu : on garde « ? » */
    }
    const etape = travail.etapes.find((e) => e.statut === "echec")?.nom ?? "?";
    const ligne: LigneEchec = {
      date: maintenant(),
      videoId: travail.cibleId,
      travailId: travail.id,
      generateur: commande.formatId,
      moteur,
      etape,
      code: erreur.code,
      famille: familleDe(erreur.code),
      phrase: erreur.messagePourWill,
      detail: nettoyerDetail(erreur.detailTechnique),
      essai: travail.tentatives,
    };
    const ev: EvenementEchec = {
      id,
      type: TYPE_EVENEMENT_ECHEC,
      message: `Échec consigné : ${etape}`,
      entite: "video",
      entiteId: travail.cibleId,
      estDemo: travail.estDemo,
      date: ligne.date,
      ...horodatage(),
      echec: ligne,
    };
    await depots().evenements.enregistrer(ev);
  } catch {
    /* jamais d'erreur : le journal durable est un plus */
  }
}

/**
 * Lit les échecs consignés (type `echec-detail`) des `joursMax` derniers jours, exemples exclus, du plus récent au
 * plus ancien. Ne lance jamais d'erreur : sans lecture possible, la liste est vide.
 */
export async function lireEchecs({ joursMax = 30 }: { joursMax?: number } = {}): Promise<LigneEchec[]> {
  try {
    const limite = Date.now() - joursMax * 86_400_000;
    const evenements = await depots().evenements.lister((e) => e.type === TYPE_EVENEMENT_ECHEC && !e.estDemo);
    return evenements
      .map((e) => (e as Partial<EvenementEchec>).echec)
      .filter((l): l is LigneEchec => !!l && new Date(l.date).getTime() >= limite)
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}
