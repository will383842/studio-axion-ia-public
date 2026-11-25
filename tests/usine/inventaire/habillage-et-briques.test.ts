import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « habillage-et-briques » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "habillage-et-briques",
  litterales: {
    "illustrations.economique": "eteint",
    "miniature.gabarit": "valeur",
    "style.faconDeParler": "valeur",
  },
  constantes: [
    { cle: "varieteCommune", etat: "eteint", appel: "src/services/variete-commune/lire-reglage.ts", declare: "src/briques/variete-commune/reglage.ts", motif: /lireParametre<unknown>\(cle, false\)/ }, // BR-TABLEAU-STYLE-b2 : seul true ou { seuil } allume
    { cle: "habillage.transitionsPlanScenes", etat: "eteint", appel: "src/briques/motion/habillage-commun/reglage.ts", motif: /estAllume\(await lire\(/ },
    { cle: "pioche.commune", etat: "eteint", appel: "src/services/pioche-commune.ts", motif: /lireParametre<unknown>\(PARAM_PIOCHE_COMMUNE, false\)\) !== true/ },
    { cle: "couverture.titreParDefaut", etat: "eteint", appel: "src/services/miniatures.ts", declare: "src/domaine/vignettes.ts", motif: /lireParametre<boolean>\(REGLAGE_TITRE_COUVERTURE, false\)\) !== true/ },
    { cle: "planScenes.facecamDessin", etat: "allume", appel: "src/briques/plan-scenes-generateurs/dessin-facecam-porte.ts", motif: /lire\(CLE_REGLAGE_DESSIN_FACECAM, true\)\) !== false/ },
    { cle: "bibliothequeVideo.archive.inscription", etat: "eteint", appel: "src/services/archive-extraits.ts", motif: /lireParametre<unknown>\(REGLAGE_INSCRIPTION, false\)\) !== true/, aussi: [["src/app/(studio)/bibliotheque/source-extraits/page.tsx", /lireParametre<unknown>\(REGLAGE_INSCRIPTION, false\)\) === true/], ["src/services/extraits-de-la-video.ts", /archive = await lire\(REGLAGE_INSCRIPTION, false\);[\s\S]*?if \(archive !== true\) return eteint;/]] },
    { cle: "bibliothequeVideo.archive.effacerFicheASuppression", etat: "eteint", appel: "src/services/suppression-video.ts", motif: /lireParametre<unknown>\(REGLAGE_EFFACER_FICHE_EXTRAITS, false\)\) === true/ },
  ],
  gabarits: [
    {
      gabarit: "illustrations.economique.*",
      etat: "eteint",
      appel: "src/services/illustrations.ts",
      motif: /lireParametre<boolean \| null>\(cleEconomique\(videoId\), null\);\s*return v \?\? \(await lireParametre<boolean>\("illustrations\.economique", false\)\)/,
      declare: /cleEconomique = \(videoId: Id\) => `illustrations\.economique\.\$\{videoId\}`/,
    },
    {
      // Défaut `undefined` → `interpreterReglageBibliotheque` rend `{ actif: false }` (seul `true` ou `{ capacites }` allume).
      gabarit: "bibliothequeVideo.*",
      etat: "eteint",
      appel: "src/services/bibliotheque-video.ts",
      motif: /lireReglageBibliotheque\(video\.formatId, \(cle\) => lireParametre\(cle, undefined\)\);\s*if \(!reglage\.actif\) return \{\}/,
    },
  ],
  planScenes: {
    "planScenes.casConcret": "allume",
    "planScenes.facecam": "allume", // CHANGERA : C5-5.02
    "planScenes.facecamAnimee": "allume",
  },
  retouche: {},
  exclusCles: {
    "bibliothequeVideo.archive.dernierPassage": "memoire",
    "bibliothequeVideo.archive.examinees": "memoire",
    "decors.lots": "memoire",
    "illustrations.compteurVideos": "memoire",
    "motion.animations-gardees": "memoire",
    "bibliothequeVideo.archive.cochees": "valeur", // liste d'identifiants de vidéos cochées
    "bibliothequeVideo.archive.sources": "valeur", // choix « pretes » | « cochees » | « publiees », défaut null → politique du code
  },
  parExpression: {
    "services/variete-commune/lire-reglage.ts:cle": { couvre: "varieteCommune" },
    "services/bibliotheque-video.ts:cle": { couvre: "bibliothequeVideo.*" }, // cleReglageBibliotheque(formatId)
    "services/decors.ts:cleLot(id)": { exclu: "memoire" },
    "services/dosage-motion-defauts.ts:id": { exclu: "relais" }, // passe-plat vers defautsLus/dosageActif (briques/dosage-motion/reglage.ts : dosageMotion.defauts valeur, dosageMotion.actif `=== true` défaut false)
    "services/dosage-motion.ts:id": { exclu: "relais" }, // idem
    "services/extraits-de-la-video.ts:id": { exclu: "relais" }, // passe-plat vers lire(REGLAGE_INSCRIPTION…) (couvert, bibliothequeVideo.archive.inscription) et lireNoteInteret
    "services/illustrations.ts:cleRang(videoId)": { exclu: "memoire" },
    "services/illustrations.ts:cleEconomique(videoId)": { couvre: "illustrations.economique.*" },
  },
  env: [],
  nombre: { litterales: 3, constantes: 7, gabarits: 2, planScenes: 3, retouche: 0, exclusCles: 7, parExpression: 8, env: 0 },
  retirees: [],
};
