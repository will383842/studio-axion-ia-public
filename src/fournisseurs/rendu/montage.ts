/**
 * FOURNISSEUR DE MONTAGE RÉEL « studio-rendu » (lot M4 ; plan B.7, B.9 ter) : Remotion et FFmpeg dans le conteneur
 * sans état du serveur (`remotion-local`). Inscrit seulement si `STUDIO_RENDU_URL` existe ; il s'active ensuite par
 * `FOURNISSEUR_MONTAGE=studio-rendu` (ou le réglage « fournisseur.montage »). Le moteur avocat ne choisit pas par
 * le nom : il lit ses capacités et passe par `obtenirServiceRendu()` (composition par format d'image).
 * `assembler` décrit le projet de montage (pistes, formats) sans rien rendre : le rendu suit le travail du moteur.
 * Lot M4b : le rendu local est accéléré (calques image dans FFmpeg) et tient le seuil ; l'implémentation
 * `remotion-lambda` est écrite, ÉTEINTE (voir plus bas).
 */
import type { FournisseurMontage } from "../types";

export const fournisseurMontageStudioRendu: FournisseurMontage = {
  id: "studio-rendu",
  type: "montage",
  nom: "Montage (serveur du studio)",
  reelPrevu: "Remotion",
  mode: "reel",
  // Rendu sur notre serveur : aucun coût à l'usage. Un montage à la fois (file longue), 25 i/s, 1080p.
  capacites: { asynchrone: true, accordExige: false, dureeMaxSec: 180, retoucheParPlan: true, resolutionMax: 1080, fpsSortie: 25 },
  async assembler(commande) {
    return { projetMontage: { moteur: commande.moteurId, ratios: commande.ratios, plans: commande.plans.length, calques: ["decor", "double", "accessoire", "recadrage", "illustration", "lut-grain-vignette", "incrustations", "encadre", "sous-titres"] }, dureeSec: commande.dureeCibleSec };
  },
};

/** Le conteneur `studio-rendu` est-il relié (adresse interne connue) ? */
export function studioRenduRelie(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.STUDIO_RENDU_URL?.trim();
}

/**
 * REMOTION LAMBDA (lot M4b, conditionnel ; plan B.7) — écrit, ÉTEINT. Les calques Remotion du montage (texte ; image du
 * double simulé) seraient rendus sur AWS Lambda par `studio-rendu` (`studio-rendu/src/remotion-lambda.ts`), le reste
 * (LUT, son, export, mesures) restant dans `studio-rendu`. Inscrit seulement quand le conteneur est relié ET que
 * Lambda est configuré (`REMOTION_LAMBDA_ACTIVE=true` + région, fonction, site, clés AWS) ; aucun appel sinon.
 * Payé à l'usage : estimation ≈ 0,04 $ par minute de vidéo et par format (à recaler sur `coutLambdaUsd`, mesuré).
 */
export const VARIABLES_REMOTION_LAMBDA = ["REMOTION_LAMBDA_ACTIVE", "REMOTION_LAMBDA_REGION", "REMOTION_LAMBDA_FONCTION", "REMOTION_LAMBDA_SITE", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] as const;

/** Lambda est-il configuré (toutes les variables, et l'interrupteur à « true ») ? */
export function remotionLambdaConfigure(env: Record<string, string | undefined> = process.env): boolean {
  return env.REMOTION_LAMBDA_ACTIVE?.trim() === "true" && VARIABLES_REMOTION_LAMBDA.every((v) => !!env[v]?.trim());
}

/** Coût estimé (centimes de dollar) d'un montage sur Lambda : par minute de vidéo et par format d'image. */
export const TARIF_LAMBDA_CENTIMES_USD_PAR_MINUTE = 4;
export function coutEstimeLambdaUsd(dureeSec: number, formats: number): number {
  return Math.ceil((Math.max(0, dureeSec) / 60) * Math.max(1, formats) * TARIF_LAMBDA_CENTIMES_USD_PAR_MINUTE);
}

export const fournisseurMontageRemotionLambda: FournisseurMontage = {
  id: "remotion-lambda",
  type: "montage",
  nom: "Montage (serveur du studio + Remotion Lambda)",
  reelPrevu: "Remotion Lambda (AWS)",
  mode: "reel",
  capacites: { asynchrone: true, accordExige: false, dureeMaxSec: 180, retoucheParPlan: true, resolutionMax: 1080, fpsSortie: 25, tarifUsd: { unite: "minute", centimesUsd: TARIF_LAMBDA_CENTIMES_USD_PAR_MINUTE } },
  async assembler(commande) {
    const base = await fournisseurMontageStudioRendu.assembler(commande);
    return { ...base, projetMontage: { ...base.projetMontage, remotion: "lambda", coutEstimeCentimesUsd: coutEstimeLambdaUsd(commande.dureeCibleSec, commande.ratios.length) } };
  },
};
