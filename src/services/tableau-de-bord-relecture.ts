/**
 * Tableau de bord : « lire la capture, puis préparer la relecture des chiffres » (G4-08-b1-v20j).
 * Enchaîne deux pièces qui existent déjà : la lecture de la capture par Claude et la règle pure de relecture. Monté nulle
 * part : aucun importeur, aucun réglage lu ici, aucune écriture en base. Le plafond propre et la garde d'argent restent
 * ceux de la lecture (`deps` lui est transmis tel quel) ; ce module n'ajoute aucun appel ni aucun montant.
 */
import "server-only";
import { appliquerRelecture, type DecisionChiffre, type ResultatRelecture } from "@/briques/donnees-video/relecture-chiffres";
import type { ChiffreARelire, ImageCapture } from "@/briques/donnees-video/lecture-capture";
import type { TableauDeBord } from "@/briques/donnees-video/types";
import type { CommandeFabrication, Id } from "@/domaine/types";
import { lireCaptureTableau, type DepsLectureCapture } from "./lecture-capture-claude";

export type OuvertureRelectureTableau = { etape: "relecture"; brouillon: TableauDeBord; aRelire: ChiffreARelire[] } | { etape: "saisie-manuelle"; raison: string };

const RAISON_PANNE = "La lecture n'a pas abouti : rien n'a été payé en plus. Saisis les chiffres à la main.";

/** UN seul appel à la lecture (jamais de reprise) ; le repli est rendu tel quel ; ne lève jamais. */
export async function ouvrirRelectureTableau(videoId: Id, image: ImageCapture, origine: CommandeFabrication["origine"], deps: DepsLectureCapture & { lireCapture?: typeof lireCaptureTableau } = {}): Promise<OuvertureRelectureTableau> {
  try {
    const lire = deps.lireCapture ?? lireCaptureTableau;
    const r = await lire(videoId, image, origine, deps);
    return r.ok ? { etape: "relecture", brouillon: r.brouillon, aRelire: r.aRelire } : { etape: "saisie-manuelle", raison: r.raison };
  } catch {
    return { etape: "saisie-manuelle", raison: RAISON_PANNE };
  }
}

/** Applique les décisions de Williams sur le brouillon ; rien d'autre. */
export function validerRelectureTableau(brouillon: TableauDeBord, decisions: Record<string, DecisionChiffre>): ResultatRelecture {
  return appliquerRelecture(brouillon, decisions);
}
