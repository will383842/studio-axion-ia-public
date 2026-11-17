/**
 * Dosage de l'animation pour la page de création (X3-09c). Lecture seule, éteint par défaut :
 * `dosageMotion.actif` doit valoir exactement `true`, sinon rien n'est rendu et l'écran reste celui d'aujourd'hui.
 * Ne lève jamais d'erreur. N'importe ni `fabrication`, ni `reglages`, ni `travaux`, ni `publications`, ni `image-video`.
 */
import "server-only";
import { defautsLus, dosageActif, type LireReglage } from "@/briques/dosage-motion/reglage";
import type { DosageMotion, IdGenerateurDosage } from "@/briques/dosage-motion/types";
import { moteurPrisesFilmees } from "@/moteurs";
import { lireParametre } from "./_commun";

// Recopiée de `GENERATEUR_DU_MOTEUR` (src/services/dosage-motion.ts, table privée, fichier en lecture seule) ;
// un test vérifie que les deux tables restent égales.
const GENERATEUR_DU_MOTEUR: Record<string, IdGenerateurDosage> = {
  "montage-avocat": "avocat",
  "montage-facecam": "facecam",
  "montage-facecam-animee": "facecam-animee",
  "montage-cas-concret": "cas-concret",
  "montage-tableau": "tableau",
  "montage-image-video": "image-video",
  "montage-demo-facecam": "demo-facecam",
  "montage-tutoriel-outil": "tutoriel-outil",
};

export type DosagePourEcran = { actif: true; generateur: IdGenerateurDosage; defaut: DosageMotion };

export async function dosagePourEcran(
  format: { id: string; moteur?: string },
  ports?: { lire?: LireReglage },
): Promise<DosagePourEcran | undefined> {
  try {
    const lire: LireReglage = ports?.lire ?? ((id, d) => lireParametre<unknown>(id, d));
    if (!(await dosageActif(lire))) return undefined;
    const moteur = !format.moteur || format.moteur === "simulation" ? moteurPrisesFilmees(format.id) : format.moteur;
    if (!moteur || !Object.prototype.hasOwnProperty.call(GENERATEUR_DU_MOTEUR, moteur)) return undefined;
    const generateur = GENERATEUR_DU_MOTEUR[moteur];
    return { actif: true, generateur, defaut: (await defautsLus(lire))[generateur] };
  } catch (e) {
    console.warn("[dosage-motion] écran de création laissé tel quel :", e instanceof Error ? e.message : e);
    return undefined;
  }
}
