/**
 * FB-REEL-a : règle PURE du Reel Facebook. Une vidéo part en Reel si elle est en 9:16 et que sa durée est dans les
 * bornes REEL_FACEBOOK_DUREE_SEC (importées, jamais recopiées). Aucun réseau, aucun service.
 */
import { REEL_FACEBOOK_DUREE_SEC } from "../fournisseurs/publication/zernio-corps";

export interface VideoReelFacebook {
  format: string;
  dureeSec?: number;
}

const { min, max } = REEL_FACEBOOK_DUREE_SEC;

const dureeValide = (d: number | undefined): d is number => d !== undefined && Number.isFinite(d);

export function estReelFacebook(v: VideoReelFacebook): boolean {
  return v.format === "9:16" && dureeValide(v.dureeSec) && v.dureeSec >= min && v.dureeSec <= max;
}

/** Avertissement en français (vouvoiement) quand la vidéo ne part pas en Reel ; null sinon. */
export function avertissementReelFacebook(v: VideoReelFacebook): string | null {
  if (estReelFacebook(v)) return null;
  if (v.format !== "9:16") {
    return `Cette vidéo est en ${v.format} : pour partir en Reel Facebook, elle doit être au format 9:16. Vous pouvez la publier, mais elle ne sera pas un Reel.`;
  }
  if (!dureeValide(v.dureeSec)) {
    return `La durée de cette vidéo est inconnue : vérifiez qu'elle dure entre ${min} et ${max} secondes pour qu'elle parte en Reel Facebook.`;
  }
  if (v.dureeSec < min) {
    return `Cette vidéo dure moins de ${min} secondes : elle est trop courte pour partir en Reel Facebook. Vous pouvez la publier, mais elle ne sera pas un Reel.`;
  }
  return `Cette vidéo dépasse ${max} secondes : elle est trop longue pour partir en Reel Facebook. Vous pouvez la publier, mais elle ne sera pas un Reel.`;
}
