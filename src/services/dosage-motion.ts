/**
 * Dosage de l'animation côté service (X3-03). Éteint par défaut : `dosageMotion.actif` doit valoir exactement `true`.
 * Éteint, en cas d'erreur ou de moteur inconnu : la commande est rendue TELLE QUELLE (même objet), donc le prix aussi.
 * Ne lève jamais d'erreur. N'importe jamais `./fabrication`.
 */
import type { CommandeFabrication, Video } from "@/domaine/types";
import { idMoteurDeCommande } from "@/moteurs/ids";
import { appliquerDosage } from "@/briques/dosage-motion/commande";
import { defautsLus, dosageActif, dosageRetenu } from "@/briques/dosage-motion/reglage";
import type { IdGenerateurDosage } from "@/briques/dosage-motion/types";
import { lireParametre } from "./_commun";

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

const lire = (id: string, defaut: unknown) => lireParametre<unknown>(id, defaut);

export async function avecDosageMotion(video: Video, c: CommandeFabrication): Promise<CommandeFabrication> {
  try {
    if (!(await dosageActif(lire))) return c;
    const generateur = GENERATEUR_DU_MOTEUR[idMoteurDeCommande(c)];
    if (!generateur) return c;
    const defauts = await defautsLus(lire);
    const choixVideo = video.styles?.dosageMotion;
    const { dosage, ramene } = dosageRetenu({ choixVideo, defautGenerateur: defauts[generateur], generateur });
    const choisiPar = choixVideo !== undefined && !ramene ? "video" : "generateur";
    return appliquerDosage(c, { cran: dosage, choisiPar, v4: generateur === "facecam-animee" });
  } catch (e) {
    console.warn("[dosage-motion] commande laissée intacte :", e instanceof Error ? e.message : e);
    return c;
  }
}
