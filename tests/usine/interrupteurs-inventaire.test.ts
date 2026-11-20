/**
 * Inventaire G7-06. Lit des constantes de zones argent et publication SANS les modifier ni les importer. Constate, n'exige pas.
 * C5-5.02 changera `planScenes.facecam` (ligne marquée `// CHANGERA : C5-5.02`).
 *
 * Trois sources : (1) la table figée ci-dessous ; (2) les fichiers purs importés (réglages plan de scènes, retouche chat) ;
 * (3) le texte de `src/**` (clés littérales passées à `lireParametre`). Une clé neuve absente de la table doit être éteinte
 * par défaut (seul `true` allume, R-9). Aucune lecture de la base, aucun import de fichier d'argent.
 *
 * Le filet refuse, pour une clé neuve, un défaut `true` OU un défaut objet allumé (`{ actif: true }`, forme de `site.reglages`,
 * ou `{ allume: true }`, forme de `double.rendu` / `double.looks`),
 * que la clé soit littérale, passée par constante `const NOM = "clé"` ou écrite en gabarit `` `x.${id}` ``.
 *
 * Limites connues du filet : (a) un appel à clé VARIABLE (`lireParametre(cle, true)` où `cle` vient d'une liste, d'un
 * paramètre ou d'une fonction `cleX(id)`) lui échappe : ces listes et gabarits sont donc inventoriés un à un ci-dessous
 * (REGLAGES_CAS_CONCRET, CLES_INTERRUPTEURS_ECRITURE, INTERRUPTEURS_PUBLICATION, INTERRUPTEURS_PRODUCTION, gabarits `moteur.*`,
 * `siteGenerateurs.*`, `siteAuto.*`, `illustrations.economique.*`) ; (b) une lecture par fonction-enveloppe à défaut `null` ou
 * `undefined` dont l'enveloppe décide « allumé si absent » (`motionAllumeeParDefaut` d'avocat-branchements.ts, `bufferGele`,
 * `lireReglageRessemblance`) ou « absent → constante » (`double.looks` : `v === null && LOOKS_HEYGEN_PAR_LE_STUDIO`, constante
 * de src/fournisseurs/heygen/rendus.ts) ne peut pas être jugée par le filet : ces cas sont constatés un à un dans PAR_CONSTANTE,
 * avec le texte de l'enveloppe (et de la constante) ; le test méta « recensement » oblige chaque appel à y figurer ou à être exclu ;
 * (c) les lectures directes `depots().parametres.obtenir(id)` (hors `lireParametre`) ne sont pas vues.
 * Restent volontairement HORS table (listés un à un dans EXCLUS_CLES et PAR_EXPRESSION, avec leur motif ; le test
 * « recensement » refuse tout appel `lireParametre` de src/** ni en table ni exclu), car ce sont des marques de dédoublonnage,
 * des mémoires ou des valeurs, et non des interrupteurs : `credits.*.${id}` (cleRefusee, lancementPret, expiration, epuise, test, rapprochement, alertes),
 * `budget.engage.*`, la `cle` de budget-mensuel.ts:232, autonomie-usine.ts:319 et :326, mode-budget.ts:108,
 * plafond-fournisseur.ts:74, `cleAlerteBudget()` (couts.ts), `paramRepriseDeWill(id)` (drapeau d'un seul tour,
 * generation-claude.ts), et les mémoires/données (`*.validations`, `*.lots`, `parcours.conversations*`, `zernio.bascules`,
 * `zernio.mode_envoi`, `zernio.tests`, etc.).
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { ALLUME_PAR_DEFAUT, CLES_REGLAGE_PLAN_SCENES } from "@/briques/plan-scenes-generateurs/reglage";
import { CLES_REGLAGE_RETOUCHE } from "@/services/retouche-chat/generateurs";

type Etat = "allume" | "eteint" | "valeur" | "env";

/** Clés littérales de `lireParametre("…", défaut)` dans src/** (30 sur master 240a0e6 ; 31 avec `retoucheChat.coller`, C7 ; 32 avec `zernio.synchro_etape_visuels`, L5-06 ; 33 avec `mesures.lecture_par_liste`, L8-02b ; 34 avec `mesures.tentatives_lecture`, rotation des lectures ; 35 avec `accueil.bilan_semaine`, L8-04a ; 36 avec `mesures.relecture_automatique`, L5-18b ; 37 avec `tutoriel.finitions`, T-EXT-31 ; 38 avec `tutoriel.suiviCloche`, T-EXT-34 ; 39 avec `videoLongue.actif`, VL-07 ; 40 avec `tutoriel.devisAvantDepense`, T-EXT-42). */
const LITTERALES: Record<string, Etat> = {
  "accueil.bilan_semaine": "eteint",
  afficherExemples: "allume",
  "alignement.voixSynthese": "eteint",
  "budget.mensuel": "valeur",
  "budget.seuilConfirmation": "valeur",
  "casConcret.catalogueEtendu": "eteint",
  "casConcret.stockMetiers": "eteint",
  "fabrication.concurrence": "valeur",
  "formats.prevenir": "valeur",
  "fournisseur.alignement": "valeur",
  "fournisseur.illustration": "valeur",
  "fournisseur.montage": "valeur",
  "fournisseur.notification": "valeur",
  "fournisseur.stockage": "valeur",
  "illustrations.economique": "eteint",
  "mentionIA.parDefaut": "valeur",
  "mesures.lecture_par_liste": "eteint",
  "mesures.relecture_automatique": "eteint",
  "mesures.tentatives_lecture": "valeur",
  "miniature.gabarit": "valeur",
  "mots.registre": "valeur",
  notifications: "valeur",
  "parcours.oppositions.file": "valeur",
  "publication.heureParReseau": "valeur",
  "publication.ordreParDefaut": "valeur",
  "publication.pageSuivie": "valeur",
  "publication.routage": "valeur",
  "push.abonnements": "valeur",
  "retoucheChat.coller": "eteint",
  "reseaux.parDefaut": "valeur",
  "site.lienDansYoutube": "eteint",
  "style.faconDeParler": "valeur",
  "taux.usdEur": "valeur",
  "tutoriel.devisAvantDepense": "eteint",
  "tutoriel.finitions": "eteint",
  "tutoriel.suiviCloche": "eteint",
  "videoLongue.actif": "eteint",
  "veille.derniereLecture": "valeur",
  "veille.resumeSemaine": "valeur",
  "zernio.synchro_etape_visuels": "eteint",
};

/**
 * Clés passées par constante : lues dans le TEXTE (jamais importé). `appel` : fichier où la clé est lue ; `declare` : fichier
 * de la déclaration de la constante (par défaut `appel`) ; `motif` doit figurer dans `appel` et contient le DÉFAUT constaté.
 */
type Constante = { cle: string; etat: Etat; appel: string; motif: RegExp; declare?: string; aussi?: [fichier: string, motif: RegExp][] };
const PAR_CONSTANTE: Constante[] = [
  { cle: "tutoriel.scenesGardees", etat: "eteint", appel: "src/services/scenes-tutoriel.ts", motif: /lireParametre<unknown>\(PARAM_SCENES_TUTORIEL, false\)\) === true/ },
  { cle: "aPublier.page", etat: "allume", appel: "src/services/a-publier.ts", motif: /lireParametre<unknown>\(PARAM_PAGE_A_PUBLIER, true\)\) !== false/ },
  { cle: "zernio.envoi_autorise", etat: "allume", appel: "src/services/zernio.ts", motif: /PARAM_ARRET_ZERNIO, true\)\) !== false/ },
  { cle: "facecam.aligneur.reel", etat: "allume", appel: "src/services/fabrication.ts", motif: /lireParametre<boolean>\(PARAM_FACECAM_REEL, true\)\) === true/ },
  { cle: "publication.editoriale_active", etat: "eteint", appel: "src/services/zernio.ts", motif: /PARAM_EDITORIALE_ACTIVE, false\)\) === true/ },
  { cle: "idees.comite", etat: "eteint", appel: "src/services/comite-editorial.ts", motif: /PARAM_COMITE, false\)\) === true/ },
  { cle: "gardien.chiffres.actif", etat: "eteint", appel: "src/services/gardien-chiffres.ts", motif: /REGLAGE_GARDIEN_CHIFFRES, false\)\) === true/ },
  { cle: "comite.source_usine.actif", etat: "eteint", appel: "src/services/branchement-idees-usine.ts", motif: /REGLAGE_SOURCE_USINE, false\)\) === true/ },
  { cle: "facecamAnimee.calageAuMot", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /PARAM_CALAGE_AU_MOT_FA, false\)\) === true/ },
  { cle: "facecamAnimee.finDouce", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /PARAM_FIN_DOUCE_FA, false\)\) === true/ },
  { cle: "facecamAnimee.accordEssaiReel", etat: "eteint", appel: "src/services/facecam-animee.ts", motif: /lireParametre<boolean>\(PARAM_ACCORD_ESSAI_FA, false\)/ },
  { cle: "facecamAnimee.plafondClaudeUsd", etat: "valeur", appel: "src/services/facecam-animee.ts", motif: /lireParametre<number>\(PARAM_PLAFOND_CLAUDE_FA, PLAFOND_CLAUDE_FA_USD\)/ },
  { cle: "facecamAnimee.plafondVideosUsd", etat: "valeur", appel: "src/services/depense-claude-video.ts", motif: /parametre: PARAM_PLAFOND_VIDEOS_FA, defautUsd: PLAFOND_VIDEOS_FA_USD/ },
  { cle: "imageVideo.accordEssaiReel", etat: "eteint", appel: "src/services/image-video-ecran.ts", motif: /PARAM_ACCORD_ESSAI_IV, false\)/ },
  { cle: "imageVideo.sousTitresMinimal", etat: "eteint", appel: "src/services/image-video.ts", motif: /lireParametre<unknown>\(PARAM_SOUS_TITRES_MINIMAL_IV, false\)\.catch\(\(\) => false\)\) === true/ },
  { cle: "facecamAnimee.telephoneVideo", etat: "eteint", appel: "src/moteurs/montage-facecam-animee/realisateur/consigne-telephone-video.ts", motif: /lire\(PARAM_TELEPHONE_VIDEO_FA, false\)\) === true/ },
  { cle: "habillage.transitionsPlanScenes", etat: "eteint", appel: "src/briques/motion/habillage-commun/reglage.ts", motif: /estAllume\(await lire\(/ },
  { cle: "imageVideo.relireScript", etat: "eteint", appel: "src/services/image-video-ecran.ts", motif: /lireParametre<boolean>\(PARAM_RELIRE_SCRIPT_IV, false\)/ },
  { cle: "usine.autonomie", etat: "eteint", appel: "src/services/autonomie-usine.ts", motif: /lireParametre<unknown>\(CLE_REGLAGE, null\)/ },
  { cle: "usine.autonomie.porte", etat: "eteint", appel: "src/services/autonomie-usine.ts", motif: /lireParametre<unknown>\(CLE_PORTE, null\)/ },
  { cle: "carrousels.actif", etat: "eteint", appel: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
  { cle: "infographies.actif", etat: "eteint", appel: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
  { cle: "avocat.multicamera", etat: "eteint", appel: "src/services/multicamera-avocat.ts", declare: "src/briques/multicamera/reglage.ts", motif: /lireParametre<unknown>\(PARAM_MULTICAMERA_AVOCAT, null\)/ },
  { cle: "facecam.multicamera", etat: "eteint", appel: "src/services/multicamera.ts", declare: "src/briques/multicamera/reglage.ts", motif: /lireParametre<unknown>\(paramMulticamera\(format\), null\)/ },
  { cle: "zernio.youtube_actif", etat: "eteint", appel: "src/services/youtube-zernio.ts", declare: "src/fournisseurs/publication/zernio-youtube.ts", motif: /lireParametre<unknown>\(CLE_YOUTUBE_ACTIF, false\)/ },
  { cle: "limite_appels.active", etat: "eteint", appel: "src/services/limite-appels.ts", motif: /lireParametre<boolean>\(PARAM_LIMITE_ACTIVE, false\)\) !== true/ },
  { cle: "kb_site.lecture.actif", etat: "eteint", appel: "src/services/kb-site.ts", motif: /REGLAGE_LECTURE_SITE, false\)\) === true/ },
  { cle: "kb_site.methode.actif", etat: "eteint", appel: "src/services/kb-site.ts", motif: /REGLAGE_METHODE_SITE, false\)\) === true/ },
  { cle: "ecriture.memoireCasConcret", etat: "eteint", appel: "src/services/memoire-cas-concret.ts", motif: /REGLAGE_MEMOIRE_CAS_CONCRET, false\)\) === true/ },
  { cle: "ecriture.memoireCentrale", etat: "eteint", appel: "src/services/memoire-centrale.ts", motif: /REGLAGE_MEMOIRE_CENTRALE, false\)\) === true/ },
  { cle: "site.passeportParClaude", etat: "eteint", appel: "src/services/site-videos.ts", motif: /PARAM_PASSEPORT_PAR_CLAUDE, false\)\) === true/ },
  { cle: "parcours.instagram_suivre", etat: "eteint", appel: "src/services/parcours-instagram.ts", motif: /lireParametre<unknown>\(PARAM_INSTAGRAM_SUIVRE, false\)/ },
  { cle: "parcours.instagram_public", etat: "eteint", appel: "src/services/parcours-instagram.ts", motif: /lireParametre<unknown>\(PARAM_INSTAGRAM_PUBLIC, false\)/ },
  { cle: "pioche.commune", etat: "eteint", appel: "src/services/pioche-commune.ts", motif: /lireParametre<unknown>\(PARAM_PIOCHE_COMMUNE, false\)\) !== true/ },
  { cle: "parcours.mots_multiples", etat: "eteint", appel: "src/services/parcours-mots-multiples.ts", motif: /lireParametre<unknown>\(PARAM_MOTS_MULTIPLES, false\)/ },
  { cle: "couverture.titreParDefaut", etat: "eteint", appel: "src/services/miniatures.ts", declare: "src/domaine/vignettes.ts", motif: /lireParametre<boolean>\(REGLAGE_TITRE_COUVERTURE, false\)\) !== true/ },
  { cle: "generateur.apprentissage", etat: "eteint", appel: "src/services/apprentissage.ts", declare: "src/domaine/apprentissage.ts", motif: /lireParametre<boolean>\(PARAM_APPRENTISSAGE, false\)\) === true/ },
  { cle: "sujets.garde", etat: "valeur", appel: "src/services/sujets-traites.ts", motif: /lireParametre<unknown>\(REGLAGE_GARDE_SUJETS, "bloquant"\)/ },
  { cle: "republication.proposition_auto", etat: "eteint", appel: "src/services/republication-auto.ts", motif: /lireParametre<boolean>\(PARAM_PROPOSITION_AUTO, false\)\) === true/ },
  { cle: "zernio.envoi_calendrier_autorise", etat: "eteint", appel: "src/services/zernio.ts", motif: /PARAM_ENVOI_CALENDRIER, false\)\) === true/ },
  { cle: "publication.premier_commentaire_coupe", etat: "eteint", appel: "src/fournisseurs/publication/zernio.ts", declare: "src/domaine/interrupteurs/registre.ts", motif: /CLE_PREMIER_COMMENTAIRE_COUPE, false\)/ },
  { cle: "ecriture.memoireTableau", etat: "eteint", appel: "src/services/tableau-scripts/memoire.ts", motif: /PARAM_MEMOIRE_TABLEAU, false\)\) === true/ },
  { cle: "tableau.styleTire", etat: "eteint", appel: "src/services/tableau-creation.ts", motif: /PARAM_STYLE_TIRE_TABLEAU, false\)\.catch\(\(\) => false\)\) === true/ },
  { cle: "planScenes.facecamDessin", etat: "allume", appel: "src/briques/plan-scenes-generateurs/dessin-facecam-porte.ts", motif: /lire\(CLE_REGLAGE_DESSIN_FACECAM, true\)\) !== false/ },
  {
    cle: "adaptations_reseaux.actif",
    etat: "eteint",
    appel: "src/services/interrupteurs-ecriture.ts",
    declare: "src/reseaux/adaptations.ts",
    motif: /lireParametre<unknown>\(cle, false\)\) === true/,
    // Aussi lue au lancement avec une constante pour défaut : elle doit rester `false`.
    aussi: [
      ["src/services/fabrication-reseaux.ts", /lireParametre<unknown>\(CLE_ADAPTATIONS_RESEAUX, ADAPTATIONS_RESEAUX_PAR_DEFAUT\)/],
      ["src/reseaux/adaptations.ts", /export const ADAPTATIONS_RESEAUX_PAR_DEFAUT = false;/],
    ],
  },
  { cle: "casConcret.porteB", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.retouches", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.documentPromis", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.ecranFourni", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "casConcret.releves", etat: "eteint", appel: "src/services/cas-concret-reglages.ts", motif: /lireParametre<unknown>\(id, false\)\) === true/ },
  { cle: "retoucheSegments.liberer", etat: "eteint", appel: "src/components/videos/fiche/LibererPlace.tsx", motif: /lireParametre<unknown>\("retoucheSegments\.liberer", false\)\.catch\(\(\) => false\)\) !== true/, aussi: [["src/components/videos/fiche/actions-liberer.ts", /lireParametre<unknown>\("retoucheSegments\.liberer", false\)\.catch\(\(\) => false\)\) === true/]] },
  { cle: "demoFacecam.reel", etat: "eteint", appel: "src/services/entrees-demo-facecam.ts", motif: /lireParametre<unknown>\(CLE_REGLAGE_DEMO_REEL, false\)\) === true/ },
  { cle: "demoFacecam.envoi", etat: "eteint", appel: "src/app/(studio)/demo-facecam/actions.ts", motif: /lireParametre<unknown>\(CLE_ENVOI_DEMO_FACECAM, false\)\) === true/ },
  { cle: "demoFacecam.planClaude", etat: "allume", appel: "src/services/demo-facecam-claude.ts", motif: /l<unknown>\(PARAM_PLAN_CLAUDE_DEMO, true\);\s*return v === true \|\| v === undefined \|\| v === null/ },
  { cle: "bibliothequeVideo.archive.inscription", etat: "eteint", appel: "src/services/archive-extraits.ts", motif: /lireParametre<unknown>\(REGLAGE_INSCRIPTION, false\)\) !== true/, aussi: [["src/app/(studio)/bibliotheque/source-extraits/page.tsx", /lireParametre<unknown>\(REGLAGE_INSCRIPTION, false\)\) === true/], ["src/services/extraits-de-la-video.ts", /archive = await lire\(REGLAGE_INSCRIPTION, false\);[\s\S]*?if \(archive !== true\) return eteint;/]] },
  { cle: "bibliothequeVideo.archive.effacerFicheASuppression", etat: "eteint", appel: "src/services/suppression-video.ts", motif: /lireParametre<unknown>\(REGLAGE_EFFACER_FICHE_EXTRAITS, false\)\) === true/ },
  { cle: "avocat.bandeauNom", etat: "eteint", appel: "src/services/bandeau-nom.ts", motif: /lireParametre<unknown>\(PARAM_BANDEAU_AVOCAT, false\)\) !== true/ },
  { cle: "optionsPayantes.coupees", etat: "eteint", appel: "src/services/options-payantes.ts", motif: /PARAM_OPTIONS_COUPEES, false\)\) === true/ },
  { cle: "a_traiter.reseaux_manuels", etat: "eteint", appel: "src/services/a-traiter-manuel.ts", motif: /PARAM_RESEAUX_MANUELS, false\)\) === true/ },
  { cle: "a_traiter.rappels_actifs", etat: "eteint", appel: "src/services/a-traiter-suivi.ts", motif: /REGLAGE_RAPPELS_ACTIFS, false\)\);\s*if \(\(await lireReglage\(\)\) !== true\)/ },
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
  { cle: "site.reglages", etat: "allume", appel: "src/services/source-axion.ts", motif: /lireParametre<ReglagesSite>\(PARAM_REGLAGES, \{ actif: true \}\)/ },
  { cle: "matieres.rappelHebdo", etat: "eteint", appel: "src/services/matieres.ts", motif: /lireParametre\(CLE_RAPPEL, \{ actif: false \}\)/ },
  { cle: "retoucheChat.sansGenerateur", etat: "eteint", appel: "src/services/retouche-chat/garde-acces.ts", motif: /lire\(CLE_REGLAGE_SANS_GENERATEUR, false\)\) === true/ },
  {
    cle: "buffer.gele",
    etat: "allume",
    appel: "src/services/buffer-gel.ts",
    motif: /lireParametre<unknown>\(PARAM_GELE, undefined\);\s*if \(v === false\) return false;/,
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
];

/**
 * Gabarits de clés construites (`moteur.${formatId}.…`, src/services/reglages.ts, zone interdite : lecture du texte ;
 * `siteGenerateurs.${formatId}` et `siteAuto.${formatId}`, site-videos.ts ; `illustrations.economique.${videoId}`, choix par
 * vidéo, défaut `null` qui retombe sur le réglage général éteint). `declare` : motif de la fabrique de la clé.
 */
const GABARITS: { gabarit: string; etat: Etat; appel: string; motif: RegExp; declare?: RegExp }[] = [
  { gabarit: "moteur.*.jeLis", etat: "eteint", appel: "src/services/reglages.ts", motif: /lireParametre<boolean>\(`moteur\.\$\{formatId\}\.jeLis`, false\)\) === true/ },
  { gabarit: "moteur.*.montageReel", etat: "eteint", appel: "src/services/reglages.ts", motif: /lireParametre<boolean>\(`moteur\.\$\{formatId\}\.montageReel`, false\)\) === true/ },
  {
    gabarit: "siteGenerateurs.*",
    etat: "eteint",
    appel: "src/services/site-videos.ts",
    motif: /lireParametre<boolean>\(cleSiteGenerateur\(formatId\), false\)\) === true/,
    declare: /cleSiteGenerateur = \(formatId: string\) => `siteGenerateurs\.\$\{formatId\}`/,
  },
  {
    gabarit: "siteAuto.*",
    etat: "eteint",
    appel: "src/services/site-videos.ts",
    motif: /lireParametre<boolean>\(cleSiteAuto\(f\.id\), false\)\) === true/,
    declare: /cleSiteAuto = \(formatId: string\) => `siteAuto\.\$\{formatId\}`/,
  },
  {
    gabarit: "illustrations.economique.*",
    etat: "eteint",
    appel: "src/services/illustrations.ts",
    motif: /lireParametre<boolean \| null>\(cleEconomique\(videoId\), null\);\s*return v \?\? \(await lireParametre<boolean>\("illustrations\.economique", false\)\)/,
    declare: /cleEconomique = \(videoId: Id\) => `illustrations\.economique\.\$\{videoId\}`/,
  },
  {
    // Texte de légende enregistré d'un carrousel (page de détail) : une valeur, pas un interrupteur ; `simulation === true` est un champ de la donnée.
    gabarit: "visuels.legende.*.*",
    etat: "valeur",
    appel: "src/app/(studio)/carrousels/[id]/page.tsx",
    motif: /lireParametre<\{ texte\?: unknown; simulation\?: unknown \} \| null>\(`visuels\.legende\.\$\{id\}\.\$\{r\}`, null\)/,
  },
  {
    // Défaut `undefined` → `interpreterReglageBibliotheque` rend `{ actif: false }` (seul `true` ou `{ capacites }` allume).
    gabarit: "bibliothequeVideo.*",
    etat: "eteint",
    appel: "src/services/bibliotheque-video.ts",
    motif: /lireReglageBibliotheque\(video\.formatId, \(cle\) => lireParametre\(cle, undefined\)\);\s*if \(!reglage\.actif\) return \{\}/,
  },
];

const ENV: { nom: string; fichier: string }[] = [
  { nom: "USINE_TOUT_ARRETER", fichier: "src/app/api/usine/commandes/route.ts" },
  { nom: "STUDIO_PORTE_SECRET", fichier: "src/usine/garde-porte.ts" },
];

/** Planscènes et retouche : lus par import (fichiers purs), valeurs constatées. */
const PLAN_SCENES: Record<string, Etat> = {
  "planScenes.casConcret": "allume",
  "planScenes.facecam": "allume", // CHANGERA : C5-5.02
  "planScenes.facecamAnimee": "eteint",
};
const RETOUCHE: Record<string, Etat> = {
  "retoucheChat.avocat": "eteint",
  "retoucheChat.imageVideo": "eteint",
  "retoucheChat.facecamAnimee": "eteint",
  "retoucheChat.tutorielOutil": "eteint",
  "retoucheChat.videoLongue": "eteint",
};

const lire = (f: string) => readFileSync(f, "utf8");

/**
 * RECENSEMENT (clôture G7-06) : tout appel `lireParametre(` de src/** (grep `lireParametre(<[^()]*>)?\(`, méthode `d.lireParametre(`
 * comprise) est soit EN TABLE (clé, constante, gabarit ou liste ci-dessus), soit EXCLU ci-dessous avec son motif. Le test
 * « recensement » échoue sur tout appel ni en table ni exclu, et sur toute exclusion devenue sans appel.
 * Motifs : `dedoublonnage` (marque « déjà fait / déjà prévenu », pas un interrupteur), `memoire` (données, journaux, lots,
 * verrous, comptes, connexions), `valeur` (réglage non booléen : nombre, plafond, texte, liste, choix), `relais` (définition
 * de la fonction, ou passe-plat `(id, défaut) => lireParametre(id, défaut)` dont les clés sont inventoriées ailleurs).
 */
type Motif = "dedoublonnage" | "memoire" | "valeur" | "relais";

/** Clés (ou gabarits `*`) résolues dans le texte mais HORS table. */
const EXCLUS_CLES: Record<string, Motif> = {
  "budget.engage.*": "dedoublonnage",
  "credits.alertes.*": "dedoublonnage",
  "credits.cleRefusee.*": "dedoublonnage",
  "credits.epuise.*": "dedoublonnage",
  "credits.expiration.*": "dedoublonnage",
  "credits.lancementPret.*": "dedoublonnage",
  "credits.rapprochement.*": "dedoublonnage",
  "credits.test.*": "dedoublonnage",
  "parcours.alertes_refus": "dedoublonnage", // marques « alerte déjà envoyée » des refus de messages privés
  "a_traiter.cartes": "memoire",
  "a_traiter.copies": "memoire",
  "auth.empreinteB64": "memoire",
  "bases.empreinte": "memoire",
  "bibliothequeVideo.archive.dernierPassage": "memoire",
  "bibliothequeVideo.archive.examinees": "memoire",
  "budget.engages": "memoire",
  "buffer.canaux": "memoire",
  "buffer.correspondance": "memoire",
  "cas-concret.ecrans-fournis": "memoire",
  "tutoriel.index-scenes": "memoire",
  "casConcret.casAjoutes": "memoire",
  "casConcret.casRemis": "memoire",
  "casConcret.casRetires": "memoire",
  "casConcret.casTraites": "memoire",
  "casConcret.historiqueTirages": "memoire",
  "casConcret.motsBranches": "memoire",
  "casConcret.scriptsValides": "memoire",
  "casConcret.scriptsValidesHistorique": "memoire",
  "casConcret.validations": "memoire",
  "cibles.miroir": "memoire",
  "claude.sources": "memoire",
  "commentaires.depot": "memoire",
  "corbeille-visuels.dernierPassage": "memoire",
  "corbeille.dernierPassage": "memoire",
  "decors.lots": "memoire",
  "ecriture.memoirePosts": "memoire",
  "ecriture.scriptsCentraux": "memoire",
  "ecriture.tiragesCommuns": "memoire",
  "facecam.habitudes": "memoire",
  "facecam.look": "memoire",
  "fal.demande.*": "memoire",
  "gardien.chiffres.dernier": "memoire",
  "gardien.chiffres.empreintes": "memoire",
  "generateur.chaine-options.*": "memoire",
  "generateur.modeleBloque": "memoire",
  "generateur.serie.derniere": "memoire",
  "googleDrive.connexion": "memoire",
  "googleDrive.etatConnexion": "memoire",
  "googleDrive.imports": "memoire",
  "guides.reconciliation": "memoire",
  "idees.comite.dernierEnvoi": "memoire",
  "idees.comite.lot": "memoire",
  "infographies.fiche.*": "memoire",
  "infographies.index": "memoire",
  "illustrations.compteurVideos": "memoire",
  "imageVideo.cartesValidees": "memoire",
  "imageVideo.lots": "memoire",
  "imageVideo.reserve": "memoire",
  "limite_appels.compte": "memoire",
  "motion.animations-gardees": "memoire",
  "mots.a_traiter": "memoire",
  "mots.gardes": "memoire",
  "mots.oppositions": "memoire",
  "mots.validation.guide-parcours": "memoire",
  "mots.validations": "memoire",
  "mots.validations.par-mot": "memoire",
  "oppositions.sante": "memoire",
  "optionsPayantes.demandes": "memoire",
  "parcours.conversations": "memoire",
  "parcours.conversations.alias": "memoire",
  "parcours.conversations.compteurs": "memoire",
  "parcours.merci.journal": "memoire",
  "parcours.oppositions.page": "memoire",
  "parcours.oppositions.site": "memoire",
  "parcours.validation.adresse_refusee": "memoire",
  "parcours.validation.formulations": "memoire",
  "parcours.validation.merci": "memoire",
  "partages.codesSupprimes": "memoire",
  "site.depart": "memoire",
  "site.dernierBilan": "memoire",
  "site.derniereLecture": "memoire",
  "sonde-publication.marques": "memoire",
  "stock.signatures": "memoire",
  "suivi.miroir_site": "memoire",
  "surveillance.heure-h": "memoire",
  "surveillance.heure-h.derniere": "memoire",
  "tableau.historiqueStyles": "memoire",
  "zernio.alertes_jetons": "memoire",
  "zernio.bascules": "memoire",
  "zernio.budget_info": "memoire",
  "zernio.canaux": "memoire",
  "zernio.comptes": "memoire",
  "zernio.mode_envoi": "memoire",
  "zernio.tests": "memoire",
  "zernio.essai_brouillon": "memoire", // brouillon de l'essai Zernio (creneauId), pas un interrupteur
  "calendrier.proposerSemaine.compteur": "memoire", // compteur { jour, n } des propositions de semaine
  "buffer.mode": "valeur",
  "bibliothequeVideo.archive.cochees": "valeur", // liste d'identifiants de vidéos cochées
  "bibliothequeVideo.archive.sources": "valeur", // choix « pretes » | « cochees » | « publiees », défaut null → politique du code
  "casConcret.cameraPlus": "valeur", // nombre : lireCameraPlus rend undefined si absent ou ≤ 1,035
  "cadence.reglages": "valeur",
  "claude.plafondKitUsd": "valeur",
  "claude.plafondMensuelUsd": "valeur",
  "claude.quotaAppelsParJour": "valeur",
  "facecam.plafondVersionUsd": "valeur",
  "fournisseur.*": "valeur",
  "generateur.chaine": "valeur",
  "generateur.plafondSujetUsd": "valeur",
  "hashtags.parReseau": "valeur",
  "hashtags.placement": "valeur",
  "idees.plafondMoisUsd": "valeur",
  "limite_appels.par_jour": "valeur",
  "moteur.*": "valeur",
  "optionsPayantes.prixCreditHiggsfieldCentimes": "valeur",
  "parcours.conversations.plafonds": "valeur",
  "plafond.quotas-usine": "valeur",
  "tableau.methode": "valeur",
  "zernio.youtube_reglages": "valeur",
};

/**
 * Appels à clé NON résolue dans le texte (variable, fonction-clé, concaténation), par `fichier:expression` (expression du
 * 1er argument, blancs réduits) : la clé de la table qu'ils lisent, ou leur motif d'exclusion.
 */
const PAR_EXPRESSION: Record<string, { couvre: string } | { exclu: Motif }> = {
  "app/(studio)/carrousels/[id]/actions.ts:cle": { exclu: "memoire" },
  "app/(studio)/carrousels/[id]/actions.ts:cleLegende(id, reseau)": { exclu: "memoire" },
  "app/(studio)/carrousels/[id]/actions.ts:cleLegende(id, r as ReseauLegende)": { exclu: "memoire" },
  "app/(studio)/reglages/actions-zernio.ts:PREFIXE_ETATS_ENVOI_CALENDRIER + cle": { exclu: "memoire" },
  "services/tableau-deja-vu-usine.ts:id": { exclu: "relais" }, // passe-plat (id) => lireParametre(id, false) ; clé tableau.deja_vu_usine.actif, seul true allume
  "app/(studio)/infographies/actions.ts:cleFiche(id)": { exclu: "memoire" },
  "app/(studio)/reglages/page.tsx:id": { exclu: "relais" }, // etatProduction : INTERRUPTEURS_PRODUCTION, vérifiés plus bas
  "app/api/retouche-chat/route.ts:id": { couvre: "retoucheChat.sansGenerateur" },
  "app/api/usine/visuels/route.ts:`${PREFIXE_COMMANDE}${cle}`": { exclu: "dedoublonnage" },
  "app/api/usine/visuels/route.ts:`${PREFIXE_COTE}${cle}`": { exclu: "dedoublonnage" },
  "services/_commun.ts:id: string": { exclu: "relais" },
  // VL-07 : registre de dépense et morceaux déjà lus de la vidéo longue (mémoire par vidéo, pas des interrupteurs).
  "services/video-longue-branchements.ts:cleDepense(videoId)": { exclu: "memoire" },
  "services/video-longue-branchements.ts:cle": { exclu: "memoire" },
  "services/apprentissage.ts:cleGagnants(formatId)": { exclu: "memoire" },
  "services/autonomie-usine.ts:cleAccord(cle)": { exclu: "memoire" },
  "services/autonomie-usine.ts:cleEngagement(cle)": { exclu: "memoire" },
  "services/autonomie-usine.ts:cleIndex(mois)": { exclu: "memoire" },
  "services/autonomie-usine.ts:cleIndex(j.mois)": { exclu: "memoire" },
  "services/autonomie-usine.ts:cle": { exclu: "dedoublonnage" },
  "services/avocat-branchements.ts:param": { couvre: "avocat.motionCommune" }, // et avocat.monteur (enveloppe allume())
  "services/boucle-generation.ts:cleEtat(generationId)": { exclu: "memoire" },
  "services/boucle-generation.ts:reglageSupplement(adresse)": { exclu: "valeur" },
  "services/boucle-generation.ts:cleOptions(o.depuisGenerationId)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleOptions(x.id)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleOptions(doublon.id)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleOptions(g.id)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleOptions(liste[0].g.id)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleOptions(origine)": { exclu: "memoire" },
  "services/boucle-generation.ts:clePanne(c.id)": { exclu: "memoire" },
  "services/boucle-generation.ts:clePanne(g.id)": { exclu: "memoire" },
  "services/boucle-generation.ts:clePanne(generationId)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleRetouches(v.code)": { exclu: "memoire" },
  "services/boucle-generation.ts:cleOperation(options.operationId)": { exclu: "dedoublonnage" },
  "services/boucle-generation.ts:cleBrouillonDeVersion(varianteId)": { exclu: "memoire" },
  "services/boucle.ts:cleLectureEnVol(t.id)": { exclu: "memoire" },
  "services/boucle.ts:cleLectureEnVol(lu.travail.id)": { exclu: "memoire" },
  "services/branchement-envoi-calendrier.ts:PREFIXE_ETATS_ENVOI_CALENDRIER + cle": { exclu: "memoire" }, // états de promotion « envoi-calendrier:* »
  "services/bibliotheque-video.ts:cle": { couvre: "bibliothequeVideo.*" }, // cleReglageBibliotheque(formatId)
  "services/budget-mensuel.ts:cleBudgetUsine(mois)": { exclu: "valeur" },
  "services/budget-mensuel.ts:cle": { exclu: "dedoublonnage" },
  "services/calendrier-fiche.ts:cleStockage(cle)": { exclu: "memoire" },
  "services/cas-concret-branchements.ts:cle(c)": { exclu: "memoire" },
  "services/cas-concret-reglages.ts:id": { couvre: "casConcret.porteB" }, // les 7 de REGLAGES_CAS_CONCRET
  "services/cas-concret-retouches.ts:cleParametre(videoId)": { exclu: "memoire" },
  "services/couts.ts:cleEngagement(travailId)": { exclu: "memoire" },
  "services/couts.ts:cleAlerteBudget()": { exclu: "dedoublonnage" },
  "services/credit-claude.ts:paramCycleCredit(id)": { exclu: "valeur" },
  "services/credit-claude.ts:paramReleveCredit(id)": { exclu: "valeur" },
  "services/credits.ts:cle": { exclu: "dedoublonnage" },
  "services/decors.ts:cleLot(id)": { exclu: "memoire" },
  "services/depense-claude-video.ts:p.parametre": { couvre: "facecamAnimee.plafondVideosUsd" },
  "services/dosage-motion-defauts.ts:id": { exclu: "relais" }, // passe-plat vers defautsLus/dosageActif (briques/dosage-motion/reglage.ts : dosageMotion.defauts valeur, dosageMotion.actif `=== true` défaut false)
  "services/dosage-motion.ts:id": { exclu: "relais" }, // idem
  "services/effet-realiste-ia.ts:PARAM_RESULTATS(d.videoId)": { exclu: "memoire" },
  "services/effet-realiste-ia.ts:PARAM_RESULTATS(videoId)": { exclu: "memoire" },
  "services/express.ts:cleDecorHabituel(formatId)": { exclu: "valeur" },
  "services/extraits-de-la-video.ts:id": { exclu: "relais" }, // passe-plat vers lire(REGLAGE_INSCRIPTION…) (couvert, bibliothequeVideo.archive.inscription) et lireNoteInteret
  "services/fabrication-reseaux.ts:cleOperation(options.operationId)": { exclu: "dedoublonnage" },
  "services/fabrication-reseaux.ts:cle": { exclu: "dedoublonnage" },
  "services/fabrication-reseaux.ts:cleDebit(video.formatId)": { exclu: "memoire" },
  "services/fabrication-reseaux.ts:cleDebit(formatId)": { exclu: "memoire" },
  "services/garde-creneau-diffuseur.ts:`${PREFIXE_ETATS_GARDE}${nom}:${cle}`": { exclu: "memoire" }, // état de la garde par créneau (marques « envoi-calendrier:<nom>:<clé> », lecture seule) : pas un interrupteur
  "services/generateur-ecran.ts:cleRetouches(c)": { exclu: "memoire" },
  "services/generateur-ecran.ts:cleScriptRelu(o.operationId)": { exclu: "memoire" },
  "services/generation-claude.ts:paramAttente(generationId)": { exclu: "memoire" },
  "services/generation-claude.ts:paramAttente(g.id)": { exclu: "memoire" },
  "services/generation-claude.ts:paramRepriseDeWill(generationId)": { exclu: "dedoublonnage" },
  "services/generation-claude.ts:reglagePlafond(chaine)": { exclu: "valeur" },
  "services/generation-claude.ts:paramReserveChaine(generationId)": { exclu: "memoire" },
  "services/guides-fabrique.ts:PREFIXE_PARAM_REDACTION + p.id": { exclu: "memoire" },
  "services/guides-fabrique.ts:PREFIXE_PARAM_FABRIQUE + p.id": { exclu: "memoire" },
  "services/guides-fabrique.ts:cle": { exclu: "memoire" },
  "services/guides-redaction.ts:cleParam": { exclu: "memoire" },
  "services/illustrations.ts:cleRang(videoId)": { exclu: "memoire" },
  "services/illustrations.ts:cleEconomique(videoId)": { couvre: "illustrations.economique.*" },
  "services/image-video-lot.ts:cleLot(id)": { exclu: "memoire" },
  "services/image-video-carte.ts:`${PREFIXE_DECISIONS}${videoId}`": { exclu: "memoire" },
  "services/image-video.ts:`${PREFIXE_DECISIONS}${dep.videoId}`": { exclu: "memoire" },
  "services/interrupteurs-ecriture.ts:cle": { couvre: "adaptations_reseaux.actif" }, // les 4 de CLES_INTERRUPTEURS_ECRITURE
  "services/mode-budget.ts:cle": { exclu: "dedoublonnage" },
  "services/modifications.ts:cle(videoId)": { exclu: "memoire" },
  "services/monteur-facecam.ts:CLE_FIL(videoId)": { exclu: "memoire" },
  "services/multicamera.ts:paramMulticamera(format)": { couvre: "facecam.multicamera" },
  "services/notifications.ts:cle": { exclu: "dedoublonnage" },
  "services/oppositions-mots.ts:`${PARAM_CONVERSATIONS_ETAT}.alias`": { exclu: "memoire" },
  "services/oppositions-transmission.ts:`${PARAM_CONVERSATIONS}.alias`": { exclu: "memoire" },
  "services/plafond-fournisseur.ts:cle": { exclu: "dedoublonnage" }, // :74 marque ; :99 et :113 compteur (mémoire)
  "services/publication-editoriale-interrupteurs.ts:cle": { couvre: "publication.premier_commentaire_coupe" }, // INTERRUPTEURS_PUBLICATION
  "services/retouche-chat/generateurs-studio.ts:id": { couvre: "retoucheChat.avocat" }, // les 5 de CLES_REGLAGE_RETOUCHE
  "services/serie-ecriture.ts:cleSerie(cle)": { exclu: "memoire" },
  "services/site-videos.ts:cleSiteGenerateur(formatId)": { couvre: "siteGenerateurs.*" },
  "services/site-videos.ts:cleSiteAuto(f.id)": { couvre: "siteAuto.*" },
  "services/site-videos.ts:cleSiteAuto(video.formatId)": { couvre: "siteAuto.*" },
  "services/source-claude.ts:paramJourRenouvellement(s)": { exclu: "valeur" },
  "services/source-claude.ts:paramEpuise(id)": { exclu: "dedoublonnage" },
  "services/source-claude.ts:paramEpuise(s)": { exclu: "dedoublonnage" },
  "visuels/interrupteur.ts:cleDe(famille)": { couvre: "carrousels.actif" }, // et infographies.actif (CLES_INTERRUPTEURS_VISUELS)
  "visuels/services/carrousels.ts:CLE_SESSION + empreinteSession": { exclu: "memoire" },
  "visuels/services/production.ts:PREFIXE_REGISTRE + empreinte": { exclu: "dedoublonnage" },
};

/** Premier argument d'un appel (texte entre la parenthèse ouvrante et la 1re virgule ou parenthèse fermante de niveau 0). */
function argument(t: string, i: number): [texte: string, fin: number] {
  let niveau = 0;
  let guillemet: string | null = null;
  let j = i;
  for (; j < t.length; j++) {
    const c = t[j];
    if (guillemet) {
      if (c === "\\") j++;
      else if (c === guillemet) guillemet = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") guillemet = c;
    else if ("([{".includes(c)) niveau++;
    else if (")]}".includes(c)) {
      if (niveau === 0) break;
      niveau--;
    } else if (c === "," && niveau === 0) break;
  }
  return [t.slice(i, j).replace(/\s+/g, " ").trim(), j];
}

export type Appel = { ligne: number; expr: string; defaut: string; cles: string[] | null; suite: string };

/**
 * Tous les appels `lireParametre(` d'un texte (multi-lignes compris). `cles` : clé(s) résolue(s) dans le texte (littérale,
 * gabarit `${…}` → `*` à préfixe littéral, constante `const NOM = "…"` du fichier, ou constante en MAJUSCULES de src/**) ;
 * `null` sinon. `suite` : le texte qui suit l'appel jusqu'à la fin de la ligne suivante (enveloppe éventuelle).
 */
export function appelsDansTexte(texte: string, globales: Map<string, Set<string>> = new Map()): Appel[] {
  const locales = constantesDansTexte(texte);
  const sortie: Appel[] = [];
  for (const m of texte.matchAll(/\blireParametre(?:<[^()]*?>)?\(/g)) {
    const [expr, fin] = argument(texte, m.index + m[0].length);
    const defaut = texte[fin] === "," ? argument(texte, fin + 1)[0] : "";
    let cles: string[] | null = null;
    if (/^"[^"]*"$/.test(expr)) cles = [expr.slice(1, -1)];
    else if (/^`[^`$]+\$\{[^`]*`$|^`[^`$]*`$/.test(expr)) cles = [expr.slice(1, -1).replace(/\$\{[^}]*\}/g, "*")];
    else if (locales.has(expr)) cles = [...locales.get(expr)!];
    else if (/^[A-Z][A-Z0-9_]*$/.test(expr) && globales.has(expr)) cles = [...globales.get(expr)!];
    const finLigne = texte.indexOf("\n", texte.indexOf("\n", fin) + 1);
    sortie.push({ ligne: texte.slice(0, m.index).split("\n").length, expr, defaut, cles, suite: texte.slice(fin, finLigne < 0 ? undefined : finLigne) });
  }
  return sortie;
}

/** Constantes `const NOM = "clé"` (tous fichiers de src/**) : NOM → valeurs possibles. */
export function constantesDansTexte(texte: string, dans = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const x of texte.matchAll(/\bconst\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*[^=]+)?\s*=\s*"([^"]+)"/g)) dans.set(x[1], (dans.get(x[1]) ?? new Set()).add(x[2]));
  return dans;
}

/**
 * Extrait { clé → défauts littéraux } des appels `lireParametre("clé", défaut)`, `lireParametre(CONSTANTE, défaut)` ou
 * `` lireParametre(`x.${id}`, défaut) `` (gabarit : chaque `${…}` devient `*`) d'un texte. Un défaut objet est gardé entier.
 */
export function cleDansTexte(texte: string, constantes: Map<string, Set<string>> = new Map()): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const ajoute = (cle: string, d?: string) => m.set(cle, [...(m.get(cle) ?? []), (d ?? "").trim()]);
  const re = /\blireParametre(?:<[^()]*?>)?\(\s*(?:"([^"]+)"|([A-Z][A-Z0-9_]*)|`([^`]+)`)\s*(?:,\s*(\{[^}]*\}|[^,)\n]*(?:\([^)]*\))?))?/g;
  for (const x of texte.matchAll(re)) {
    if (x[1]) ajoute(x[1], x[4]);
    else if (x[3]) ajoute(x[3].replace(/\$\{[^}]*\}/g, "*"), x[4]);
    else for (const cle of constantes.get(x[2]) ?? []) ajoute(cle, x[4]);
  }
  return m;
}

/** Un défaut allume-t-il ? `true`, ou un objet `{ …, actif: true, … }` / `{ …, allume: true, … }`. */
export const defautAllume = (d: string) => d === "true" || (d.startsWith("{") && /\b(?:actif|allume)\s*:\s*true\b/.test(d));

/** Refuse toute clé neuve (hors table) dont un défaut littéral allume (`true` ou `{ actif: true }`). */
export function interrupteursNeufsAllumes(texte: string, connues: Set<string>, constantes?: Map<string, Set<string>>): string[] {
  const refus: string[] = [];
  const cst = constantesDansTexte(texte, new Map([...(constantes ?? new Map())].map(([k, v]) => [k, new Set(v)])));
  for (const [cle, defauts] of cleDansTexte(texte, cst)) {
    if (!connues.has(cle) && defauts.some(defautAllume)) refus.push(`${cle} : interrupteur neuf allumé par défaut : interdit (R-9)`);
  }
  return refus;
}

const fichiersSrc = () => execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean);
const toutesConstantes = () => {
  const c = new Map<string, Set<string>>();
  for (const f of fichiersSrc()) constantesDansTexte(lire(f), c);
  return c;
};

const toutesCles = () =>
  new Set<string>([
    ...Object.keys(LITTERALES),
    ...PAR_CONSTANTE.map((c) => c.cle),
    ...Object.keys(PLAN_SCENES),
    ...Object.keys(RETOUCHE),
    ...GABARITS.map((g) => g.gabarit),
  ]);

/** Indice d'une enveloppe qui JUGE la valeur lue comme un interrupteur (`.allume`, `.actif`, `=== true`, `!== false`). */
const ENVELOPPE_INTERRUPTEUR = /\.(?:allume|actif)\b|=== true|!== false/;

/**
 * Appels d'un fichier ni en table ni exclus (vide = tout est recensé). `vus` reçoit les entrées d'exclusion rencontrées.
 * Une exclusion `memoire` ou `valeur` dont l'enveloppe juge la valeur comme un interrupteur est aussi refusée.
 */
export function nonRecenses(fichier: string, texte: string, connues: Set<string>, globales?: Map<string, Set<string>>, vus = new Set<string>()): string[] {
  const court = fichier.replace(/^src\//, "");
  const refus: string[] = [];
  for (const a of appelsDansTexte(texte, globales)) {
    const ou = `${court}:${a.ligne}`;
    if (a.cles) {
      for (const cle of a.cles) {
        if (connues.has(cle)) continue;
        const motif = EXCLUS_CLES[cle];
        if (!motif) refus.push(`${ou} : clé « ${cle} » ni en table ni exclue`);
        else {
          vus.add(cle);
          if (motif !== "dedoublonnage" && ENVELOPPE_INTERRUPTEUR.test(a.suite)) refus.push(`${ou} : « ${cle} » exclue (${motif}) mais lue comme un interrupteur`);
        }
      }
      continue;
    }
    const k = `${court}:${a.expr}`;
    const e = PAR_EXPRESSION[k];
    if (!e) refus.push(`${ou} : appel à clé non résolue \`${a.expr}\` ni en table ni exclu`);
    else {
      vus.add(k);
      if ("couvre" in e && !connues.has(e.couvre)) refus.push(`${ou} : \`${a.expr}\` renvoie à « ${e.couvre} », absente de la table`);
      if ("exclu" in e && e.exclu !== "dedoublonnage" && e.exclu !== "relais" && ENVELOPPE_INTERRUPTEUR.test(a.suite)) refus.push(`${ou} : \`${a.expr}\` exclu (${e.exclu}) mais lu comme un interrupteur`);
    }
  }
  return refus;
}

describe("Inventaire des interrupteurs (G7-06)", () => {
  it("plan de scènes : valeurs par défaut constatées (import du fichier pur)", () => {
    for (const [g, cle] of Object.entries(CLES_REGLAGE_PLAN_SCENES)) {
      expect(PLAN_SCENES[cle], `${cle} absent de la table`).toBe(ALLUME_PAR_DEFAUT[g as keyof typeof ALLUME_PAR_DEFAUT] ? "allume" : "eteint");
    }
    expect(Object.keys(PLAN_SCENES).sort()).toEqual(Object.values(CLES_REGLAGE_PLAN_SCENES).sort());
  });

  it("retouche du chat : cinq clés, toutes éteintes (AM-24 / C-7)", () => {
    expect(Object.values(CLES_REGLAGE_RETOUCHE).sort()).toEqual(Object.keys(RETOUCHE).sort());
    expect(Object.values(RETOUCHE).every((e) => e === "eteint")).toBe(true);
    const texte = lire("src/services/retouche-chat/generateurs.ts");
    expect(texte).toMatch(/seulement par la valeur `true`/);
  });

  it("clés littérales : chacune de la table est encore lue dans src/**, avec la valeur constatée", () => {
    const fichiers = fichiersSrc();
    const vues = new Map<string, string[]>();
    for (const f of fichiers) for (const [k, d] of cleDansTexte(lire(f))) vues.set(k, [...(vues.get(k) ?? []), ...d]);
    for (const [cle, etat] of Object.entries(LITTERALES)) {
      const defauts = vues.get(cle);
      expect(defauts, `clé disparue (retirer la ligne) : ${cle}`).toBeDefined();
      if (etat === "allume") expect(defauts).toContain("true");
      if (etat === "eteint") expect(defauts!.every((d) => d === "false")).toBe(true);
    }
  });

  it("toute clé littérale neuve dans src/** est éteinte par défaut", () => {
    const connues = toutesCles();
    const cst = toutesConstantes();
    const refus = fichiersSrc().flatMap((f) => interrupteursNeufsAllumes(lire(f), connues, cst).map((r) => `${f} : ${r}`));
    expect(refus).toEqual([]);
  });

  it("clés par constante : texte lu (sans import) et défaut constaté", () => {
    for (const c of PAR_CONSTANTE) {
      expect(lire(c.appel), `${c.cle} : appel avec son défaut introuvable dans ${c.appel}`).toMatch(c.motif);
      const decl = c.declare ?? c.appel;
      expect(lire(decl), `${c.cle} : clé disparue de ${decl}`).toContain(`"${c.cle}"`);
      for (const [f, m] of c.aussi ?? []) expect(lire(f), `${c.cle} : règle du défaut introuvable dans ${f}`).toMatch(m);
    }
  });

  it("listes lues par clé variable : chaque clé de la liste est dans la table (casConcret, écriture, publication)", () => {
    const cles = toutesCles();
    const cst = toutesConstantes();
    const casConcret = lire("src/services/cas-concret-reglages.ts").match(/REGLAGES_CAS_CONCRET = \{([^}]*)\}/)![1];
    const idsCas = [...casConcret.matchAll(/:\s*"([^"]+)"/g)].map((x) => x[1]);
    expect(idsCas).toHaveLength(7);
    for (const k of idsCas) expect(cles.has(k), `REGLAGES_CAS_CONCRET : ${k} absente de la table`).toBe(true);
    const ecriture = lire("src/services/interrupteurs-ecriture.ts").match(/CLES_INTERRUPTEURS_ECRITURE = \[([^\]]*)\]/)![1];
    const idsEcr = [...ecriture.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(idsEcr).toHaveLength(4);
    for (const k of idsEcr) expect(cles.has(k), `CLES_INTERRUPTEURS_ECRITURE : ${k} absente de la table`).toBe(true);
    const registre = lire("src/domaine/interrupteurs/registre.ts");
    const idsPub = [...registre.matchAll(/\bcle:\s*([A-Z][A-Z0-9_]*)/g)].flatMap((x) => [...(cst.get(x[1]) ?? [])]);
    expect(idsPub.sort()).toEqual(["publication.editoriale_active", "publication.premier_commentaire_coupe"]);
    for (const k of idsPub) expect(cles.has(k), `INTERRUPTEURS_PUBLICATION : ${k} absente de la table`).toBe(true);
    expect(lire("src/services/publication-editoriale-interrupteurs.ts")).toMatch(/lireParametre<unknown>\(cle, false\)/);
  });

  it("a_traiter.reseaux_manuels : aussi lue par parcours-mot.ts avec son défaut éteint", () => {
    expect(lire("src/services/parcours-mot.ts")).toMatch(/PARAM_RESEAUX_MANUELS, false\)\) === true/);
  });

  it("site-videos.ts : `siteAuto.*` aussi lu à la mise en ligne automatique avec son défaut éteint", () => {
    expect(lire("src/services/site-videos.ts")).toMatch(/lireParametre<boolean>\(cleSiteAuto\(video\.formatId\), false\)\) !== true/);
  });

  it("interrupteurs d'envoi affichés (INTERRUPTEURS_PRODUCTION, etat-production.ts) : chacun dans la table, même défaut", () => {
    const texte = lire("src/services/etat-production.ts").match(/INTERRUPTEURS_PRODUCTION = \[([\s\S]*?)\] as const/)![1];
    const lignes = [...texte.matchAll(/cle: "([^"]+)"[^}]*parDefaut: (true|false)/g)].map((x) => [x[1], x[2]] as const);
    expect(lignes).toHaveLength(3);
    const etats = new Map(PAR_CONSTANTE.map((c) => [c.cle, c.etat]));
    for (const [cle, d] of lignes) expect(etats.get(cle), `INTERRUPTEURS_PRODUCTION : ${cle}`).toBe(d === "true" ? "allume" : "eteint");
  });

  it("clés par format (gabarits moteur.*, siteGenerateurs.*, siteAuto.*, illustrations.economique.*) : texte lu, défaut constaté", () => {
    for (const g of GABARITS) {
      expect(lire(g.appel), `${g.gabarit} : appel introuvable dans ${g.appel}`).toMatch(g.motif);
      if (g.declare) expect(lire(g.appel), `${g.gabarit} : fabrique de la clé introuvable`).toMatch(g.declare);
    }
  });

  it("variables d'environnement : lues dans le texte", () => {
    for (const e of ENV) expect(lire(e.fichier)).toContain(e.nom);
  });

  it("faux fichier neuf `lireParametre(\"x.actif\", true)` : refusé", () => {
    const faux = `const a = await lireParametre("x.actif", true);`;
    expect(interrupteursNeufsAllumes(faux, toutesCles())).toEqual(["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes(`await lireParametre<boolean>("x.actif", false)`, toutesCles())).toEqual([]);
  });

  it("faux fichier neuf avec clé passée par constante `lireParametre(PARAM_X, true)` : refusé", () => {
    const faux = `const PARAM_X = "x.actif";\nconst a = await lireParametre<boolean>(PARAM_X, true);`;
    expect(interrupteursNeufsAllumes(faux, toutesCles())).toEqual(["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<boolean>(PARAM_X, false)`, toutesCles())).toEqual([]);
    expect(interrupteursNeufsAllumes(`import { PARAM_X } from "./x";\nlireParametre(PARAM_X, true)`, toutesCles(), new Map([["PARAM_X", new Set(["x.actif"])]]))).toEqual([
      "x.actif : interrupteur neuf allumé par défaut : interdit (R-9)",
    ]);
  });

  it("faux fichier neuf à défaut objet allumé `lireParametre(PARAM_X, { actif: true })` ou `{ allume: true }` : refusé", () => {
    const refus = ["x.actif : interrupteur neuf allumé par défaut : interdit (R-9)"];
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<R>(PARAM_X, { actif: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`lireParametre("x.actif", { mode: "a", actif: true, n: 2 })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre(PARAM_X, { actif: false })`, toutesCles())).toEqual([]);
    // Champ `allume` (forme de `double.rendu`, `double.looks`) : même règle.
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre<R>(PARAM_X, { allume: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`lireParametre("x.actif", { fond: "uni", allume: true })`, toutesCles())).toEqual(refus);
    expect(interrupteursNeufsAllumes(`const PARAM_X = "x.actif";\nlireParametre(PARAM_X, { allume: false })`, toutesCles())).toEqual([]);
    // Défaut objet allumé d'une clé constatée allumée (site.reglages) : accepté.
    expect(interrupteursNeufsAllumes(`const PARAM_REGLAGES = "site.reglages";\nlireParametre(PARAM_REGLAGES, { actif: true })`, toutesCles())).toEqual([]);
  });

  it("faux fichier neuf à clé en gabarit `` lireParametre(`x.${id}.actif`, true) `` : refusé", () => {
    expect(interrupteursNeufsAllumes("lireParametre<boolean>(`x.${id}.actif`, true)", toutesCles())).toEqual(["x.*.actif : interrupteur neuf allumé par défaut : interdit (R-9)"]);
    expect(interrupteursNeufsAllumes("lireParametre<boolean>(`siteAuto.${id}`, false)", toutesCles())).toEqual([]);
  });

  it("recensement : chaque appel lireParametre de src/** est en table ou exclu avec son motif (et aucune exclusion morte)", () => {
    const connues = toutesCles();
    const cst = toutesConstantes();
    const vus = new Set<string>();
    let appels = 0;
    const refus: string[] = [];
    for (const f of fichiersSrc()) {
      const t = lire(f);
      appels += appelsDansTexte(t, cst).length;
      refus.push(...nonRecenses(f, t, connues, cst, vus));
    }
    expect(refus).toEqual([]);
    expect(appels, "le recensement doit voir les ≈ 480 appels du grep").toBeGreaterThan(450);
    const mortes = [...Object.keys(EXCLUS_CLES), ...Object.keys(PAR_EXPRESSION)].filter((k) => !vus.has(k));
    expect(mortes, "exclusion sans appel (retirer la ligne)").toEqual([]);
    for (const k of Object.keys(EXCLUS_CLES)) expect(connues.has(k), `${k} : à la fois en table et exclue`).toBe(false);
  });

  it("recensement : un faux fichier neuf dont l'enveloppe lit `.allume` sur un défaut null est refusé tant qu'il n'est ni en table ni exclu", () => {
    const connues = toutesCles();
    const faux = `const CLE_Y = "y.reglage";\nexport async function yAllume() {\n  const v = await lireParametre<{ allume?: boolean } | null>(CLE_Y, null);\n  return v?.allume === true;\n}`;
    expect(nonRecenses("src/services/y.ts", faux, connues)).toEqual(["services/y.ts:3 : clé « y.reglage » ni en table ni exclue"]);
    expect(nonRecenses("src/services/y.ts", "const v = await lireParametre<unknown>(cleY(id), null);", connues)).toEqual(["services/y.ts:1 : appel à clé non résolue `cleY(id)` ni en table ni exclu"]);
    // Exclure en « memoire » une clé dont l'enveloppe juge `.actif` ne suffit pas.
    expect(nonRecenses("src/services/sante.ts", `const v = await lireParametre("bases.empreinte", null);\nif (v?.actif) go();`, connues)).toEqual([
      "services/sante.ts:1 : « bases.empreinte » exclue (memoire) mais lue comme un interrupteur",
    ]);
    // Clé en table : acceptée.
    expect(nonRecenses("src/services/rendu-double.ts", `const CLE = "double.rendu";\nconst v = await lireParametre(CLE, null);\nreturn v?.allume === true;`, connues)).toEqual([]);
  });

  it("clé existante allumée (afficherExemples) : acceptée car constatée dans la table", () => {
    expect(interrupteursNeufsAllumes(`lireParametre("afficherExemples", true)`, toutesCles())).toEqual([]);
  });

  it("les clés littérales de master sont toutes dans la table (30 sur 240a0e6, + retoucheChat.coller, + zernio.synchro_etape_visuels, + mesures.lecture_par_liste, + mesures.tentatives_lecture, + accueil.bilan_semaine, + mesures.relecture_automatique, + tutoriel.finitions, + tutoriel.suiviCloche, + videoLongue.actif, + tutoriel.devisAvantDepense)", () => {
    expect(Object.keys(LITTERALES)).toHaveLength(40);
  });
});
