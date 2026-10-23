/**
 * BRIQUE « DÉCOR IA » (plan facecam v4 n° 32, lot L10) — option désactivée par défaut (Réglages « Décor IA »).
 * Découpage aux pauses, consigne de l'essai v2, contrôle de raccord, tout ou rien, repli sur l'origine.
 */
export { decouperAuxPauses, pausesDepuisMots, DECOUPAGE_PAR_DEFAUT, type OptionsDecoupage, type Pause, type PassageDecor } from "./decoupage";
export { construireConsigneDecor, nettoyerDescription, REGLES_DECOR_V2, LONGUEUR_MAX_DESCRIPTION, type DemandeDecor } from "./consigne";
export { controlerRaccord, conversionVers25ips, IPS_STUDIO, SEUILS_RACCORD, ZOOM_MAX_APRES_DECOR, type ConversionCadence, type MesuresRaccord, type MorceauAssemblage, type PlanDecor, type SeuilsRaccord, type VerdictRaccord } from "./raccord";
export { creditsPourVideo, ETAPE_DECOR, ligneDecor, MARGE_DECOR, montantCredits, PRIX_CREDIT_HIGGSFIELD_CENTIMES, tientDansLePlafond } from "./cout";
export { appliquerDecor, MESSAGES_DECOR, type DependancesDecor, type EntreeDecor, type RaisonDecor, type ResultatDecor, type SuiviPassage } from "./passe";
