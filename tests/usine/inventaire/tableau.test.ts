import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « tableau » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "tableau",
  litterales: {},
  constantes: [
    { cle: "tableau.styleTire", etat: "allume", appel: "src/services/tableau-creation.ts", motif: /PARAM_STYLE_TIRE_TABLEAU, true\)\.catch\(\(\) => false\)\) === true/ },
    { cle: "tableau.lectureCaptureClaude", etat: "allume", appel: "src/services/lecture-capture-claude.ts", motif: /l<unknown>\(PARAM_LECTURE_CAPTURE_CLAUDE, true\);\s*return v === true \|\| v === undefined \|\| v === null/ },
    { cle: "tableau.raccords", etat: "eteint", appel: "src/services/tableau-branchements.ts", motif: /lireParametre<unknown>\(PARAM_RACCORDS_TABLEAU, false\)\.catch\(\(\) => false\)\) === true/ }, // BR-TABLEAU-RACCORDS-c-v20j
  ],
  gabarits: [],
  planScenes: {},
  retouche: {},
  exclusCles: {
    "tableau.historiqueStyles": "memoire",
    "tableau.methode": "valeur",
  },
  parExpression: {
    "services/tableau-deja-vu-usine.ts:id": { exclu: "relais" }, // passe-plat (id) => lireParametre(id, false) ; clé tableau.deja_vu_usine.actif, seul true allume
  },
  env: [],
  nombre: { litterales: 0, constantes: 3, gabarits: 0, planScenes: 0, retouche: 0, exclusCles: 2, parExpression: 1, env: 0 },
  retirees: [],
};
