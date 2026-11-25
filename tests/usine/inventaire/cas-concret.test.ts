import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « cas-concret » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "cas-concret",
  litterales: {
    "casConcret.catalogueEtendu": "eteint",
    "casConcret.stockMetiers": "eteint",
  },
  constantes: [
    { cle: "casConcret.porteB", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
    { cle: "casConcret.retouches", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
    { cle: "casConcret.documentPromis", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
    { cle: "casConcret.ecranFourni", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
    { cle: "casConcret.releves", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  ],
  gabarits: [],
  planScenes: {},
  retouche: {},
  exclusCles: {
    "cas-concret.ecrans-fournis": "memoire",
    "casConcret.casAjoutes": "memoire",
    "casConcret.casRemis": "memoire",
    "casConcret.casRetires": "memoire",
    "casConcret.casTraites": "memoire",
    "casConcret.historiqueTirages": "memoire",
    "casConcret.motsBranches": "memoire",
    "casConcret.scriptsValides": "memoire",
    "casConcret.scriptsValidesHistorique": "memoire",
    "casConcret.validations": "memoire",
    "casConcret.cameraPlus": "valeur", // nombre : lireCameraPlus rend undefined si absent ou ≤ 1,035
  },
  parExpression: {
    "services/cas-concret-branchements.ts:cle(c)": { exclu: "memoire" },
    "services/cas-concret-reglages.ts:id": { couvre: "casConcret.porteB" }, // les 7 de REGLAGES_CAS_CONCRET
    "services/cas-concret-retouches.ts:cleParametre(videoId)": { exclu: "memoire" },
  },
  env: [],
  listes: {
    REGLAGES_CAS_CONCRET: 7,
  },
  nombre: { litterales: 2, constantes: 5, gabarits: 0, planScenes: 0, retouche: 0, exclusCles: 11, parExpression: 3, env: 0 },
  retirees: [],
};
