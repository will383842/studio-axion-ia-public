/**
 * ÉCRANS FOURNIS PAR WILL (P2S, P2-06) : l'image d'une étape dont l'écran est derrière une connexion. L'image qui arrive
 * est DÉJÀ masquée (le navigateur a posé les rectangles avant l'envoi) ; sans l'attestation, rien n'est gardé.
 * Réglage du studio : { [casId]: EcranFourni[] }. Lecture pour la fabrication : `ecransFournisDuCas(casId)`.
 * N'envoie rien, ne publie rien. Portage phase 2 : tout est derrière `casConcret.ecranFourni` (éteint par défaut) : la
 * fabrication ignore alors tout écran gardé et le dépôt est refusé.
 */
import "server-only";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { trouverCasAutorise } from "@/services/cas-concret-stock-acces";
import { lireEcransFournis, PHRASES_ECRAN_FOURNI, refusEcransFournis, zonesMasqueesValides, type EcranFourni } from "@/moteurs/montage-cas-concret/captures";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "@/services/cas-concret-reglages";
import { fichierEnvoye } from "@/services/fichiers";

/** Réglage éteint : le dépôt n'est pas ouvert. */
export const PHRASE_ECRAN_FOURNI_FERME = "Le dépôt d'un écran n'est pas ouvert pour le moment.";
export const PARAM_ECRANS_FOURNIS = "cas-concret.ecrans-fournis";
/** Type d'entité sous lequel l'image est envoyée (destination existante), `entiteId` = le cas. */
export const TYPE_ENVOI_ECRAN = "entree";

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Les écrans fournis d'un cas (lecture tolérante). */
export async function ecransFournisDuCas(casId: string): Promise<EcranFourni[]> {
  await exigerSession();
  return ecransFournisPourFabrication(casId);
}

/** Même lecture, sans session : la boucle de fond qui fait avancer la fabrication (`cas-concret-branchements.ts`). Réglage éteint : aucun écran. */
export async function ecransFournisPourFabrication(casId: string): Promise<EcranFourni[]> {
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni))) return [];
  return lireEcransFournis(objet(await lireParametre<unknown>(PARAM_ECRANS_FOURNIS, {}))[casId]);
}

export interface DemandeEcranFourni {
  casId: string;
  etapeCas: number;
  fichierId: string;
  masques: unknown;
  /** Case « Je confirme qu'aucune donnée personnelle n'est visible ». */
  attestation: boolean;
}

/** Garde l'image masquée d'une étape. Sans la case cochée : refus, rien n'est gardé. */
export async function poserEcranFourni(d: DemandeEcranFourni, dependances: { maintenant?: number } = {}): Promise<EcranFourni> {
  await exigerSession();
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni))) throw new ErreurStudio("FONCTION_FERMEE", PHRASE_ECRAN_FOURNI_FERME);
  if (d.attestation !== true) throw new ErreurStudio("ATTESTATION", PHRASES_ECRAN_FOURNI.sansAttestation);
  const cas = await trouverCasAutorise(d.casId);
  if (!cas) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  // Une étape qui n'est pas un entier serait gardée puis écartée en silence à la lecture (`lireEcransFournis`).
  if (!Number.isInteger(d.etapeCas)) throw new ErreurStudio("ECRAN_REFUSE", PHRASES_ECRAN_FOURNI.etapeInconnue);
  const fichier = await fichierEnvoye(d.fichierId, TYPE_ENVOI_ECRAN, d.casId);
  const ecran: EcranFourni = {
    etapeCas: d.etapeCas,
    cle: fichier.cleStockage,
    mime: fichier.mime,
    masques: zonesMasqueesValides(d.masques),
    attesteLe: new Date(dependances.maintenant ?? Date.now()).toISOString(),
  };
  const refus = refusEcransFournis([ecran], cas);
  if (refus) throw new ErreurStudio("ECRAN_REFUSE", refus);
  const toutes = objet(await lireParametre<unknown>(PARAM_ECRANS_FOURNIS, {}));
  const autres = lireEcransFournis(toutes[d.casId]).filter((e) => e.etapeCas !== d.etapeCas);
  await ecrireParametre(PARAM_ECRANS_FOURNIS, { ...toutes, [d.casId]: [...autres, ecran].sort((a, b) => a.etapeCas - b.etapeCas) });
  await journaliser("cas-concret", `Écran fourni gardé : étape ${d.etapeCas} de « ${cas.titre} »`);
  return ecran;
}

/** Retire l'image d'une étape : la capture du site reprend sa place. */
export async function retirerEcranFourni(casId: string, etapeCas: number): Promise<void> {
  await exigerSession();
  // Même garde que le dépôt : réglage éteint ou cas inconnu, rien n'est écrit.
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.ecranFourni))) throw new ErreurStudio("FONCTION_FERMEE", PHRASE_ECRAN_FOURNI_FERME);
  if (!(await trouverCasAutorise(casId))) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  const toutes = objet(await lireParametre<unknown>(PARAM_ECRANS_FOURNIS, {}));
  await ecrireParametre(PARAM_ECRANS_FOURNIS, { ...toutes, [casId]: lireEcransFournis(toutes[casId]).filter((e) => e.etapeCas !== etapeCas) });
}

/** Les étapes d'un cas dont l'écran est réel : seules celles-là peuvent recevoir une image. */
export function etapesAEcranReel(casId: string): { numero: number; titre: string }[] {
  const cas = trouverCas(casId);
  return (cas?.etapes ?? []).flatMap((e, i) => (e.visuel.sorte === "ecran" ? [{ numero: i + 1, titre: e.titre }] : []));
}
