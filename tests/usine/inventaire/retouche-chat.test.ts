import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « retouche-chat » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "retouche-chat",
  litterales: {
    "retoucheChat.coller": "eteint",
  },
  constantes: [
    { cle: "retoucheSegments.liberer", etat: "eteint", appel: "src/components/videos/fiche/LibererPlace.tsx", motif: /lireParametre<unknown>\("retoucheSegments\.liberer", false\)\.catch\(\(\) => false\)\) !== true/, aussi: [["src/components/videos/fiche/actions-liberer.ts", /lireParametre<unknown>\("retoucheSegments\.liberer", false\)\.catch\(\(\) => false\)\) === true/]] },
    { cle: "retoucheChat.sansGenerateur", etat: "eteint", appel: "src/services/retouche-chat/garde-acces.ts", motif: /lire\(CLE_REGLAGE_SANS_GENERATEUR, false\)\) === true/ },
  ],
  gabarits: [],
  planScenes: {},
  retouche: {
    "retoucheChat.avocat": "eteint",
    "retoucheChat.imageVideo": "eteint",
    "retoucheChat.facecamAnimee": "eteint",
    "retoucheChat.tutorielOutil": "eteint",
    "retoucheChat.videoLongue": "eteint",
  },
  exclusCles: {},
  parExpression: {
    "app/api/retouche-chat/route.ts:id": { couvre: "retoucheChat.sansGenerateur" },
    "services/retouche-chat/generateurs-studio.ts:id": { couvre: "retoucheChat.avocat" }, // les 5 de CLES_REGLAGE_RETOUCHE
  },
  env: [],
  nombre: { litterales: 1, constantes: 2, gabarits: 0, planScenes: 0, retouche: 5, exclusCles: 0, parExpression: 2, env: 0 },
  retirees: [],
};
