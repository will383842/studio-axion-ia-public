/**
 * BRIQUE MULTICAMÉRA (lot F4) — une prise de face, trois caméras.
 *
 *  - `realisation` : le réalisateur automatique (règles de coupe, PUR) ;
 *  - `coherence`   : contrôle des angles fabriqués et repli sur la face (PUR) ;
 *  - `consigne`    : consignes au double HeyGen, consigne « Monteur, fais-le en 3 caméras » (PUR) ;
 *  - `fabrication` : les deux angles fabriqués et mesurés (fournisseur injecté, simulation par défaut) ;
 *  - `avocat`      : la couche multicaméra du format avocat (option coupée par défaut).
 *  - `reglage`     : réglages cachés `avocat.multicamera` et `facecam.multicamera` (coupés par défaut) ;
 *  - `facecam`     : la couche multicaméra du face caméra (mission H, option coupée par défaut) ;
 *  - `composition` : pose de la piste dans les plans de la composition commune (mission H, tous les formats).
 */
export * from "./types";
export { realiserMulticamera, angleAuTemps, anglesUtilisables, coupeDansUnMot, RYTHME_MULTICAMERA, type EntreeRealisation, type MotRealisation } from "./realisation";
export { verifierAngle, anglesRetenus, TOLERANCES_MULTICAMERA, type MesureAngle, type VerdictAngle } from "./coherence";
export { demandeRenduAngle, estConsigneTroisCameras, CONSIGNE_LOOK_ANGLE, CONSIGNE_GESTES_ANGLE } from "./consigne";
export { fabriquerAngles, type EntreeFabricationAngles, type ResultatFabricationAngles } from "./fabrication";
export { pisteMulticameraAvocat, type EntreeMulticameraAvocat } from "./avocat";
export { lireReglageMulticamera, multicameraDemandee, paramMulticamera, PARAM_MULTICAMERA_AVOCAT, PARAM_MULTICAMERA_FACECAM, REGLAGE_MULTICAMERA_PAR_DEFAUT, type ReglageMulticameraAvocat } from "./reglage";
// Mission H : la même brique pour le face caméra et pour la composition de tous les formats.
export { pisteMulticameraFacecam, multicameraPourComposition, type EntreeMulticameraFacecam } from "./facecam";
export { poserPlansCamera, partsDesAngles, type MulticameraComposition } from "./composition";

export const VERSION_BRIQUE_MULTICAMERA = 1;
