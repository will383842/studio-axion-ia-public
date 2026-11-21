import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « tableau-de-bord » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "tableau-de-bord",
  litterales: {},
  constantes: [],
  gabarits: [],
  planScenes: {},
  retouche: {},
  exclusCles: {},
  parExpression: {},
  env: [],
  nombre: { litterales: 0, constantes: 0, gabarits: 0, planScenes: 0, retouche: 0, exclusCles: 0, parExpression: 0, env: 0 },
  retirees: [],
};
