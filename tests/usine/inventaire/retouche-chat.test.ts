import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « retouche-chat » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "retouche-chat",
  litterales: {
    "retoucheChat.coller": "eteint",
  },
  constantes: [
    {
      cle: "retoucheSegments.liberer",
      etat: "eteint",
      appel: "src/components/videos/fiche/LibererPlace.tsx",
      motif:
        /lireParametre<unknown>\("retoucheSegments\.liberer", false\)\.catch\(\(\) => false\)\) !== true/,
      aussi: [
        [
          "src/components/videos/fiche/actions-liberer.ts",
          /lireParametre<unknown>\("retoucheSegments\.liberer", false\)\.catch\(\(\) => false\)\) === true/,
        ],
      ],
    },
    {
      cle: "retoucheChat.sansGenerateur",
      etat: "eteint",
      appel: "src/services/retouche-chat/garde-acces.ts",
      motif: /lire\(CLE_REGLAGE_SANS_GENERATEUR, false\)\) === true/,
    },
    // ALLUMER-LECTEUR-CHAT-v20k (Williams 20/11 23:55, plafond 0,25 $/vidéo) : les 3 clés de lecteur passent à « allume » (lignes MODIFIÉES, seconde lecture du pilote).
    {
      cle: "retoucheChat.facecamAnimeeLecteur",
      etat: "allume",
      appel: "src/services/retouche-chat/lecteur-studio.ts",
      declare: "src/services/retouche-chat/lecteur-generateurs.ts",
      motif: /lireParametre<unknown>\(cle, true\)\) === true/,
    },
    {
      cle: "retoucheChat.demoFacecamLecteur",
      etat: "allume",
      appel: "src/services/retouche-chat/lecteur-studio.ts",
      declare: "src/services/retouche-chat/lecteur-generateurs.ts",
      motif: /lireParametre<unknown>\(cle, true\)\) === true/,
    },
    {
      cle: "retoucheChat.facecamAnimeeExtraits",
      etat: "eteint",
      appel: "src/services/facecam-animee-retouche.ts",
      motif: /lire\(PARAM_RETOUCHE_EXTRAITS_FA, false\)\)\.catch\(\(\) => false\)\) === true/,
    }, // R4-03-c2-v20j
    {
      cle: "retoucheChat.facecamAnimeePlaquettes",
      etat: "eteint",
      appel: "src/services/facecam-animee-retouche.ts",
      motif: /lire\(PARAM_PLAQUETTES_FA, false\)\)\.catch\(\(\) => false\)\) === true/,
    }, // S-15-b3-v21s
    {
      cle: "retoucheChat.tableauLecteur",
      etat: "allume",
      appel: "src/services/retouche-chat/lecteur-studio.ts",
      motif: /lireParametre<unknown>\(cle, true\)\) === true/,
    },
  ],
  gabarits: [],
  planScenes: {},
  retouche: {
    "retoucheChat.avocat": "eteint",
    "retoucheChat.imageVideo": "eteint",
    "retoucheChat.facecamAnimee": "eteint",
    "retoucheChat.tutorielOutil": "eteint",
    "retoucheChat.videoLongue": "eteint",
    "retoucheChat.demoFacecam": "allume",
  },
  exclusCles: {},
  parExpression: {
    "app/api/retouche-chat/route.ts:id": { couvre: "retoucheChat.sansGenerateur" },
    "services/retouche-chat/generateurs-studio.ts:id": { couvre: "retoucheChat.avocat" }, // les 6 de CLES_REGLAGE_RETOUCHE
    "services/retouche-chat/lecteur-studio.ts:cle": { couvre: "retoucheChat.facecamAnimeeLecteur" }, // les 3 clés de lecteur (CLES_REGLAGE_LECTEUR + tableau)
  },
  env: [],
  nombre: {
    litterales: 1,
    constantes: 7,
    gabarits: 0,
    planScenes: 0,
    retouche: 6,
    exclusCles: 0,
    parExpression: 3,
    env: 0,
  },
  retirees: [],
};
