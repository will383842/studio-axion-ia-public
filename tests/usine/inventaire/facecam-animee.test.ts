import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « facecam-animee » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "facecam-animee",
  litterales: {},
  constantes: [
    { cle: "facecamAnimee.calageAuMot", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /PARAM_CALAGE_AU_MOT_FA, false\)\) === true/ },
    { cle: "facecamAnimee.finDouce", etat: "allume", appel: "src/services/facecam-animee.ts", motif: /PARAM_FIN_DOUCE_FA, true\)\) === true/ },
    { cle: "facecamAnimee.extraitsMaison", etat: "eteint", appel: "src/services/facecam-animee.ts", declare: "src/moteurs/montage-facecam-animee/realisateur/consigne-extraits-maison.ts", motif: /PARAM_EXTRAITS_MAISON_FA, false\)\) === true/ },
    { cle: "facecamAnimee.zoomGratuit", etat: "eteint", appel: "src/services/facecam-animee.ts", declare: "src/moteurs/montage-facecam-animee/zoom-gratuit-v4.ts", motif: /PARAM_ZOOM_GRATUIT_FA, false\)\) === true/ },
    { cle: "facecamAnimee.garderMaster", etat: "eteint", appel: "src/services/facecam-animee.ts", declare: "src/moteurs/montage-facecam-animee/master-v4.ts", motif: /PARAM_GARDER_MASTER_FA, false\)\) === true/ },
    { cle: "facecamAnimee.accordEssaiReel", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /lireParametre<boolean>\(PARAM_ACCORD_ESSAI_FA, false\)/ },
    { cle: "facecamAnimee.plafondClaudeUsd", etat: "valeur", appel: "src/services/facecam-animee.ts", motif: /lireParametre<number>\(PARAM_PLAFOND_CLAUDE_FA, PLAFOND_CLAUDE_FA_USD\)/ },
    { cle: "facecamAnimee.plafondVideosUsd", etat: "valeur", appel: "src/services/depense-claude-video.ts", motif: /parametre: PARAM_PLAFOND_VIDEOS_FA, defautUsd: PLAFOND_VIDEOS_FA_USD/ },
    { cle: "facecamAnimee.telephoneVideo", etat: "eteint", appel: "src/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video.ts", motif: /lire\(PARAM_TELEPHONE_VIDEO_FA, false\)\) === true/ },
  ],
  gabarits: [],
  planScenes: {},
  retouche: {},
  exclusCles: {},
  parExpression: {
    "services/depense-claude-video.ts:p.parametre": { couvre: "facecamAnimee.plafondVideosUsd" },
  },
  env: [],
  nombre: { litterales: 0, constantes: 9, gabarits: 0, planScenes: 0, retouche: 0, exclusCles: 0, parExpression: 1, env: 0 },
  retirees: [],
};
