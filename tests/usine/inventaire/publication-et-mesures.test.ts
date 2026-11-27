import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « publication-et-mesures » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "publication-et-mesures",
  litterales: {
    "accueil.bilan_semaine": "eteint",
    "mesures.lecture_par_liste": "eteint",
    "mesures.relecture_automatique": "eteint",
    "mesures.tentatives_lecture": "valeur",
    notifications: "valeur",
    "publication.heureParReseau": "valeur",
    "publication.ordreParDefaut": "valeur",
    "publication.pageSuivie": "valeur",
    "publication.routage": "valeur",
    "push.abonnements": "valeur",
    "reseaux.parDefaut": "valeur",
    "veille.derniereLecture": "valeur",
    "veille.resumeSemaine": "valeur",
    "zernio.rapatriement_actif": "allume",
    "zernio.synchro_etape_visuels": "eteint",
  },
  constantes: [
    { cle: "aPublier.page", etat: "allume", appel: "src/services/a-publier.ts", motif: /lireParametre<unknown>\(PARAM_PAGE_A_PUBLIER, true\)\) !== false/ },
    { cle: "zernio.envoi_autorise", etat: "allume", appel: "src/services/zernio.ts", motif: /PARAM_ARRET_ZERNIO, true\)\) !== false/ },
    { cle: "publication.editoriale_active", etat: "eteint", appel: "src/services/zernio.ts", motif: /PARAM_EDITORIALE_ACTIVE, false\)\) === true/ },
    { cle: "zernio.youtube_actif", etat: "eteint", appel: "src/services/youtube-zernio.ts", declare: "src/fournisseurs/publication/zernio-youtube.ts", motif: /lireParametre<unknown>\(CLE_YOUTUBE_ACTIF, false\)/ },
    { cle: "zernio.pinterest_actif", etat: "eteint", appel: "src/services/pinterest-zernio.ts", declare: "src/fournisseurs/publication/zernio.ts", motif: /lireParametre<unknown>\(CLE_PINTEREST_ACTIF, false\)/ },
    { cle: "republication.proposition_auto", etat: "eteint", appel: "src/services/republication-auto.ts", motif: /lireParametre<boolean>\(PARAM_PROPOSITION_AUTO, false\)\) === true/ },
    { cle: "zernio.envoi_calendrier_autorise", etat: "eteint", appel: "src/services/zernio.ts", motif: /PARAM_ENVOI_CALENDRIER, false\)\) === true/ },
    { cle: "publication.premier_commentaire_coupe", etat: "eteint", appel: "src/fournisseurs/publication/zernio.ts", declare: "src/domaine/interrupteurs/registre.ts", motif: /CLE_PREMIER_COMMENTAIRE_COUPE, false\)/ },
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
    { cle: "a_traiter.reseaux_manuels", etat: "eteint", appel: "src/services/a-traiter-manuel.ts", motif: /PARAM_RESEAUX_MANUELS, false\)\) === true/ },
    { cle: "a_traiter.rappels_actifs", etat: "eteint", appel: "src/services/a-traiter-suivi.ts", motif: /REGLAGE_RAPPELS_ACTIFS, false\)\);\s*if \(\(await lireReglage\(\)\) !== true\)/ },
    {
      cle: "buffer.gele",
      etat: "allume",
      appel: "src/services/buffer-gel.ts",
      motif: /lireParametre<unknown>\(PARAM_GELE, undefined\);\s*if \(v === false\) return false;/,
    },
  ],
  gabarits: [],
  planScenes: {},
  retouche: {},
  exclusCles: {
    "a_traiter.cartes": "memoire",
    "a_traiter.copies": "memoire",
    "buffer.canaux": "memoire",
    "buffer.correspondance": "memoire",
    "sonde-publication.marques": "memoire",
    "surveillance.heure-h": "memoire",
    "surveillance.heure-h.derniere": "memoire",
    "zernio.alertes_jetons": "memoire",
    "zernio.bascules": "memoire",
    "zernio.budget_info": "memoire",
    "zernio.canaux": "memoire",
    "zernio.comptes": "memoire",
    "zernio.mode_envoi": "memoire",
    "zernio.tests": "memoire",
    "zernio.essai_brouillon": "memoire", // brouillon de l'essai Zernio (creneauId), pas un interrupteur
    "calendrier.proposerSemaine.compteur": "memoire", // compteur { jour, n } des propositions de semaine
    "calendrier.proposerSemaine.derniere": "memoire", // dernière semaine proposée { debut, propositions } (lireDerniereSemaine), pas un interrupteur
    "buffer.mode": "valeur",
    "cadence.reglages": "valeur",
    "hashtags.parReseau": "valeur",
    "hashtags.placement": "valeur",
    "zernio.youtube_reglages": "valeur",
  },
  parExpression: {
    "app/(studio)/reglages/actions-zernio.ts:PREFIXE_ETATS_ENVOI_CALENDRIER + cle": { exclu: "memoire" },
    "app/(studio)/reglages/page.tsx:id": { exclu: "relais" }, // etatProduction : INTERRUPTEURS_PRODUCTION, vérifiés plus bas
    "services/branchement-envoi-calendrier.ts:PREFIXE_ETATS_ENVOI_CALENDRIER + cle": { exclu: "memoire" }, // états de promotion « envoi-calendrier:* »
    "services/calendrier-fiche.ts:cleStockage(cle)": { exclu: "memoire" },
    "services/fabrication-reseaux.ts:cleOperation(options.operationId)": { exclu: "dedoublonnage" },
    "services/fabrication-reseaux.ts:cle": { exclu: "dedoublonnage" },
    "services/fabrication-reseaux.ts:cleDebit(video.formatId)": { exclu: "memoire" },
    "services/fabrication-reseaux.ts:cleDebit(formatId)": { exclu: "memoire" },
    "services/garde-creneau-diffuseur.ts:`${PREFIXE_ETATS_GARDE}${nom}:${cle}`": { exclu: "memoire" }, // état de la garde par créneau (marques « envoi-calendrier:<nom>:<clé> », lecture seule) : pas un interrupteur
    "services/interrupteurs-ecriture.ts:cle": { couvre: "adaptations_reseaux.actif" }, // les 4 de CLES_INTERRUPTEURS_ECRITURE
    "services/notifications.ts:cle": { exclu: "dedoublonnage" },
    "services/publication-editoriale-interrupteurs.ts:cle": { couvre: "publication.premier_commentaire_coupe" }, // INTERRUPTEURS_PUBLICATION
  },
  env: [],
  listes: {
    INTERRUPTEURS_PRODUCTION: 4,
    INTERRUPTEURS_PUBLICATION: ["publication.editoriale_active", "publication.premier_commentaire_coupe"],
  },
  nombre: { litterales: 15, constantes: 12, gabarits: 0, planScenes: 0, retouche: 0, exclusCles: 22, parExpression: 12, env: 0 },
  retirees: [],
};
