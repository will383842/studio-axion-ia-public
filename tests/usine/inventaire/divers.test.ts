import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « divers » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "divers",
  litterales: {},
  constantes: [],
  gabarits: [],
  planScenes: {},
  retouche: {},
  exclusCles: {},
  parExpression: {
    "services/_commun.ts:id: string": { exclu: "relais" },
  },
  env: [
    { nom: "USINE_TOUT_ARRETER", fichier: "src/app/api/usine/commandes/route.ts" },
    { nom: "STUDIO_PORTE_SECRET", fichier: "src/usine/garde-porte.ts" },
  ],
  nombre: { litterales: 0, constantes: 0, gabarits: 0, planScenes: 0, retouche: 0, exclusCles: 0, parExpression: 1, env: 2 },
  retirees: [],
};
