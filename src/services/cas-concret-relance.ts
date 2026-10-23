/**
 * « RÉESSAYER CETTE ÉTAPE » DU CAS CONCRET (tâche X12). Constat en ligne : un clic sans aucun effet visible (vidéo
 * `v-3a71b4a4dfea` arrêtée à « L'écriture »). Ce service rend TOUJOURS une issue que l'écran peut dire :
 *   - `relancee` : le même travail repart sur la même vidéo (`reessayerTravail` : seules les étapes en échec, ce qui est
 *     payé reste payé ; l'écriture relit ses réponses payées puis fait au plus UN nouvel appel, X12) ;
 *   - `accord-requis` : le prix à confirmer, avec sa phrase (une écriture arrêtée annonce le prix d'un nouvel essai ; le
 *     seuil habituel du studio s'applique ensuite au reste) ;
 *   - `refusee` : une phrase claire (budget, crédit, travail déjà reparti, étape qui ne se réessaie pas…).
 * Aucune exception ne remonte à l'écran.
 */
import "server-only";
import type { Id } from "@/domaine/types";
import { estCasStock, trouverCas } from "@/formats/cas-concret/catalogue";
import { formaterMontant } from "@/lib/montants";
import { coutNouvelEssaiEcritureCentimes, ID_MOTEUR_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { depots, ErreurStudio } from "./_commun";
import { exigerSession } from "./auth";
import { REGLAGES_CAS_CONCRET, reglageAllume } from "./cas-concret-reglages";
import { reessayerTravail } from "./travaux";

export type IssueRelanceCasConcret = { statut: "relancee"; travailId: Id } | { statut: "accord-requis"; centimes: number; phrase: string } | { statut: "refusee"; phrase: string };

export const PHRASES_RELANCE = {
  introuvable: "Cette fabrication n'existe plus. Rouvrez la page.",
  dejaRepartie: "La fabrication a déjà repris : elle avance toute seule.",
  pasArretee: "Cette fabrication n'est plus arrêtée. Rouvrez la page.",
  sansReessai: "Cette étape ne se réessaie pas telle quelle : reprenez le cas, puis fabriquez une nouvelle vidéo.",
  pasCeFormat: "Cette fabrication n'est pas un cas concret.",
  casIndisponible: "Ce cas n'est pas disponible pour le moment : la relance est refusée et rien n'est dépensé.",
  panne: "La relance n'a pas abouti. Rien n'est perdu : réessayez dans un instant.",
} as const;

/** Annonce d'une écriture arrêtée : ce que fait la relance, et le prix au plus d'un nouvel essai. PUR. */
export function annonceEcriture(centimes: number): string {
  return `Les réponses déjà payées sont relues d'abord. Si l'écriture précédente ne peut pas être reprise, un nouvel essai coûte environ ${formaterMontant({ centimes, devise: "EUR" })}.`;
}

/**
 * Relance l'étape arrêtée d'un travail du cas concret. `accord` : le montant confirmé (centimes), ou `true` pour une
 * simple question. Voir l'en-tête.
 */
export async function relancerEtapeCasConcret(travailId: Id, accord?: number | true, dep: { claudeActif?: () => Promise<boolean>; stockMetiersAllume?: () => Promise<boolean> } = {}): Promise<IssueRelanceCasConcret> {
  await exigerSession();
  const d = depots();
  const t = await d.travaux.obtenir(travailId);
  if (!t) return { statut: "refusee", phrase: PHRASES_RELANCE.introuvable };
  if (t.statut === "en_cours" || t.statut === "en_file") return { statut: "refusee", phrase: PHRASES_RELANCE.dejaRepartie };
  if (t.statut !== "echec") return { statut: "refusee", phrase: PHRASES_RELANCE.pasArretee };
  const version = t.versionId ? await d.versions.obtenir(t.versionId) : null;
  const commande = version?.commande;
  if (commande && commande.moteurId && commande.moteurId !== ID_MOTEUR_CAS_CONCRET) return { statut: "refusee", phrase: PHRASES_RELANCE.pasCeFormat };
  // Stock de cas : une vidéo d'un cas du stock ne se relance pas tant que `casConcret.stockMetiers` est éteint (refus net, avant tout prix).
  const casDeLaVideo = commande ? (lireEntreesCasConcret(commande.entrees).casId ?? "") : "";
  if (casDeLaVideo && estCasStock(casDeLaVideo)) {
    const allume = await (dep.stockMetiersAllume ?? (() => reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers)))().catch(() => false);
    if (!allume) return { statut: "refusee", phrase: PHRASES_RELANCE.casIndisponible };
  }
  const enEchec = t.etapes.filter((e) => e.statut === "echec");
  const erreur = enEchec[0]?.erreur ?? t.erreur;
  if (erreur?.reessayable === false) return { statut: "refusee", phrase: PHRASES_RELANCE.sansReessai };

  // Écriture arrêtée : le prix d'un nouvel appel est annoncé et confirmé AVANT de relancer (rien à payer en simulation).
  let annonce = "";
  const claudeActif = dep.claudeActif ?? (async () => (await import("./depense-claude-video")).claudeTextesActif());
  if (enEchec.some((e) => e.cle === "ecriture") && commande && (await claudeActif())) {
    const cas = trouverCas(lireEntreesCasConcret(commande.entrees).casId ?? "");
    if (cas) {
      const centimes = coutNouvelEssaiEcritureCentimes(cas, commande);
      annonce = annonceEcriture(centimes);
      if (accord === undefined) return { statut: "accord-requis", centimes, phrase: annonce };
    }
  }

  try {
    const r = await reessayerTravail(travailId, { confirme: accord ?? false });
    return { statut: "relancee", travailId: r.id };
  } catch (e) {
    if (e instanceof ErreurStudio) {
      if (e.code === "CONFIRMATION_REQUISE" && typeof e.montant === "number") return { statut: "accord-requis", centimes: e.montant, phrase: annonce ? `${annonce} ${e.message}` : e.message };
      if (e.code === "PAS_EN_ECHEC") return { statut: "refusee", phrase: PHRASES_RELANCE.dejaRepartie };
      return { statut: "refusee", phrase: e.message };
    }
    // Laisser passer redirect() de Next (session expirée).
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(`[cas-concret] relance refusée (${e instanceof Error ? e.name : "erreur"})`);
    return { statut: "refusee", phrase: PHRASES_RELANCE.panne };
  }
}
