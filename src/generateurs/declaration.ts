/**
 * Déclaration unique de chaque générateur (G1-05a). Donnée pure : aucun service, aucun réglage, aucun argent.
 * Lue par personne dans cette fiche ; G1-05b à e brancheront une table chacune (vignettes, retouche, codes, navigation).
 * Jamais lue par le rendu. Les capacités sont des identifiants du catalogue (`noms.ts`), jamais écrits en dur.
 */
import { ID } from "../briques/bibliotheque-video/noms";
import type { TypeOperationRetouche } from "../moteurs/montage-tableau/retouches";

export type Decoupage = "scenes" | "plans" | "aucun";
export type RatioDeclare = "9:16" | "4:5" | "1:1" | "16:9";

export interface DeclarationGenerateur {
  readonly formatId: string;
  /** Capacités du catalogue que le générateur sait consommer. */
  readonly consomme: readonly string[];
  /** Éléments gardés pour la retouche (le plan, la voix, les rendus de scène). */
  readonly artefacts: readonly string[];
  readonly decoupage: Decoupage;
  /** Opérations de retouche que le générateur sait appliquer. */
  readonly operations: readonly string[];
  /** Le générateur montre-t-il un visage ? */
  readonly visage: boolean;
  readonly ratios: readonly RatioDeclare[];
}

const OPERATIONS_TABLEAU = [
  "remplacerTexteLigne", "marquerMotImportant", "retirerMotImportant", "ajouterMarque", "retirerMarque",
  "remplacerDessin", "supprimerElement", "changerGeste", "deplacerScene", "changerFin", "modifierTexteDit",
] as const satisfies readonly TypeOperationRetouche[];

function figer(d: {
  formatId: string; consomme?: readonly string[]; artefacts?: readonly string[]; decoupage: Decoupage;
  operations?: readonly string[]; visage: boolean; ratios: readonly RatioDeclare[];
}): DeclarationGenerateur {
  return Object.freeze({
    formatId: d.formatId,
    consomme: Object.freeze([...(d.consomme ?? [])]),
    artefacts: Object.freeze([...(d.artefacts ?? [])]),
    decoupage: d.decoupage,
    operations: Object.freeze([...(d.operations ?? [])]),
    visage: d.visage,
    ratios: Object.freeze([...d.ratios]),
  });
}

const PLAN = ["plan"];
const PLAN_ET_VOIX = ["plan", "voix"];
const PLAN_ET_SCENES = ["plan", "voix", "rendus-scenes"];

export const DECLARATIONS: Readonly<Record<string, DeclarationGenerateur>> = Object.freeze({
  "avocat": figer({ formatId: "avocat", consomme: [ID.motionCartesCommunes, ID.cadrageZoomAvocat, ID.transitionCoupe], artefacts: PLAN_ET_VOIX, decoupage: "plans", visage: true, ratios: ["9:16", "4:5", "1:1"] }),
  "facecam": figer({ formatId: "facecam", consomme: [ID.cadrageZoomClassique, ID.transitionCoupe], artefacts: PLAN, decoupage: "aucun", visage: true, ratios: ["9:16"] }),
  "podcast": figer({ formatId: "podcast", artefacts: PLAN, decoupage: "aucun", visage: true, ratios: ["16:9", "9:16"] }),
  "createur-b": figer({ formatId: "createur-b", artefacts: PLAN, decoupage: "aucun", visage: true, ratios: ["9:16"] }),
  "ecran-partage": figer({ formatId: "ecran-partage", artefacts: PLAN, decoupage: "plans", visage: true, ratios: ["9:16"] }),
  "motion": figer({ formatId: "motion", artefacts: PLAN, decoupage: "scenes", visage: false, ratios: ["9:16", "16:9"] }),
  "ugc": figer({ formatId: "ugc", artefacts: PLAN, decoupage: "aucun", visage: true, ratios: ["9:16"] }),
  "selfie": figer({ formatId: "selfie", artefacts: PLAN, decoupage: "aucun", visage: true, ratios: ["9:16"] }),
  "tableau-anime": figer({ formatId: "tableau-anime", artefacts: PLAN_ET_SCENES, decoupage: "scenes", operations: OPERATIONS_TABLEAU, visage: false, ratios: ["9:16"] }),
  "cas-concret": figer({ formatId: "cas-concret", consomme: [ID.planScenesCasConcret, ID.transitionCasConcret, ID.cadrageCameraCasConcret], artefacts: PLAN_ET_SCENES, decoupage: "scenes", visage: false, ratios: ["9:16"] }),
  "facecam-animee": figer({ formatId: "facecam-animee", consomme: [ID.texteSousTitresV4, ID.ecranClipV4, ID.motionPlaquettesV4, ID.sonV4], artefacts: PLAN_ET_VOIX, decoupage: "plans", visage: true, ratios: ["9:16"] }),
  "image-video": figer({ formatId: "image-video", consomme: [ID.transitionImageVideo], artefacts: PLAN_ET_SCENES, decoupage: "scenes", visage: false, ratios: ["9:16"] }),
  "tutoriel-outil": figer({ formatId: "tutoriel-outil", consomme: [ID.planScenesTutorielOutil], artefacts: PLAN_ET_SCENES, decoupage: "scenes", visage: false, ratios: ["4:5", "9:16", "1:1"] }),
  "demo-facecam": figer({ formatId: "demo-facecam", consomme: [ID.cadrageZoomDemo, ID.planScenesDemoFacecam], artefacts: PLAN, decoupage: "plans", visage: true, ratios: ["9:16"] }),
  // VL-05 : artefacts plan/rendus-scenes annoncés, pas encore produits par le moteur (la voix l'est déjà : projetMontage.reprise.voix).
  // G4-09b : tableau de bord, plan et rendus de scène annoncés ; la voix est facultative (variante muette).
  "tableau-de-bord": figer({ formatId: "tableau-de-bord", artefacts: PLAN_ET_SCENES, decoupage: "scenes", visage: false, ratios: ["4:5", "9:16", "1:1", "16:9"] }),
  "video-longue": figer({ formatId: "video-longue", artefacts: PLAN_ET_SCENES, decoupage: "scenes", visage: false, ratios: ["16:9"] }),
});

/** Déclaration du format, `undefined` s'il est inconnu ; ne lève jamais. */
export function declarationDuFormat(formatId: string): DeclarationGenerateur | undefined {
  return Object.prototype.hasOwnProperty.call(DECLARATIONS, formatId) ? DECLARATIONS[formatId] : undefined;
}
