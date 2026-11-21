import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « formats » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "formats",
  litterales: {
    afficherExemples: "allume",
    "alignement.voixSynthese": "eteint",
    "formats.prevenir": "valeur",
    "tutoriel.devisAvantDepense": "eteint",
    "tutoriel.finCommune": "eteint",
    "tutoriel.finitions": "eteint",
    "tutoriel.suiviCloche": "eteint",
    "videoLongue.actif": "eteint",
  },
  constantes: [
    // Réserve de tutoriels (RES-1) : éteinte ; seul `actif === true` allume (échec fermé), le défaut est le réglage éteint.
    {
      cle: "tutoriel.reserve.reglages",
      etat: "eteint",
      appel: "src/services/tutoriel-reserve.ts",
      declare: "src/domaine/tutoriel-reserve.ts",
      motif: /lireReglagesReserveBrut\(await lireParametre<unknown>\(PARAM_RESERVE_REGLAGES, null\)\)/,
      aussi: [["src/domaine/tutoriel-reserve.ts", /REGLAGES_RESERVE_DEFAUT: ReglagesReserve = \{\s*actif: false/]],
    },
    // RES-3 : équipe de rôles, lue par le tirage de la réserve ; éteinte, seul `true` exact allume (même lecture que `equipeTutorielActive`).
    { cle: "tutoriel.equipe", etat: "eteint", appel: "src/services/tutoriel-reserve-tirage.ts", declare: "src/services/tutoriel-equipe.ts", motif: /lireParametre<unknown>\(PARAM_EQUIPE_TUTORIEL, false\)\) === true/ },
    { cle: "tutoriel.entreeZip", etat: "eteint", appel: "src/services/zip-tutoriel.ts", motif: /lireParametre\(PARAM_ENTREE_ZIP, false\)\) === true/ },
    { cle: "tutoriel.scenesGardees", etat: "eteint", appel: "src/services/scenes-tutoriel.ts", motif: /lireParametre<unknown>\(PARAM_SCENES_TUTORIEL, false\)\) === true/ },
    { cle: "facecam.aligneur.reel", etat: "allume", appel: "src/services/fabrication.ts", motif: /lireParametre<boolean>\(PARAM_FACECAM_REEL, true\)\) === true/ },
    { cle: "imageVideo.accordEssaiReel", etat: "eteint", appel: "src/services/image-video-ecran.ts", motif: /PARAM_ACCORD_ESSAI_IV, false\)/ },
    { cle: "imageVideo.sousTitresMinimal", etat: "eteint", appel: "src/services/image-video.ts", motif: /lireParametre<unknown>\(PARAM_SOUS_TITRES_MINIMAL_IV, false\)\.catch\(\(\) => false\)\) === true/ },
    { cle: "imageVideo.relireScript", etat: "eteint", appel: "src/services/image-video-ecran.ts", motif: /lireParametre<boolean>\(PARAM_RELIRE_SCRIPT_IV, false\)/ },
    { cle: "avocat.multicamera", etat: "eteint", appel: "src/services/multicamera-avocat.ts", declare: "src/briques/multicamera/reglage.ts", motif: /lireParametre<unknown>\(PARAM_MULTICAMERA_AVOCAT, null\)/ },
    { cle: "facecam.multicamera", etat: "eteint", appel: "src/services/multicamera.ts", declare: "src/briques/multicamera/reglage.ts", motif: /lireParametre<unknown>\(paramMulticamera\(format\), null\)/ },
    { cle: "demoFacecam.reel", etat: "eteint", appel: "src/services/entrees-demo-facecam.ts", motif: /lireParametre<unknown>\(CLE_REGLAGE_DEMO_REEL, false\)\) === true/ },
    { cle: "demoFacecam.envoi", etat: "eteint", appel: "src/app/(studio)/demo-facecam/actions.ts", motif: /lireParametre<unknown>\(CLE_ENVOI_DEMO_FACECAM, false\)\) === true/ },
    { cle: "demoFacecam.planClaude", etat: "allume", appel: "src/services/demo-facecam-claude.ts", motif: /l<unknown>\(PARAM_PLAN_CLAUDE_DEMO, true\);\s*return v === true \|\| v === undefined \|\| v === null/ },
    { cle: "avocat.bandeauNom", etat: "eteint", appel: "src/services/bandeau-nom.ts", motif: /lireParametre<unknown>\(PARAM_BANDEAU_AVOCAT, false\)\) !== true/ },
    // Montage avocat (voisin de zone interdite) : lecture du texte seulement, jamais d'import.
    {
      cle: "avocat.motionCommune",
      etat: "allume",
      appel: "src/services/avocat-branchements.ts",
      declare: "src/moteurs/montage-avocat/motion.ts",
      motif: /motionAllumeeParDefaut\(PARAM_MOTION_AVOCAT\)/,
      aussi: [["src/services/avocat-branchements.ts", /async function motionAllumeeParDefaut[\s\S]*?lireParametre<unknown>\(param, null\);\s*if \(v === false\) return null;/]],
    },
    {
      cle: "avocat.monteur",
      etat: "eteint",
      appel: "src/services/avocat-branchements.ts",
      declare: "src/moteurs/montage-avocat/monteur.ts",
      motif: /await allume\(PARAM_MONTEUR_AVOCAT\)/,
      aussi: [["src/services/avocat-branchements.ts", /async function allume\(param: string\)[\s\S]*?lireParametre<unknown>\(param, null\);\s*if \(v === true\) return \{\};/]],
    },
    {
      cle: "voix.ressemblance",
      etat: "allume",
      appel: "src/services/voix-ressemblance.ts",
      declare: "src/briques/voix-maitre/reference.ts",
      motif: /lireReglageRessemblance\(await lireParametre<unknown>\(PARAM_RESSEMBLANCE_VOIX, null\)\)/,
      aussi: [["src/briques/voix-maitre/reference.ts", /RESSEMBLANCE_VOIX_PAR_DEFAUT[^=]*= Object\.freeze\(\{ actif: true/]],
    },
    {
      cle: "facecam.decorIa",
      etat: "eteint",
      appel: "src/services/decor-ia.ts",
      motif: /lireReglageBrut\(await lireParametre<unknown>\(PARAM_DECOR_IA, null\)\)/,
      aussi: [["src/services/decor-ia.ts", /actif: o\.actif === true/]],
    },
    {
      cle: "facecam.effetRealiste",
      etat: "eteint",
      appel: "src/services/effet-realiste-ia.ts",
      motif: /lireParametre<\{ reel\?: unknown \}>\(PARAM_REGLAGE_EFFET, \{\}\);\s*return \{ reel: r\?\.reel === true \}/,
    },
    // Avatar HeyGen PAYANT (zone argent) : lecture du texte seulement, jamais d'import.
    {
      cle: "double.rendu",
      etat: "eteint",
      appel: "src/services/rendu-double.ts",
      motif: /lireParametre<Partial<ReglageRenduDouble> \| null>\(CLE, null\);\s*return \{ allume: v\?\.allume === true/,
    },
    {
      cle: "double.looks",
      etat: "eteint",
      appel: "src/services/rendu-double.ts",
      motif: /lireParametre<\{ allume\?: boolean \} \| null>\(CLE_LOOKS, null\);\s*return v\?\.allume === true \|\| \(v === null && LOOKS_HEYGEN_PAR_LE_STUDIO\)/,
      // Absent → constante : la passer à `true` allumerait une dépense, l'inventaire doit rougir.
      aussi: [["src/fournisseurs/heygen/rendus.ts", /export const LOOKS_HEYGEN_PAR_LE_STUDIO = false;/]],
    },
  ],
  gabarits: [
    { gabarit: "moteur.*.jeLis", etat: "eteint", appel: "src/services/reglages.ts", motif: /lireParametre<boolean>\(`moteur\.\$\{formatId\}\.jeLis`, false\)\) === true/ },
    { gabarit: "moteur.*.montageReel", etat: "eteint", appel: "src/services/reglages.ts", motif: /lireParametre<boolean>\(`moteur\.\$\{formatId\}\.montageReel`, false\)\) === true/ },
  ],
  planScenes: {},
  retouche: {},
  exclusCles: {
    "tutoriel.index-scenes": "memoire",
    "facecam.habitudes": "memoire",
    "facecam.look": "memoire",
    "imageVideo.cartesValidees": "memoire",
    "imageVideo.lots": "memoire",
    "imageVideo.reserve": "memoire",
    "tutoriel.reserve.index": "memoire", // RES-1 : index FIFO de la réserve (données, pas un interrupteur)
    "tutoriel.reserve.historique": "memoire", // RES-1 : historique des tirages
    "facecam.plafondVersionUsd": "valeur",
    "tutoriel.plafondClaudeUsd": "valeur", // RES-3 : plafond Claude d'une vidéo (nombre > 0 sinon défaut du mode), lu par le tirage
    "moteur.*": "valeur",
  },
  parExpression: {
    "services/tutoriel-reserve.ts:cleElementReserve(id)": { exclu: "memoire" }, // RES-1 : fiche d'un élément de la réserve
    "services/tutoriel-reserve.ts:cleTirageReserve(cle)": { exclu: "memoire" }, // RES-1 : fiche de tirage (rejeu par clé)
    "services/zip-tutoriel.ts:id": { exclu: "relais" }, // port réel de l'entrée zip : la clé est PARAM_ENTREE_ZIP, tutoriel.entreeZip en table
    "services/tutoriel-depot.ts:id": { exclu: "relais" }, // lecteur des 3 interrupteurs du formulaire (T-EXT-33) : la clé est passée en paramètre (tutoriel.formulaire, tutoriel.entreeZip, tutoriel.entreePhrase)
    // VL-07 : registre de dépense et morceaux déjà lus de la vidéo longue (mémoire par vidéo, pas des interrupteurs).
    "services/video-longue-branchements.ts:cleDepense(videoId)": { exclu: "memoire" },
    "services/video-longue-branchements.ts:cle": { exclu: "memoire" },
    "services/avocat-branchements.ts:param": { couvre: "avocat.motionCommune" }, // et avocat.monteur (enveloppe allume())
    "services/effet-realiste-ia.ts:PARAM_RESULTATS(d.videoId)": { exclu: "memoire" },
    "services/effet-realiste-ia.ts:PARAM_RESULTATS(videoId)": { exclu: "memoire" },
    "services/express.ts:cleDecorHabituel(formatId)": { exclu: "valeur" },
    "services/generateur-ecran.ts:cleRetouches(c)": { exclu: "memoire" },
    "services/generateur-ecran.ts:cleScriptRelu(o.operationId)": { exclu: "memoire" },
    "services/image-video-lot.ts:cleLot(id)": { exclu: "memoire" },
    "services/image-video-carte.ts:`${PREFIXE_DECISIONS}${videoId}`": { exclu: "memoire" },
    "services/image-video.ts:`${PREFIXE_DECISIONS}${dep.videoId}`": { exclu: "memoire" },
    "services/modifications.ts:cle(videoId)": { exclu: "memoire" },
    "services/monteur-facecam.ts:CLE_FIL(videoId)": { exclu: "memoire" },
    "services/multicamera.ts:paramMulticamera(format)": { couvre: "facecam.multicamera" },
  },
  env: [],
  nombre: { litterales: 8, constantes: 21, gabarits: 2, planScenes: 0, retouche: 0, exclusCles: 11, parExpression: 18, env: 0 },
  retirees: [],
};
