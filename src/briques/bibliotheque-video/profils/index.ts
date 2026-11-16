/** Profils par format (C1-U3). Pur : aucun service, aucun réglage, aucune date. Rien n'est lu par le rendu. */
import type { ProfilVideo } from "../types";
import { profilNeutre } from "./neutre";
import { PROFIL_AVOCAT } from "./avocat";
import { PROFIL_FACECAM } from "./facecam";
import { PROFIL_FACECAM_ANIMEE } from "./facecam-animee";
import { PROFIL_CAS_CONCRET } from "./cas-concret";
import { PROFIL_IMAGE_VIDEO } from "./image-video";
import { PROFIL_TABLEAU_ANIME } from "./tableau-anime";
import { PROFIL_TUTORIEL_OUTIL } from "./tutoriel-outil";
import { PROFIL_DEMO_FACECAM } from "./demo-facecam";

export { profilNeutre, FORMATS_PROFIL_NEUTRE, EXTRAITS_PAR_DEFAUT } from "./neutre";

export const PROFILS_DU_CODE: Readonly<Record<string, ProfilVideo>> = Object.freeze({
  "avocat": PROFIL_AVOCAT,
  "facecam": PROFIL_FACECAM,
  "facecam-animee": PROFIL_FACECAM_ANIMEE,
  "cas-concret": PROFIL_CAS_CONCRET,
  "image-video": PROFIL_IMAGE_VIDEO,
  "tableau-anime": PROFIL_TABLEAU_ANIME,
  "tutoriel-outil": PROFIL_TUTORIEL_OUTIL,
  "demo-facecam": PROFIL_DEMO_FACECAM,
});

/** Profil du code, sinon profil neutre ; ne lève jamais. */
export function profilDuFormat(formatId: string): ProfilVideo {
  return Object.prototype.hasOwnProperty.call(PROFILS_DU_CODE, formatId) ? PROFILS_DU_CODE[formatId] : profilNeutre(formatId);
}
