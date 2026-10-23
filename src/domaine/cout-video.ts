/**
 * Coût affiché sur la fiche d'une vidéo (vérification de bout en bout n° 2, argent n° 6 et 7). PUR.
 * Avant : un seul « Coût », marqué ESSAI dès que le montage était simulé, alors qu'il contenait aussi la voix HeyGen
 * VRAIMENT payée. Désormais : le payé d'un côté (sans ESSAI), la part simulée de l'autre (marquée ESSAI, pas payée).
 */
import type { Montant } from "./types";

export interface ChiffreCout {
  libelle: string;
  /** Montant à afficher (formaté par l'écran), ou null pour « — ». */
  montant: Montant | null;
  /** « ≈ » devant : estimation, rien d'enregistré encore. */
  estime?: boolean;
  essai?: boolean;
}

export function chiffresCoutVideo(p: { paye: Montant; essai: Montant; nbDepenses: number; coutEstime?: Montant; fabricationSimulee: boolean; estDemo?: boolean }): ChiffreCout[] {
  // Rien d'enregistré encore (fabrication en cours, ou exemple) : l'estimation, comme avant.
  if (!p.nbDepenses) {
    if (!p.coutEstime) return [{ libelle: "Coût", montant: null }];
    return [{ libelle: "Coût", montant: p.coutEstime, estime: true, essai: p.fabricationSimulee && !p.estDemo }];
  }
  const chiffres: ChiffreCout[] = [{ libelle: "Coût payé", montant: p.paye }];
  if (p.essai.centimes > 0) chiffres.push({ libelle: "Essai, pas payé", montant: p.essai, essai: true });
  return chiffres;
}
