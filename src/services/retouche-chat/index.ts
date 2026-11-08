/** CHAT DE RETOUCHE (lot R1) — partie PURE : comprendre, appliquer, impact. Le service (versions, rendu) est dans `./service`. */
export { comprendreDemande, construireRequeteRetouche, consigneRetouche, demandeExpliciteScript, lectureSimple, MODELE_RETOUCHE_CHAT, resumePlan, type ResultatComprendre } from "./comprendre";
export { appliquerOperations, type RemarqueRetouche, type ResultatAppliquer } from "./appliquer";
export { impactRetouche, phraseImpact, type ImpactRetouche } from "./impact";
export { lireOperations, schemaOperation, MAX_OPERATIONS } from "./schema";
