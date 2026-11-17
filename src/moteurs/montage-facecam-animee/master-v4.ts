/**
 * FACE CAMÉRA ANIMÉE v4 — GARDER LE RENDU BRUT (G11-09a, décision W-H du 17/11). Pièce pure, non branchée : réglage (éteint par défaut),
 * nom du fichier gardé et garde-fou de taille (au-delà de 0,4 Go, revenir vers Williams). Aucun appel, aucun service.
 */
import type { AlerteQualite } from "@/domaine/types";

export const PARAM_GARDER_MASTER_FA = "facecamAnimee.garderMaster";

/** Seul `true` exact allume ; toute autre valeur ou une lecture qui lève éteint. */
export async function garderMasterActif(lire: (id: string, defaut: unknown) => Promise<unknown>): Promise<boolean> {
  try {
    return (await lire(PARAM_GARDER_MASTER_FA, false)) === true;
  } catch {
    return false;
  }
}

export function nomMasterV4(idRendu: string): string {
  if (typeof idRendu !== "string" || idRendu.length === 0) throw new Error("Identifiant de rendu vide : impossible de nommer le rendu brut.");
  if (idRendu.includes("/")) throw new Error("Identifiant de rendu invalide (contient « / ») : impossible de nommer le rendu brut.");
  return `${idRendu}-master.mp4`;
}

/** 0,4 Go (décision W-H). */
export const SEUIL_ALERTE_MASTER_OCTETS = 400_000_000;

export function alerteTailleMaster(taille: number): AlerteQualite | null {
  if (typeof taille !== "number" || !Number.isFinite(taille) || taille < 0 || taille <= SEUIL_ALERTE_MASTER_OCTETS) return null;
  const go = (taille / 1_000_000_000).toFixed(2).replace(".", ",");
  return { code: "montant", gravite: "info", message: `Rendu brut gardé : ${go} Go (plus de 0,4 Go) : prévenir Williams avant de continuer.` };
}
