/**
 * DONNÉES DE DÉMONSTRATION (PLAN B.7 + AV2). Tout est marqué `estDemo: true`
 * (masquable par Réglages > « Afficher les exemples », jamais supprimé).
 * Les dates sont calculées à partir de « maintenant » pour que tout paraisse frais.
 */
import { formatAvocat } from "@/formats/avocat";
import { briquesEffectives, trouverFormat, reglagesParDefaut } from "@/formats";
import { MENTION_IA_PAR_DEFAUT, plansDepuisScript, sousTitresDepuisPlans, texteScript } from "@/domaine/derivations";
import { scriptsReferenceFiche } from "@/donnees/references-avocat";
import { decorsCatalogue, fichiersDecorsCatalogue } from "@/donnees/decors-catalogue";
import { elementsLutsAxion, fichiersLutsAxion } from "@/donnees/luts-axion";
import { ACCESSOIRE_MICRO, DECOR_NOIR_CHAUD, HABILLAGE_AVOCAT, PROFIL_SON_AVOCAT, STYLE_MONTAGE_AVOCAT, STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type {
  Matiere,
  Preuve,
  ScriptMaitre,
  VarianteReseau,
  BlocScript,
  CommandeFabrication,
  DepenseEnregistree,
  ElementBibliotheque,
  EtapeEditoriale,
  Evenement,
  Fichier,
  Idee,
  IdReseau,
  KitPublication,
  LigneCout,
  Licence,
  Marque,
  Miniature,
  Modele,
  Notification,
  Parametre,
  Partage,
  Personnage,
  Piste,
  Plan,
  Prononciation,
  Publication,
  Ratio,
  RessourceFournisseur,
  Retouche,
  Rush,
  Script,
  Serie,
  Sortie,
  SousTitres,
  StatutVideo,
  Travail,
  VersionVideo,
  Video,
  Visage,
  Voix,
} from "@/domaine/types";
import { noterScriptSync, scriptSimuleSync } from "@/fournisseurs/simulation/script";
import { composerLegende, motsDiesePour, phraseDuree } from "@/domaine/textes-publication";
import { travailSimule } from "@/moteurs/simulation";
import { centimes } from "@/lib/montants";
import { codePartage } from "@/lib/ids";

export interface DonneesDemo {
  marques: Marque[];
  fichiers: Fichier[];
  personnages: Personnage[];
  visages: Visage[];
  voix: Voix[];
  prononciations: Prononciation[];
  elements: ElementBibliotheque[];
  scripts: Script[];
  videos: Video[];
  versions: VersionVideo[];
  plans: Plan[];
  pistes: Piste[];
  retouches: Retouche[];
  miniatures: Miniature[];
  sousTitres: SousTitres[];
  sorties: Sortie[];
  kits: KitPublication[];
  publications: Publication[];
  partages: Partage[];
  modeles: Modele[];
  idees: Idee[];
  series: Serie[];
  rushs: Rush[];
  travaux: Travail[];
  depenses: DepenseEnregistree[];
  ressourcesFournisseurs: RessourceFournisseur[];
  notifications: Notification[];
  parametres: Parametre[];
  evenements: Evenement[];
  /**
   * Générateur de scripts (lot G1a) : collections facultatives de la démonstration, vides aujourd'hui (aucune matière
   * inventée ; un sujet de démonstration porterait un numéro ≥ 9000, B.2.4). Les 8 autres collections partent vides.
   */
  scriptsMaitres?: ScriptMaitre[];
  variantes?: VarianteReseau[];
  preuves?: Preuve[];
  matieres?: Matiere[];
}

const MARQUE = "marque-axion";

export function creerDonneesDemo(maintenantMs: number = Date.now()): DonneesDemo {
  const il = (jours: number, heures = 0) => new Date(maintenantMs - jours * 86400000 - heures * 3600000).toISOString();
  const dans = (jours: number, heures = 0) => new Date(maintenantMs + jours * 86400000 + heures * 3600000).toISOString();
  const maintenant = new Date(maintenantMs).toISOString();
  const horo = (jours: number) => ({ creeLe: il(jours), modifieLe: il(Math.max(0, jours - 1)), estDemo: true as const });

  /* ---------------- Fichiers ---------------- */
  const fichiers: Fichier[] = [];
  const f = (cle: string, mime: string, extra: Partial<Fichier> = {}): string => {
    const id = "f-" + cle.replace(/^\/demo\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
    if (!fichiers.some((x) => x.id === id)) {
      fichiers.push({
        id,
        cleStockage: cle,
        nom: cle.split("/").pop() ?? cle,
        mime,
        taille: mime.startsWith("video") ? 1_100_000 : mime.startsWith("audio") ? 120_000 : 60_000,
        origine: "demo",
        statut: "pret",
        ...horo(60),
        ...extra,
      });
    }
    return id;
  };
  const jpg = (cle: string, l = 720, h = 1280) => f(cle, "image/jpeg", { largeur: l, hauteur: h });
  const mp4 = (cle: string, l = 720, h = 1280, d = 10) => f(cle, "video/mp4", { largeur: l, hauteur: h, dureeSec: d, fps: 30 });
  const mp3 = (cle: string, d = 8) => f(cle, "audio/mpeg", { dureeSec: d });

  const VIDEO = {
    droits: { v: mp4("/demo/avocat-droits.mp4"), j: jpg("/demo/avocat-droits.jpg") },
    licenciement: { v: mp4("/demo/avocat-licenciement.mp4"), j: jpg("/demo/avocat-licenciement.jpg") },
    motion: { v: mp4("/demo/motion-chiffres.mp4"), j: jpg("/demo/motion-chiffres.jpg") },
    podcast: { v: mp4("/demo/podcast-entretien.mp4", 1280, 720, 12), j: jpg("/demo/podcast-entretien.jpg", 1280, 720) },
  };
  const vignette = (n: number) => jpg(`/demo/vignettes/v-${String(n).padStart(2, "0")}.jpg`);
  const vignetteH = (n: number) => jpg(`/demo/vignettes/h-${String(n).padStart(2, "0")}.jpg`, 1280, 720);
  const essaiVoix = mp3("/demo/essai-voix.mp3", 6);

  /* ---------------- Marque ---------------- */
  const marques: Marque[] = [
    {
      id: MARQUE,
      nom: "Axion",
      logoFichierId: f("/demo/marque/logo.png", "image/png", { largeur: 512, hauteur: 512 }),
      couleurs: [
        { nom: "Noir chaud", jeton: "--fond", valeur: "#16120F" },
        { nom: "Orange", jeton: "--orange", valeur: "#C65A2E" },
        { nom: "Orange vif", jeton: "--orange-vif", valeur: "#E07040" },
        { nom: "Crème", jeton: "--texte", valeur: "#F3EDE4" },
      ],
      polices: { titre: "Archivo Black", texte: "Manrope" },
      signature: "Axion-IA",
      ...horo(90),
    },
  ];

  /* ---------------- Personnages ---------------- */
  const personnages: Personnage[] = [
    { id: "p-will", nom: "Williams", nature: "moi", role: "Fondateur", photoFichierId: jpg("/demo/personnages/will.jpg", 512, 512), principal: true, couleurAccent: "orange", ...horo(80) },
    { id: "p-clara", nom: "Clara", nature: "invente", role: "L'animatrice", photoFichierId: jpg("/demo/personnages/clara.jpg", 512, 512), principal: false, couleurAccent: "sauge", ...horo(40) },
    {
      id: "p-sophie",
      nom: "Sophie Lambert",
      nature: "reel",
      role: "Avocate associée",
      photoFichierId: jpg("/demo/personnages/sophie.jpg", 512, 512),
      principal: false,
      couleurAccent: "ambre",
      accord: { case: false },
      ...horo(6),
    },
  ];

  const visages: Visage[] = [
    {
      id: "vis-will-face",
      personnageId: "p-will",
      nom: "Face, chemise noire",
      angle: "face",
      tenue: "Chemise noire",
      tenueId: "chemise-noire",
      fondTournage: "Fond noir",
      posture: "assis",
      origine: "filme",
      statut: "pret",
      qualite: { note: 92, conseils: ["Très bon éclairage.", "Ajoutez 30 s de plus pour les sourires."], levres: 90 },
      fichierIds: [VIDEO.droits.v],
      vignetteFichierId: jpg("/demo/personnages/will.jpg", 512, 512),
      fournisseur: "simulation",
      versionFournisseur: "sim-1",
      ...horo(70),
    },
    {
      id: "vis-will-34",
      personnageId: "p-will",
      nom: "Trois quarts, veste",
      angle: "trois-quarts",
      tenue: "Veste sombre",
      tenueId: "veste-sombre",
      fondTournage: "Fond noir",
      posture: "assis",
      origine: "filme",
      statut: "pret",
      qualite: { note: 88, conseils: ["Regardez la personne à côté de la caméra, pas l'objectif."], levres: 87 },
      fichierIds: [VIDEO.licenciement.v],
      vignetteFichierId: jpg("/demo/personnages/will-34.jpg", 512, 512),
      fournisseur: "simulation",
      versionFournisseur: "sim-1",
      ...horo(70),
    },
    {
      id: "vis-clara-face",
      personnageId: "p-clara",
      nom: "Face, studio",
      angle: "face",
      tenue: "Pull crème",
      tenueId: "pull-creme",
      fondTournage: "Studio podcast",
      posture: "assis",
      origine: "filme",
      statut: "pret",
      qualite: { note: 90, conseils: [] },
      fichierIds: [],
      vignetteFichierId: jpg("/demo/personnages/clara.jpg", 512, 512),
      fournisseur: "simulation",
      versionFournisseur: "sim-1",
      ...horo(35),
    },
    {
      id: "vis-sophie-face",
      personnageId: "p-sophie",
      nom: "Face, cabinet",
      angle: "face",
      tenue: "Tailleur",
      tenueId: "tailleur",
      fondTournage: "Bureau",
      posture: "assis",
      origine: "filme",
      statut: "brouillon",
      fichierIds: [],
      fournisseur: "simulation",
      ...horo(6),
    },
  ];

  const voix: Voix[] = [
    {
      id: "voix-will",
      personnageId: "p-will",
      nom: "Ma voix",
      langue: "fr-FR",
      minutesEnregistrees: 12,
      statut: "pret",
      reglages: { vitesse: 1.05, stabilite: 60, emotion: 45 },
      fichierIds: [essaiVoix],
      fournisseur: "simulation",
      versionFournisseur: "sim-1",
      echantillonFichierId: essaiVoix,
      ...horo(65),
    },
    {
      id: "voix-clara",
      personnageId: "p-clara",
      nom: "Voix de Clara",
      langue: "fr-FR",
      minutesEnregistrees: 0,
      statut: "pret",
      reglages: { vitesse: 1, stabilite: 70, emotion: 55 },
      fichierIds: [],
      fournisseur: "simulation",
      versionFournisseur: "sim-1",
      echantillonFichierId: essaiVoix,
      ...horo(35),
    },
  ];

  const ressourcesFournisseurs: RessourceFournisseur[] = [
    { id: "rf-1", entite: "visage", entiteId: "vis-will-face", fournisseur: "simulation", idExterne: "sim-visage-will-face", versionModele: "sim-1", statut: "pret", ...horo(70) },
    { id: "rf-2", entite: "visage", entiteId: "vis-will-34", fournisseur: "simulation", idExterne: "sim-visage-will-34", versionModele: "sim-1", statut: "pret", ...horo(70) },
    { id: "rf-3", entite: "voix", entiteId: "voix-will", fournisseur: "simulation", idExterne: "sim-voix-will", versionModele: "sim-1", statut: "pret", ...horo(65) },
    { id: "rf-4", entite: "visage", entiteId: "vis-clara-face", fournisseur: "simulation", idExterne: "sim-visage-clara", versionModele: "sim-1", statut: "pret", ...horo(35) },
    { id: "rf-5", entite: "voix", entiteId: "voix-clara", fournisseur: "simulation", idExterne: "sim-voix-clara", versionModele: "sim-1", statut: "pret", ...horo(35) },
  ];

  const prononciations: Prononciation[] = [
    { id: "pr-1", mot: "Axion-IA", prononciation: "axion i-a", ...horo(50) },
    { id: "pr-2", mot: "RGPD", prononciation: "èr-jé-pé-dé", ...horo(50) },
    { id: "pr-3", mot: "Certifexemple", prononciation: "ka-lio-pi", ...horo(40) },
    { id: "pr-4", mot: "PME", prononciation: "pé-èm-eu", ...horo(40) },
    { id: "pr-5", mot: "Williams", prononciation: "wi-liamz", ...horo(30) },
    { id: "pr-6", mot: "ChatGPT", prononciation: "tchatte-jé-pé-té", note: "À la française", ...horo(20) },
  ];

  /* ---------------- Bibliothèque ---------------- */
  const propriete: Licence = { type: "propriete", usageCommercial: true, reseaux: [] };
  const libre = (source: string, credit?: string): Licence => ({ type: "libre", usageCommercial: true, reseaux: [], source, creditObligatoire: credit });
  const el = (e: Omit<ElementBibliotheque, "marqueId" | "creeLe" | "modifieLe" | "estDemo" | "formatsParDefaut" | "motsCles"> & Partial<Pick<ElementBibliotheque, "formatsParDefaut" | "motsCles">>, age = 30): ElementBibliotheque => ({
    marqueId: MARQUE,
    formatsParDefaut: [],
    motsCles: [],
    ...horo(age),
    ...e,
  });

  const lut = (id: string, nom: string, fichier: string, defauts: string[], intensite: number) =>
    el({
      id,
      type: "lut",
      nom,
      motsCles: ["couleurs", "étalonnage"],
      valeur: { type: "lut", formatFichier: "cube", tailleCube: 33, intensiteParDefaut: intensite, avantFichierId: jpg("/demo/lut/avant.jpg", 960, 540), apresFichierId: jpg(fichier, 960, 540) },
      vignetteFichierId: jpg(fichier, 960, 540),
      licence: propriete,
      formatsParDefaut: defauts,
    });

  const illustration = (n: number, nom: string, motsCles: string[], video = false, licence: Licence = libre("Banque Axion")) => {
    const vign = jpg(`/demo/illustrations/illu-${String(n).padStart(2, "0")}.jpg`, 720, 1280);
    return el({
      id: `illu-${String(n).padStart(2, "0")}`,
      type: video ? "illustration-video" : "illustration-image",
      nom,
      motsCles,
      valeur: { type: video ? "illustration-video" : "illustration-image" },
      fichierId: video ? VIDEO.motion.v : vign,
      vignetteFichierId: vign,
      licence,
    });
  };

  const elements: ElementBibliotheque[] = [
    el({ id: "couleurs-axion", type: "couleurs", nom: "Palette Axion", valeur: { type: "couleurs", couleurs: marques[0].couleurs.map((c) => ({ nom: c.nom, valeur: c.valeur })) }, licence: propriete }, 90),
    el({ id: "logo-axion", type: "logo", nom: "Logo Axion", valeur: { type: "logo", variante: "clair" }, fichierId: marques[0].logoFichierId, vignetteFichierId: marques[0].logoFichierId, licence: propriete }, 90),
    el({ id: "logo-axion-mono", type: "logo", nom: "Logo monochrome", valeur: { type: "logo", variante: "monochrome" }, fichierId: marques[0].logoFichierId, vignetteFichierId: marques[0].logoFichierId, licence: propriete }, 90),
    el({ id: "police-titre", type: "police", nom: "Archivo Black", valeur: { type: "police", famille: "Archivo Black", usage: "titre" }, licence: libre("Google Fonts") }, 90),
    el({ id: "police-texte", type: "police", nom: "Manrope", valeur: { type: "police", famille: "Manrope", usage: "texte" }, licence: libre("Google Fonts") }, 90),
    lut("lut-axion-chaud", "Axion chaud", "/demo/lut/axion-chaud.jpg", ["createur-b", "motion"], 70),
    // Les 4 LUT « Axion Buffer » de 65 points (lot M4) : Clair-obscur (avocat), Naturel (selfie), Doux, Nuit.
    ...elementsLutsAxion(horo(60).creeLe),
    lut("lut-neutre", "Neutre", "/demo/lut/neutre.jpg", ["ecran-partage", "ugc", "selfie"], 50),
    lut("lut-cinema", "Cinéma contrasté", "/demo/lut/cinema.jpg", ["podcast"], 60),
    el({ id: "st-axion-pop", type: "style-sous-titres", nom: "Axion pop", motsCles: ["animé", "orange"], valeur: { type: "style-sous-titres", police: "Archivo Black", tailleRelative: 1, motsParLigne: 3, casse: "majuscules", animation: "pop", couleurAccent: "orange", position: "centre" }, licence: propriete, formatsParDefaut: ["ecran-partage", "motion"] }),
    el({ id: "st-avocat-v1", type: "style-sous-titres", nom: "Avocat", motsCles: ["avocat", "contour", "orange"], valeur: STYLE_SOUS_TITRES_AVOCAT, licence: propriete, formatsParDefaut: ["avocat"] }),
    el({ id: "st-sobre", type: "style-sous-titres", nom: "Sobre", motsCles: ["discret"], valeur: { type: "style-sous-titres", police: "Manrope", tailleRelative: 0.8, motsParLigne: 6, casse: "normale", animation: "aucune", couleurAccent: "creme", position: "bas" }, licence: propriete, formatsParDefaut: ["podcast"] }),
    el({ id: "st-karaoke", type: "style-sous-titres", nom: "Karaoké", motsCles: ["mot par mot"], valeur: { type: "style-sous-titres", police: "Manrope", tailleRelative: 0.95, motsParLigne: 4, casse: "normale", animation: "surlignage", couleurAccent: "orange", position: "bas" }, licence: propriete, formatsParDefaut: ["ugc", "selfie"] }),
    illustration(1, "Tribunal vide", ["justice", "tribunal", "droit", "loi"]),
    illustration(2, "Contrat sur une table", ["contrat", "signature", "document", "règles"]),
    illustration(3, "Bureau le soir", ["bureau", "soir", "travail", "vide"]),
    illustration(4, "Poignée de main", ["accord", "poignée", "main", "client"]),
    illustration(5, "Écran d'ordinateur", ["écran", "ordinateur", "mail", "données"]),
    illustration(6, "Téléphone et SMS", ["téléphone", "sms", "message"]),
    illustration(7, "Calculatrice et factures", ["comptable", "facture", "chiffres"], false, { type: "a-verifier", usageCommercial: false, reseaux: [], source: "Trouvée sur Internet" }),
    illustration(8, "Salle de réunion", ["réunion", "équipe", "entreprise"]),
    illustration(9, "Ville la nuit", ["ville", "nuit", "ambiance"], true),
    illustration(10, "Clavier en gros plan", ["clavier", "écran", "ordinateur", "ia"], true, libre("Pexels", "Pexels / Cottonbro")),
    illustration(11, "Graphique qui monte", ["chiffres", "croissance", "résultat"], true),
    illustration(12, "Café et carnet", ["idée", "matin", "carnet"], true, { type: "abonnement", usageCommercial: true, reseaux: [], source: "Artlist", expireLe: il(10) }),
    el({ id: "mus-tension", type: "musique", nom: "Tension douce", motsCles: ["tension-douce", "sérieux"], valeur: { type: "musique", ambiance: "tension-douce", tempoBpm: 96, dureeSec: 8 }, fichierId: mp3("/demo/musiques/m-1.mp3"), licence: libre("Bibliothèque libre"), formatsParDefaut: [] }),
    el({ id: "mus-elan", type: "musique", nom: "Élan", motsCles: ["énergique", "positif"], valeur: { type: "musique", ambiance: "energique", tempoBpm: 120, dureeSec: 8 }, fichierId: mp3("/demo/musiques/m-2.mp3"), licence: libre("Bibliothèque libre") }),
    el({ id: "mus-nappe", type: "musique", nom: "Nappe calme", motsCles: ["calme", "podcast"], valeur: { type: "musique", ambiance: "calme", tempoBpm: 70, dureeSec: 8 }, fichierId: mp3("/demo/musiques/m-3.mp3"), licence: libre("Bibliothèque libre"), formatsParDefaut: ["podcast"] }),
    el({ id: "mus-pulse", type: "musique", nom: "Pulsation", motsCles: ["rythmé", "motion"], valeur: { type: "musique", ambiance: "rythme", tempoBpm: 128, dureeSec: 8 }, fichierId: mp3("/demo/musiques/m-4.mp3"), licence: { type: "abonnement", usageCommercial: true, reseaux: ["instagram", "tiktok"], source: "Epidemic Sound", creditObligatoire: "Musique : Epidemic Sound" } }),
    ...[
      ["Souffle", "transition"],
      ["Impact sourd", "impact"],
      ["Pop", "notification"],
      ["Clic", "transition"],
      ["Ding", "notification"],
      ["Ambiance bureau", "ambiance"],
    ].map(([nom, categorie], i) =>
      el({
        id: `bru-${i + 1}`,
        type: "bruitage",
        nom,
        motsCles: [categorie],
        valeur: { type: "bruitage", categorie: categorie as "transition" | "impact" | "notification" | "ambiance", dureeSec: categorie === "ambiance" ? 8 : 1 },
        fichierId: mp3(`/demo/bruitages/b-${i + 1}.mp3`, 1),
        licence: libre("Bibliothèque libre"),
      }),
    ),
    el({ id: "hab-axion", type: "habillage", nom: "Axion complet", motsCles: ["logo", "carte finale"], valeur: { type: "habillage", intro: false, fin: true, logoAnime: true, carteFinale: { titre: "Axion-IA", appel: "Abonnez-vous" }, grandTitre: true }, vignetteFichierId: jpg("/demo/habillage/axion.jpg"), licence: propriete, formatsParDefaut: ["ecran-partage"] }),
    el({ id: "hab-avocat-v1", type: "habillage", nom: "Avocat : encadré d'ouverture", motsCles: ["avocat", "encadré"], valeur: HABILLAGE_AVOCAT, licence: propriete, formatsParDefaut: ["avocat"] }),
    el({ id: "hab-sobre", type: "habillage", nom: "Sobre", motsCles: ["discret"], valeur: { type: "habillage", intro: true, fin: true, logoAnime: false, grandTitre: false }, vignetteFichierId: jpg("/demo/habillage/sobre.jpg"), licence: propriete, formatsParDefaut: ["podcast"] }),
    el({ id: "sm-calme", type: "style-montage", nom: "Calme", valeur: { type: "style-montage", rythme: "calme", dureePlanMoyenneSec: 5, zooms: "aucun", transitions: "fondu", bruitagesTransitions: false }, licence: propriete, formatsParDefaut: ["podcast"] }),
    el({ id: "sm-rythme", type: "style-montage", nom: "Rythmé", valeur: { type: "style-montage", rythme: "rythme", dureePlanMoyenneSec: 3, zooms: "doux", transitions: "coupe", bruitagesTransitions: true }, licence: propriete, formatsParDefaut: ["ecran-partage", "ugc", "selfie", "createur-b"] }),
    el({ id: "sm-tres-rythme", type: "style-montage", nom: "Très rythmé", valeur: { type: "style-montage", rythme: "tres-rythme", dureePlanMoyenneSec: 1.8, zooms: "frequents", transitions: "coupe", bruitagesTransitions: true }, licence: propriete, formatsParDefaut: ["motion"] }),
    el({ id: "sm-avocat-v1", type: "style-montage", nom: "Avocat", motsCles: ["avocat", "coupes franches"], valeur: STYLE_MONTAGE_AVOCAT, licence: propriete, formatsParDefaut: ["avocat"] }),
    el({ id: "ps-voix-claire", type: "profil-son", nom: "Voix claire", valeur: { type: "profil-son", volumeMusique: 18, baisseSousVoixDb: 12, traitementVoix: "naturel", densiteBruitages: "leger", niveauCibleLufs: -14 }, licence: propriete, formatsParDefaut: ["ecran-partage", "ugc", "selfie"] }),
    el({ id: "ps-avocat-v1", type: "profil-son", nom: "Avocat : voix sèche", motsCles: ["avocat", "voix"], valeur: PROFIL_SON_AVOCAT, licence: propriete, formatsParDefaut: ["avocat"] }),
    el({ id: "ps-rythme", type: "profil-son", nom: "Rythmé avec bruitages", valeur: { type: "profil-son", volumeMusique: 30, baisseSousVoixDb: 9, traitementVoix: "radio", densiteBruitages: "rythme", niveauCibleLufs: -13 }, licence: propriete, formatsParDefaut: ["motion"] }),
    el({ id: "ps-podcast", type: "profil-son", nom: "Podcast", valeur: { type: "profil-son", volumeMusique: 8, baisseSousVoixDb: 18, traitementVoix: "chaud", densiteBruitages: "aucun", niveauCibleLufs: -16 }, licence: propriete, formatsParDefaut: ["podcast"] }),
    // Décors (les anciens « fonds » sont des décors en mode teinte, B.0 §6).
    el({ id: "decor-bureau", type: "decor", nom: "Bureau sombre", motsCles: ["bureau"], valeur: { type: "decor", mode: "image", imageFichierId: jpg("/demo/illustrations/illu-03.jpg"), ambiance: "sombre", profondeurFlou: 14, directionLumiere: "gauche", positionSujet: 0.5 }, vignetteFichierId: jpg("/demo/illustrations/illu-03.jpg"), licence: propriete }),
    el({ id: "decor-studio", type: "decor", nom: "Studio chaleureux", motsCles: ["podcast"], valeur: { type: "decor", mode: "image", imageFichierId: vignetteH(1), ambiance: "chaleureux", profondeurFlou: 12, directionLumiere: "face", positionSujet: 0.5 }, vignetteFichierId: vignetteH(1), licence: propriete }),
    el({ id: "fond-noir-chaud", type: "decor", nom: "Noir chaud", motsCles: ["noir", "orange", "avocat"], valeur: DECOR_NOIR_CHAUD, licence: propriete, formatsParDefaut: ["avocat"] }),
    el({ id: "acc-micro-podcast", type: "accessoire", nom: "Micro de podcast", motsCles: ["micro", "podcast"], valeur: ACCESSOIRE_MICRO, licence: propriete, formatsParDefaut: ["avocat"] }),
    // Ton de pièce sous la voix (B.7) : les 30 s de silence du tournage de Will le remplaceront.
    el({ id: "ton-piece-will", type: "bruitage", nom: "Ton de pièce", motsCles: ["silence", "pièce", "ambiance"], valeur: { type: "bruitage", categorie: "ambiance", dureeSec: 30 }, fichierId: mp3("/demo/bruitages/b-6.mp3", 8), licence: propriete }),
    // Catalogue des décors (lot M3, décision de Will) : même source que la migration au démarrage (étape 9).
    ...decorsCatalogue(horo(60).creeLe),
  ];
  fichiers.push(...fichiersDecorsCatalogue(horo(60).creeLe).filter((f) => !fichiers.some((x) => x.id === f.id)));
  fichiers.push(...fichiersLutsAxion(horo(60).creeLe).filter((f) => !fichiers.some((x) => x.id === f.id)));

  /* ---------------- Scripts ---------------- */
  const segs = (prefixe: string, phrases: [string, Partial<BlocScript["segments"][number]>?][]) =>
    phrases.map(([texte, extra], i) => ({ id: `${prefixe}-s${i + 1}`, texte, ...(extra ?? {}) }));

  // Scripts de référence dans la recette avocat v2 : accroche, promesse, cœur, preuve, appel, boucle (B.9 bis).
  const blocsRef1: BlocScript[] = [
    { id: "r1-b1", blocRecette: "accroche", segments: segs("r1-b1", [["Vous collez vos fichiers clients dans ChatGPT ? Regardez ce que vous envoyez.", { angle: "trois-quarts", titreEcran: "ChatGPT : CE QU'IL NE FAUT PAS LUI DONNER", emphase: ["fichiers"] }]]) },
    { id: "r1-b2", blocRecette: "promesse", segments: segs("r1-b2", [["Je vous explique quoi garder pour vous, en trente secondes.", { angle: "trois-quarts", pauseApresSec: 0.4 }]]) },
    {
      id: "r1-b3",
      blocRecette: "coeur",
      segments: segs("r1-b3", [
        ["Un texte d'exemple, oui. Les noms de vos clients, non.", { angle: "trois-quarts", zoom: "leger", emphase: ["non"] }],
        ["Selon le réglage, ce que vous envoyez peut servir à améliorer l'outil.", { angle: "trois-quarts", intentionIllustration: "un écran d'ordinateur" }],
        ["Sauf si ce réglage est coupé, ou avec une offre pour les entreprises.", { angle: "face", emphase: ["réglage"] }],
      ]),
    },
    { id: "r1-b4", blocRecette: "preuve", segments: segs("r1-b4", [["Et c'est vous qui répondez des données de vos clients.", { angle: "trois-quarts", intentionIllustration: "un dossier fermé" }]]) },
    { id: "r1-b5", blocRecette: "appel", segments: segs("r1-b5", [["Retenez un geste : retirer les noms avant de coller.", { angle: "trois-quarts", emphase: ["noms"] }]]) },
    { id: "r1-b6", blocRecette: "boucle", segments: segs("r1-b6", [["Et c'est le geste qu'on oublie le plus vite.", { angle: "trois-quarts" }]]) },
  ];
  const blocsRef2: BlocScript[] = [
    { id: "r2-b1", blocRecette: "accroche", segments: segs("r2-b1", [["Relancer un devis par SMS. Oui, ça se fait.", { angle: "trois-quarts", titreEcran: "Relance de devis : PAR SMS, BONNE IDÉE ?", emphase: ["SMS"] }]]) },
    { id: "r2-b2", blocRecette: "promesse", segments: segs("r2-b2", [["Voici ce qu'il faut savoir avant d'envoyer.", { angle: "trois-quarts", pauseApresSec: 0.4 }]]) },
    {
      id: "r2-b3",
      blocRecette: "coeur",
      segments: segs("r2-b3", [
        ["Oui, si le client vous a donné son numéro pour ce devis.", { angle: "trois-quarts", emphase: ["numéro"] }],
        ["Commencez par un e-mail, plus facile à retrouver.", { angle: "trois-quarts", intentionIllustration: "une boîte de réception" }],
        ["Puis un SMS court, deux jours après au minimum.", { angle: "face" }],
      ]),
    },
    { id: "r2-b4", blocRecette: "preuve", segments: segs("r2-b4", [["Un SMS sans votre nom ni le numéro du devis passe pour une publicité.", { angle: "trois-quarts", emphase: ["publicité"] }]]) },
    { id: "r2-b5", blocRecette: "appel", segments: segs("r2-b5", [["Mettez le numéro du devis dans le message. C'est un repère.", { angle: "trois-quarts", emphase: ["repère"] }]]) },
    { id: "r2-b6", blocRecette: "boucle", segments: segs("r2-b6", [["Parce qu'un devis sans relance, ça arrive vraiment.", { angle: "trois-quarts" }]]) },
  ];
  const formatPodcast = trouverFormat("podcast")!;
  const refPodcast = scriptSimuleSync(formatPodcast.recetteScript, "L'IA va-t-elle remplacer les avocats ?", 0, 600);

  const script = (id: string, formatId: string, sujet: string, blocs: BlocScript[], extra: Partial<Script> = {}, age = 10): Script => {
    const format = trouverFormat(formatId)!;
    // La note porte sur CE texte (et non sur un texte généré à côté) : la durée notée colle au chrono affiché.
    const calculee = noterScriptSync(blocs, format.recetteScript, extra.dureeCibleSec ?? 45);
    const note = extra.notes ? { ...extra.notes, criteres: { ...extra.notes.criteres, duree: calculee.criteres.duree ?? extra.notes.criteres.duree } } : calculee;
    return {
      id,
      formatId,
      versionFormat: format.version,
      sujet,
      version: 1,
      blocs,
      favori: false,
      reference: false,
      statutEditorial: "valide",
      marqueId: MARQUE,
      dureeCibleSec: 45,
      ton: "Direct",
      cible: "Dirigeants de PME",
      ...horo(age),
      ...extra,
      notes: note,
    };
  };
  const gen = (sujet: string, variante: number, duree = 45) => scriptSimuleSync(formatAvocat.recetteScript, sujet, variante, duree).blocs;

  const scripts: Script[] = [
    script("script-ref-avocat-1", "avocat", "ChatGPT peut-il lire vos fichiers clients ?", blocsRef1, { reference: true, favori: true, notes: { globale: 94, criteres: { accroche: 96, clarte: 95, rythme: 92, duree: 94, appel: 88 }, commentaire: "Le modèle du genre." } }, 60),
    script("script-ref-avocat-2", "avocat", "Relancer un devis par SMS : bonne idée ?", blocsRef2, { reference: true, notes: { globale: 91, criteres: { accroche: 95, clarte: 92, rythme: 90, duree: 88, appel: 85 } } }, 55),
    script("script-ref-podcast-1", "podcast", "L'IA va-t-elle remplacer les avocats ?", refPodcast.blocs, { reference: true, dureeCibleSec: 600 }, 50),
    script("script-1", "avocat", "ChatGPT peut-il lire vos fichiers clients ?", blocsRef1, { favori: true, parentId: "script-ref-avocat-1" }, 30),
    script("script-2", "avocat", "L'IA peut-elle remplacer mon comptable ?", gen("L'IA peut-elle remplacer mon comptable ?", 0), {}, 8),
    script("script-3", "avocat", "Télétravail : quels outils pour l'équipe ?", gen("Télétravail : quels outils pour l'équipe ?", 1), {}, 6),
    script("script-4", "avocat", "Mes données dans ChatGPT : quel risque ?", gen("Mes données dans ChatGPT : quel risque ?", 2), {}, 1),
    script("script-5", "avocat", "Automatiser ses devis en 3 étapes", gen("Automatiser ses devis en 3 étapes", 0, 60), { statutEditorial: "brouillon", dureeCibleSec: 60, version: 2 }, 0),
    script("script-6", "avocat", "Un outil IA gratuit : un piège ?", gen("Un outil IA gratuit : un piège ?", 1), {}, 2),
    script("script-7", "avocat", "RGPD : 5 erreurs de PME", gen("RGPD : 5 erreurs de PME", 2, 60), { dureeCibleSec: 60 }, 62),
    script("script-8", "avocat", "Relancer un devis par SMS : bonne idée ?", blocsRef2, { parentId: "script-ref-avocat-2" }, 20),
    // Accroches de la fiche de style, rangées comme scripts de référence (B.9 bis, lot M1).
    ...scriptsReferenceFiche(horo(70).creeLe),
  ];

  /* ---------------- Vidéos ---------------- */
  const videos: Video[] = [];
  const versions: VersionVideo[] = [];
  const plans: Plan[] = [];
  const sorties: Sortie[] = [];
  const sousTitres: SousTitres[] = [];
  const miniatures: Miniature[] = [];
  const kits: KitPublication[] = [];
  const pistes: Piste[] = [];
  const travaux: Travail[] = [];
  const depenses: DepenseEnregistree[] = [];

  const distribWill = [{ role: "Face caméra", personnageId: "p-will", source: "double" as const, visageId: "vis-will-face", voixId: "voix-will" }];

  function commandePour(v: Video, blocs: BlocScript[], vPlans: Plan[]): CommandeFabrication {
    return {
      versionContrat: 1,
      videoId: v.id,
      formatId: v.formatId,
      versionFormat: v.versionFormat,
      profilRenduVersion: v.profilRenduVersion,
      dureeCibleSec: v.dureeCibleSec,
      ratios: v.ratios,
      script: { id: v.scriptId, blocs, texteComplet: texteScript(blocs) },
      distribution: v.distribution.map((d) => ({ ...d, nomPersonnage: personnages.find((p) => p.id === d.personnageId)?.nom })),
      styles: {},
      briques: briquesEffectives(trouverFormat(v.formatId)!, v.briquesCoupees),
      entrees: v.entrees,
      reglages: v.reglages,
      plans: vPlans.map((p) => ({ id: p.id, ordre: p.ordre, debutSec: p.debutSec, finSec: p.finSec, texte: p.texte, sourceImage: p.sourceImage, illustration: p.illustration, texteEcran: p.texteEcran, angle: p.angle })),
      prononciations: prononciations.map((p) => ({ mot: p.mot, prononciation: p.prononciation })),
      mentionIA: v.mentionIA,
      budgetMax: centimes(15000),
      construiteLe: v.creeLe,
    };
  }

  function lignesCout(duree: number, ratios: number, reel: boolean): LigneCout[] {
    const l = (etape: string, unite: LigneCout["unite"], q: number, pu: number): LigneCout => ({
      etape,
      fournisseur: "simulation",
      unite,
      quantite: q,
      prixUnitaire: centimes(pu),
      total: centimes(q * pu),
      nature: reel ? "reel" : "estime",
    });
    return [l("Voix", "caractere", duree * 16, 0.02), l("Double", "seconde", duree, 3), l("Illustrations", "image", Math.ceil(duree / 12), 5), l("Mixage", "seconde", duree, 0.3), l("Export", "seconde", duree * ratios, 0.5)];
  }

  interface Def {
    id: string;
    titre: string;
    formatId: string;
    statut: StatutVideo;
    etape?: EtapeEditoriale;
    duree: number;
    ratios: Ratio[];
    scriptId?: string;
    blocs?: BlocScript[];
    demo: keyof typeof VIDEO;
    vignettes?: string[];
    age: number;
    serieId?: string;
    distribution?: Video["distribution"];
    etapeAssistant?: string;
    deuxVersions?: boolean;
    note?: number;
  }

  const defs: Def[] = [
    { id: "v-01", titre: "ChatGPT peut-il lire vos fichiers clients ?", formatId: "avocat", statut: "prete", etape: "publiee", duree: 45, ratios: ["9:16", "1:1"], scriptId: "script-1", blocs: blocsRef1, demo: "droits", age: 12, serieId: "serie-droit", deuxVersions: true, note: 91 },
    { id: "v-02", titre: "Relancer un devis par SMS : bonne idée ?", formatId: "avocat", statut: "prete", etape: "programmee", duree: 45, ratios: ["9:16", "1:1", "16:9"], scriptId: "script-8", blocs: blocsRef2, demo: "licenciement", age: 5, serieId: "serie-droit", note: 89 },
    { id: "v-03", titre: "L'IA peut-elle remplacer mon comptable ?", formatId: "avocat", statut: "prete", etape: "a_relire", duree: 45, ratios: ["9:16"], scriptId: "script-2", demo: "droits", vignettes: [vignette(1)], age: 0.2, note: 84 },
    { id: "v-04", titre: "Télétravail : quels outils pour l'équipe ?", formatId: "avocat", statut: "prete", etape: "validee", duree: 45, ratios: ["9:16", "1:1"], scriptId: "script-3", demo: "licenciement", vignettes: [vignette(2)], age: 2, serieId: "serie-droit", note: 87 },
    { id: "v-05", titre: "Mes données dans ChatGPT : quel risque ?", formatId: "avocat", statut: "en_fabrication", duree: 45, ratios: ["9:16", "1:1"], scriptId: "script-4", demo: "droits", vignettes: [vignette(3)], age: 0 },
    { id: "v-06", titre: "Un outil IA gratuit : un piège ?", formatId: "avocat", statut: "echec", duree: 45, ratios: ["9:16"], scriptId: "script-6", demo: "licenciement", vignettes: [vignette(4)], age: 0.05 },
    { id: "v-07", titre: "Automatiser ses devis en 3 étapes", formatId: "avocat", statut: "brouillon", duree: 60, ratios: ["9:16"], scriptId: "script-5", demo: "droits", vignettes: [vignette(5)], age: 0.1, etapeAssistant: "script" },
    { id: "v-08", titre: "Factures ressaisies à la main : que faire ?", formatId: "avocat", statut: "brouillon", duree: 45, ratios: ["9:16", "4:5"], demo: "licenciement", vignettes: [vignette(6)], age: 1, etapeAssistant: "reglages" },
    { id: "v-09", titre: "RGPD : 5 erreurs de PME", formatId: "avocat", statut: "prete", etape: "publiee", duree: 60, ratios: ["9:16", "1:1"], scriptId: "script-7", demo: "droits", vignettes: [vignette(7)], age: 64, note: 88 },
    { id: "v-10", titre: "Plannings et congés : automatiser sans erreur", formatId: "avocat", statut: "archivee", etape: "publiee", duree: 45, ratios: ["9:16"], demo: "licenciement", vignettes: [vignette(8)], age: 80, note: 82 },
    { id: "v-11", titre: "L'IA va-t-elle remplacer les avocats ?", formatId: "podcast", statut: "prete", etape: "validee", duree: 600, ratios: ["16:9", "9:16"], scriptId: "script-ref-podcast-1", blocs: refPodcast.blocs, demo: "podcast", age: 20, note: 86, distribution: [
      { role: "Hôte", personnageId: "p-clara", source: "double", visageId: "vis-clara-face", voixId: "voix-clara" },
      { role: "Invité", personnageId: "p-will", source: "double", visageId: "vis-will-34", voixId: "voix-will" },
    ] },
    { id: "v-12", titre: "Dirigeant de PME : l'IA au quotidien", formatId: "podcast", statut: "prete", etape: "a_relire", duree: 300, ratios: ["16:9"], demo: "podcast", vignettes: [vignetteH(2)], age: 9, note: 85, distribution: [
      { role: "Hôte", personnageId: "p-clara", source: "double", visageId: "vis-clara-face", voixId: "voix-clara" },
      { role: "Invité", personnageId: "p-will", source: "double", visageId: "vis-will-face", voixId: "voix-will" },
    ] },
    { id: "v-13", titre: "3 chiffres sur l'IA en PME", formatId: "motion", statut: "prete", etape: "publiee", duree: 30, ratios: ["9:16", "16:9"], demo: "motion", age: 33, note: 93, distribution: [] },
    { id: "v-14", titre: "Créer un devis en 2 minutes", formatId: "ecran-partage", statut: "prete", etape: "validee", duree: 60, ratios: ["9:16"], demo: "droits", vignettes: [vignette(9)], age: 15, note: 87 },
    { id: "v-15", titre: "Ce que j'ai appris cette semaine", formatId: "selfie", statut: "prete", etape: "a_relire", duree: 30, ratios: ["9:16"], demo: "licenciement", vignettes: [vignette(10)], age: 4, note: 83 },
  ];

  for (const d of defs) {
    const format = trouverFormat(d.formatId)!;
    const blocs = d.blocs ?? scriptSimuleSync(format.recetteScript, d.titre, d.id.charCodeAt(3) % 3, d.duree).blocs;
    const creeLe = il(d.age + 0.1);
    const v: Video = {
      id: d.id,
      titre: d.titre,
      sujet: d.titre,
      formatId: d.formatId,
      versionFormat: format.version,
      profilRenduVersion: 1,
      marqueId: MARQUE,
      statut: d.statut,
      etapeEditoriale: d.etape,
      dureeCibleSec: d.duree,
      ratios: d.ratios,
      scriptId: d.scriptId,
      distribution: d.distribution ?? distribWill,
      entrees: {},
      reglages: reglagesParDefaut(format),
      styles: {},
      mentionIA: MENTION_IA_PAR_DEFAUT,
      coutEstime: centimes(lignesCout(d.duree, d.ratios.length, false).reduce((t, l) => t + l.total.centimes, 0)),
      serieId: d.serieId,
      langue: "fr-FR",
      etapeAssistant: d.etapeAssistant,
      creeLe,
      modifieLe: il(d.age),
      estDemo: true,
    };
    const fabriquee = d.statut === "prete" || d.statut === "archivee";
    const nbVersions = d.deuxVersions ? 2 : d.statut === "brouillon" ? 0 : 1;
    let derniereVersionId: string | undefined;
    for (let n = 1; n <= nbVersions; n++) {
      const versionId = `${d.id}-ver-${n}`;
      const vPlans = plansDepuisScript({ videoId: d.id, versionId, blocs, dureeSec: d.duree, modeIllustrations: format.illustrations.mode, personnageId: v.distribution[0]?.personnageId, maintenant: creeLe, estDemo: true });
      // Illustrations : premières suggestions choisies, une verrouillée par Will.
      vPlans.forEach((p, i) => {
        if (p.illustration) {
          p.illustration.elementId = `illu-${String((i % 12) + 1).padStart(2, "0")}`;
          p.illustration.candidats = ["illu-01", "illu-02", "illu-05"].filter((x) => x !== p.illustration!.elementId);
          p.illustration.verrouille = n === 2 && i === 1;
          p.illustration.source = i % 4 === 3 ? "generee-ia" : "bibliotheque";
        }
        // Plan sur le double : la vignette de CETTE vidéo (jamais l'image d'une vidéo d'un autre sujet).
        p.vignetteFichierId = p.illustration?.elementId ? jpg(`/demo/illustrations/illu-${String((i % 12) + 1).padStart(2, "0")}.jpg`) : (d.vignettes?.[0] ?? VIDEO[d.demo].j);
      });
      plans.push(...vPlans);
      const commande = commandePour(v, blocs, vPlans);
      const statutVersion = d.statut === "en_fabrication" ? "en_fabrication" : d.statut === "echec" ? "echec" : "prete";
      const version: VersionVideo = {
        id: versionId,
        videoId: d.id,
        numero: n,
        parentVersionId: n > 1 ? `${d.id}-ver-${n - 1}` : undefined,
        commande,
        statut: statutVersion,
        choisie: n === nbVersions,
        coutReel: fabriquee ? centimes(lignesCout(d.duree, d.ratios.length, true).reduce((t, l) => t + l.total.centimes, 0)) : undefined,
        noteRetouche: n === 2 ? "Plan 3 refait : sourire plus naturel." : undefined,
        ...horo(d.age + (nbVersions - n) * 0.5),
      };
      if (d.statut === "en_fabrication" || d.statut === "echec") {
        const travailId = `trav-${d.id}`;
        const t = travailSimule(
          { ...commande, simulerEchecEtape: d.statut === "echec" ? "visage" : undefined },
          { travailId, versionId, titre: d.titre, maintenant: d.statut === "echec" ? maintenantMs - 90_000 : maintenantMs - 4_000 },
        );
        travaux.push({ ...t, estDemo: true });
        version.travailId = travailId;
      }
      versions.push(version);
      derniereVersionId = versionId;

      if (fabriquee) {
        for (const ratio of d.ratios) {
          const base = ratio === "16:9" ? VIDEO.podcast : VIDEO[d.demo];
          sorties.push({
            id: `${versionId}-${ratio.replace(":", "x")}`,
            videoId: d.id,
            versionId,
            ratio,
            resolution: ratio === "16:9" ? "1920x1080" : ratio === "1:1" ? "1080x1080" : ratio === "4:5" ? "1080x1350" : "1080x1920",
            fichierId: base.v,
            vignetteFichierId: ratio === "16:9" ? (d.vignettes?.[0] && d.formatId === "podcast" ? d.vignettes[0] : base.j) : (d.vignettes?.[0] ?? base.j),
            dureeSec: d.duree,
            taille: 1_150_000,
            rapportQualite: {
              note: d.note ?? 85,
              verifie: { image: true, son: true, sousTitres: true, mentionIA: d.etape === "publiee", droits: d.etape === "publiee" },
              alertes: d.note && d.note < 86 ? [{ code: "zone-protegee", gravite: "attention", message: "Le titre touche la zone des boutons TikTok.", reseau: "tiktok" }] : [],
              niveauSonoreLufs: -14,
            },
            ...horo(d.age),
          });
        }
        sousTitres.push({ id: `${versionId}-st`, videoId: d.id, versionId, langue: "fr-FR", version: 1, segments: sousTitresDepuisPlans(vPlans, 3), styleId: format.stylesParDefaut.sousTitres, ...horo(d.age) });
        for (const type of ["voix", "plan-double", "musique", "mixage", "master"] as const) {
          pistes.push({ id: `${versionId}-piste-${type}`, versionId, type, fichierId: type === "voix" ? essaiVoix : VIDEO[d.demo].v, fournisseur: "simulation", ...horo(d.age) });
        }
      }
    }
    if (derniereVersionId) v.versionChoisieId = derniereVersionId;
    if (!fabriquee && d.vignettes?.[0]) {
      // Brouillons et vidéos en cours : une couverture pour les cartes.
      miniatures.push({ id: `${d.id}-mini-1`, videoId: d.id, fichierId: d.vignettes[0], titre: d.titre, choisie: true, ratio: d.ratios[0], ...horo(d.age) });
      v.miniatureChoisieId = `${d.id}-mini-1`;
    }

    if (fabriquee) {
      v.terminee = il(d.age);
      v.coutReel = versions.find((x) => x.id === derniereVersionId)?.coutReel;
      v.noteQualite = {
        globale: d.note ?? 85,
        levres: Math.min(99, (d.note ?? 85) + 3),
        son: Math.min(99, (d.note ?? 85) + 5),
        sousTitres: Math.min(99, (d.note ?? 85) + 6),
        realisme: (d.note ?? 85) - 7,
        alertes: d.note && d.note < 86 ? [{ code: "synchronisation", gravite: "attention", message: "Léger décalage des lèvres au plan 3." }] : [],
      };
      const fonds = ["/demo/miniatures/mini-1.jpg", "/demo/miniatures/mini-2.jpg", "/demo/miniatures/mini-3.jpg"];
      fonds.forEach((cle, i) => {
        const m: Miniature = { id: `${d.id}-mini-${i + 1}`, videoId: d.id, fichierId: i === 0 ? (d.vignettes?.[0] ?? VIDEO[d.demo].j) : jpg(cle), titre: i === 2 ? d.titre : d.titre.toUpperCase(), choisie: i === 0, ratio: d.ratios[0], ...horo(d.age) };
        miniatures.push(m);
      });
      v.miniatureChoisieId = `${d.id}-mini-1`;
      const texte = texteScript(blocs);
      const premiere = texte.split(/(?<=[.?!])\s/)[0];
      kits.push({
        id: `kit-${d.id}`,
        videoId: d.id,
        textes: {
          // Phrase de durée et mots-dièse selon le format et la durée réelle (jamais « moins d'une minute » pour un podcast de 10 min).
          linkedin: { texte: `${d.titre}\n\n${premiere}\n\n${phraseDuree(d.duree)}\n\nEt vous, qu'en pensez-vous ?\n\nRéalisé avec l'IA.`, motsDiese: motsDiesePour(format.id, "linkedin", 3) },
          instagram: { texte: `${d.titre}\n${premiere}\n\nRéalisé avec l'IA.`, motsDiese: motsDiesePour(format.id, "instagram", 5) },
          facebook: { texte: `${d.titre}\n${premiere}\n\nRéalisé avec l'IA.`, motsDiese: motsDiesePour(format.id, "facebook", 3) },
          tiktok: { texte: `${d.titre} ${premiere}\nRéalisé avec l'IA.`, motsDiese: motsDiesePour(format.id, "tiktok", 4) },
          youtube: { texte: `${premiere}\n\nRéalisé avec l'IA.`, motsDiese: motsDiesePour(format.id, "youtube", 3), titre: d.titre },
          "youtube-shorts": { texte: composerLegende(d.titre, ["Réalisé avec l'IA."], 100), motsDiese: motsDiesePour(format.id, "youtube-shorts", 2), titre: d.titre },
        },
        credits: d.id === "v-02" ? ["Pexels / Cottonbro"] : [],
        avantDePublier: { image: true, son: true, sousTitres: true, mentionIA: d.etape === "publiee", droits: d.etape === "publiee" },
        creeLe: il(d.age),
        modifieLe: il(d.age),
        estDemo: true,
      });
      depenses.push({ id: `dep-${d.id}`, videoId: d.id, lignes: lignesCout(d.duree, d.ratios.length, true), total: v.coutReel ?? centimes(0), date: il(d.age), ...horo(d.age) });
    }
    videos.push(v);
  }

  // Dépenses complémentaires sur 3 mois (essais de voix, doubles, scripts).
  const depensesDiverses: [number, string, number][] = [
    [3, "Essai de voix", 35],
    [8, "Préparation du double de Clara", 900],
    [18, "Scripts (12 générations)", 48],
    [27, "Miniatures", 60],
    [38, "Préparation de mon double (trois quarts)", 1200],
    [45, "Essai de voix", 40],
    [58, "Préparation de mon double (face)", 1200],
    [66, "Copie de ma voix", 500],
    [75, "Scripts (20 générations)", 80],
  ];
  depensesDiverses.forEach(([age, etape, c], i) => {
    const total = centimes(c);
    depenses.push({ id: `dep-div-${i}`, lignes: [{ etape, fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: total, total, nature: "reel" }], total, date: il(age), ...horo(age) });
  });

  /* ---------------- Retouches ---------------- */
  const retouches: Retouche[] = [
    { id: "ret-1", videoId: "v-01", versionId: "v-01-ver-1", planIds: ["v-01-ver-1-plan-3"], consigne: "Sourire plus naturel sur ce plan.", statut: "faite", versionProduiteId: "v-01-ver-2", ...horo(11) },
    { id: "ret-2", videoId: "v-04", versionId: "v-04-ver-1", planIds: ["v-04-ver-1-plan-2"], consigne: "Changer l'image d'illustration.", statut: "demandee", ...horo(1) },
  ];

  /* ---------------- Publications ---------------- */
  const pub = (id: string, videoId: string, reseau: IdReseau, statut: Publication["statut"], via: Publication["via"], date: string, stats?: Publication["stats"]): Publication => ({
    id,
    videoId,
    sortieId: sorties.find((s) => s.videoId === videoId)?.id,
    reseau,
    statut,
    via,
    date,
    texte: kits.find((k) => k.videoId === videoId)?.textes[reseau]?.texte ?? "",
    urlPubliee: statut === "publiee" ? `https://exemple.invalid/${reseau}/${id}` : undefined,
    stats,
    ...horo(5),
  });
  const publications: Publication[] = [
    pub("pub-1", "v-01", "linkedin", "publiee", "manuel", il(10), { vues: 4820, likes: 212, commentaires: 37, partages: 18, tauxCompletion: 61 }),
    pub("pub-2", "v-01", "tiktok", "publiee", "manuel", il(9), { vues: 12940, likes: 880, commentaires: 64, partages: 120, tauxCompletion: 48 }),
    pub("pub-3", "v-09", "instagram", "publiee", "manuel", il(60), { vues: 3150, likes: 190, commentaires: 12, partages: 9, tauxCompletion: 55 }),
    pub("pub-4", "v-13", "linkedin", "publiee", "manuel", il(30), { vues: 6100, likes: 305, commentaires: 41, partages: 27, tauxCompletion: 72 }),
    pub("pub-5", "v-02", "linkedin", "programmee", "manuel", dans(1, 2)),
    pub("pub-6", "v-02", "tiktok", "programmee", "manuel", dans(0, 5)),
    pub("pub-7", "v-04", "instagram", "brouillon", "simulation", dans(2)),
    pub("pub-8", "v-11", "youtube", "brouillon", "simulation", dans(4)),
  ];

  /* ---------------- Partages ---------------- */
  // Codes TIRÉS AU HASARD à chaque création (E2E-2 données n° 11) : un code écrit en dur dans le dépôt ouvrait la
  // vidéo de démonstration à quiconque lisait le code source, et chaque visite écrivait une vue en base.
  const partages: Partage[] = [
    { id: "par-1", videoId: "v-01", code: codePartage(), sortieId: "v-01-ver-2-9x16", expireLe: dans(20), vues: 14, telechargementAutorise: true, ...horo(8) },
    { id: "par-2", videoId: "v-02", code: codePartage(), sortieId: "v-02-ver-1-9x16", expireLe: il(1), vues: 3, telechargementAutorise: false, ...horo(9) },
  ];

  /* ---------------- Modèles, idées, séries, rushs ---------------- */
  const modeles: Modele[] = [
    { id: "mod-1", nom: "Avocat 45 s vertical", formatId: "avocat", versionFormat: 1, dureeSec: 45, ratios: ["9:16"], distribution: distribWill, stylesChoisis: { lutId: "lut-axion-chaud", intensiteLut: 70, sousTitresId: "st-axion-pop", styleMontageId: "sm-tres-rythme", musiqueId: "mus-tension", habillageId: "hab-axion" }, reglages: reglagesParDefaut(formatAvocat), creeDepuisVideoId: "v-01", vignetteFichierId: VIDEO.droits.j, utilisations: 6, marqueId: MARQUE, ...horo(11) },
    { id: "mod-2", nom: "Avocat 60 s carré LinkedIn", formatId: "avocat", versionFormat: 1, dureeSec: 60, ratios: ["1:1", "9:16"], distribution: [{ ...distribWill[0], visageId: "vis-will-34" }], stylesChoisis: { lutId: "lut-cinema", intensiteLut: 50, sousTitresId: "st-sobre", styleMontageId: "sm-rythme", musiqueId: "mus-nappe" }, reglages: reglagesParDefaut(formatAvocat), creeDepuisVideoId: "v-09", vignetteFichierId: vignette(7), utilisations: 2, marqueId: MARQUE, ...horo(40) },
  ];

  const idees: Idee[] = [
    { id: "idee-1", texte: "Tableau de bord : les 3 chiffres à suivre le lundi", formatSuggere: "avocat", etat: "nouvelle", ...horo(0.3) },
    { id: "idee-2", texte: "Les 3 outils IA que j'utilise chaque matin", formatSuggere: "ecran-partage", etat: "nouvelle", ...horo(1) },
    { id: "idee-3", texte: "Interview d'un dirigeant qui a automatisé sa compta", formatSuggere: "podcast", etat: "nouvelle", ...horo(2) },
    { id: "idee-4", texte: "Combien coûte vraiment un salarié ?", formatSuggere: "motion", etat: "nouvelle", ...horo(4) },
    { id: "idee-5", texte: "Automatiser ses devis en 3 étapes", formatSuggere: "avocat", etat: "en-video", scriptId: "script-5", videoId: "v-07", ...horo(5) },
    { id: "idee-6", texte: "Relances clients : ce qu'un assistant peut faire seul", formatSuggere: "avocat", etat: "nouvelle", ...horo(7) },
    { id: "idee-7", texte: "Ce que l'IA ne fera jamais à votre place", formatSuggere: "selfie", etat: "nouvelle", ...horo(9) },
    { id: "idee-8", texte: "Factures ressaisies à la main : que faire ?", formatSuggere: "avocat", etat: "en-video", videoId: "v-08", ...horo(12) },
  ];

  const series: Serie[] = [{ id: "serie-droit", nom: "L'IA au travail en 45 s", formatId: "avocat", description: "Une question de dirigeant, une réponse claire.", ...horo(30) }];

  const rushs: Rush[] = [
    { id: "rush-1", nom: "Marche dans le couloir", fichierId: mp4("/demo/rushs/couloir.mp4", 720, 1280, 6), personnageId: "p-will", dureeSec: 10, motsCles: ["marche", "bureau"], ...horo(20) },
    { id: "rush-2", nom: "Mains sur le clavier", fichierId: mp4("/demo/rushs/clavier.mp4", 720, 1280, 6), personnageId: "p-will", dureeSec: 10, motsCles: ["clavier", "travail"], ...horo(20) },
  ];

  /* ---------------- Notifications, paramètres, journal ---------------- */
  const notifications: Notification[] = [
    { id: "not-1", type: "echec", titre: "Une étape n'a pas abouti", message: "« Un outil IA gratuit : un piège ? » — le double. Vous pouvez réessayer.", lien: "/videos/v-06", lue: false, ...horo(0.05) },
    { id: "not-2", type: "video-prete", titre: "Votre vidéo est prête", message: "« L'IA peut-elle remplacer mon comptable ? »", lien: "/videos/v-03", lue: false, ...horo(0.2) },
    { id: "not-3", type: "publication", titre: "Publication demain à 10 h", message: "LinkedIn — « Relancer un devis par SMS : bonne idée ? »", lien: "/calendrier", lue: true, ...horo(1) },
    { id: "not-4", type: "visage-pret", titre: "Le double de Clara est prêt", lien: "/personnages/p-clara", lue: true, ...horo(8) },
    { id: "not-5", type: "budget", titre: "Vous avez utilisé 25 % du budget du mois", lien: "/reglages", lue: true, ...horo(3) },
  ];

  const p = (id: string, valeur: unknown): Parametre => ({ id, valeur, creeLe: il(90), modifieLe: il(90) });
  const parametres: Parametre[] = [
    p("budget.mensuel", centimes(15000)),
    p("budget.seuilConfirmation", centimes(2000)),
    p("afficherExemples", true),
    p("mentionIA.parDefaut", MENTION_IA_PAR_DEFAUT),
    p("reseaux.parDefaut", ["linkedin", "instagram", "tiktok", "youtube-shorts"]),
    p("notifications", { videoPrete: true, echec: true, budget: true, canal: "console" }),
  ];

  const evenements: Evenement[] = [
    { id: "ev-1", type: "connexion", message: "Connexion depuis un iPhone", date: il(0, 1), ...horo(0) },
    { id: "ev-2", type: "fabrication", message: "Fabrication lancée : « Mes données dans ChatGPT : quel risque ? »", entite: "video", entiteId: "v-05", date: il(0), ...horo(0) },
    { id: "ev-3", type: "echec", message: "Étape en échec : le double (« Un outil IA gratuit »)", entite: "video", entiteId: "v-06", date: il(0.05), ...horo(0) },
    { id: "ev-4", type: "partage", message: "Lien privé créé pour « ChatGPT peut-il lire vos fichiers clients ? »", entite: "video", entiteId: "v-01", date: il(8), ...horo(8) },
    { id: "ev-5", type: "personnage", message: "Personnage ajouté : Sophie Lambert (accord en attente)", entite: "personnage", entiteId: "p-sophie", date: il(6), ...horo(6) },
    { id: "ev-6", type: "retouche", message: "Plan 3 refait sur « ChatGPT peut-il lire vos fichiers clients ? »", entite: "video", entiteId: "v-01", date: il(11), ...horo(11) },
    { id: "ev-7", type: "voix", message: "Ma voix est prête", entite: "voix", entiteId: "voix-will", date: il(65), ...horo(65) },
  ];

  void maintenant;
  return {
    marques,
    fichiers,
    personnages,
    visages,
    voix,
    prononciations,
    elements,
    scripts,
    videos,
    versions,
    plans,
    pistes,
    retouches,
    miniatures,
    sousTitres,
    sorties,
    kits,
    publications,
    partages,
    modeles,
    idees,
    series,
    rushs,
    travaux,
    depenses,
    ressourcesFournisseurs,
    notifications,
    parametres,
    evenements,
  };
}
