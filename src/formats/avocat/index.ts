import { z } from "zod";
import type { BlocScript } from "@/domaine/types";
import type { DefinitionFormat, EncadreOuverture, RecetteMontage } from "../types";
import { briquesAuChoix, REGLES_COMMUNES, REPARTITIONS_ANGLES } from "../communs";

/**
 * FORMAT « TYPE AVOCAT », version 2 (plan du moteur avocat v3.2, B.0 §14, B.9 bis).
 *
 * Réglages propres au format. Le rythme (style de montage), les sous-titres, le décor et la musique
 * ne sont PAS ici : ils vivent dans les styles et les briques (AV2.7), un seul réglage par sujet.
 * Le tu / vous est choisi à chaque vidéo (Video.adresse), pas dans ces réglages (une seule source).
 */
const schema = z.object({
  repartitionAngles: z.enum(["principal", "egal", "un-angle"]).default("principal"),
  micro: z.boolean().default(false),
  ouvertureSurIllustration: z.boolean().default(false),
  /** Correcteur réel 2 : comment votre double est filmé (en pied : cadrages beaucoup plus serrés, centrés sur le visage). */
  cadrageDouble: z.enum(["taille", "en-pied"]).default("taille"),
  /** Correcteur réel 2 : fin courte qui fait repartir la vidéo en boucle (sinon : vraie respiration et fondu de fin). */
  finEnBoucle: z.boolean().default(false),
});

/** v1 → v2 : `deuxAngles` devient `repartitionAngles` ; `titreEnHaut` et `carteFinale` sont retirés (contraires au style). */
export function migrerReglagesAvocat(reglages: Record<string, unknown>, depuisVersion: number): Record<string, unknown> {
  if (depuisVersion >= 2) return { ...reglages };
  const { deuxAngles, titreEnHaut: _t, carteFinale: _c, ...reste } = reglages;
  void _t;
  void _c;
  return { ...reste, repartitionAngles: deuxAngles === false ? "un-angle" : (reste.repartitionAngles ?? "principal") };
}

/** Correspondance des blocs de la recette v1 vers la v2. */
const BLOCS_V1_VERS_V2: Record<string, string> = { accroche: "accroche", question: "promesse", reponse: "coeur", explication: "coeur", fin: "appel" };
const ORDRE_V2 = ["accroche", "promesse", "coeur", "preuve", "appel", "boucle"];

/**
 * Migration PURE d'un script v1 → v2 (B.9 bis) : accroche → accroche, question → promesse,
 * réponse + explication → cœur, fin → appel ; `preuve` et `boucle` ajoutés VIDES (« à compléter », non bloquant).
 * Aucun texte n'est perdu ; un bloc inconnu est gardé tel quel.
 */
export function migrerScriptAvocat(blocs: BlocScript[], depuisVersion: number): BlocScript[] {
  if (depuisVersion >= 2) return blocs;
  const sortie: BlocScript[] = [];
  for (const b of blocs) {
    const cible = BLOCS_V1_VERS_V2[b.blocRecette];
    if (!cible) {
      sortie.push(b);
      continue;
    }
    // Réponse et explication fusionnent dans UN cœur (la recette v2 n'en a qu'un), dans l'ordre du texte.
    const coeur = cible === "coeur" ? sortie.find((x) => x.blocRecette === "coeur") : undefined;
    if (coeur) coeur.segments = [...coeur.segments, ...b.segments];
    else sortie.push({ ...b, blocRecette: cible, segments: [...b.segments] });
  }
  for (const manquant of ["preuve", "boucle"]) {
    if (!sortie.some((b) => b.blocRecette === manquant)) sortie.push({ id: `${manquant}-migre-${blocs[0]?.id ?? "script"}`, blocRecette: manquant, segments: [] });
  }
  const rang = (id: string) => {
    const i = ORDRE_V2.indexOf(id);
    return i < 0 ? ORDRE_V2.length : i;
  };
  return sortie
    .map((b, i) => ({ b, i }))
    .sort((x, y) => rang(x.b.blocRecette) - rang(y.b.blocRecette) || x.i - y.i)
    .map((x) => x.b);
}

/** Encadré blanc des 3 premières secondes : le thème, puis l'accroche en majuscules (mesuré sur la référence). */
export const ENCADRE_OUVERTURE_AVOCAT: EncadreOuverture = {
  de: 0,
  a: 3,
  fond: "blanc",
  police: "Inter Bold",
  taillePx: [54, 58],
  rayonPx: [28, 32],
  largeurMaxPct: 70,
  centrePct: 60,
  ecartSousSousTitresPx: 80,
  motsMax: 8,
  lignesMax: 2,
  caracteresAlerte: 50,
  lignes: ["theme", "accroche"],
};

/**
 * Consigne de gestes et de regard envoyée à HeyGen (`motion_prompt`) à chaque rendu. Correcteur réel 2 (04/10) : tête
 * stable, petits gestes sous la poitrine (Will est filmé debout) ; trois quarts : regard sur l'interlocuteur hors champ ;
 * presque de face : regard fixe vers l'objectif.
 */
const MOTION_COMMUN = "steady head, small natural hand gestures below the chest, hands relaxed between gestures, calm and confident delivery, no pointing, no counting on fingers, no thumbs up";
const MOTION_PRINCIPAL = `speaking to a person just off-camera to his right, eyes on that interlocutor, ${MOTION_COMMUN}`;
const MOTION_FACE = `eyes fixed on the camera lens, ${MOTION_COMMUN}`;

/** Règles chiffrées du montage avocat (B.2, B.3, B.4), figées dans chaque commande. */
export const RECETTE_MONTAGE_AVOCAT: RecetteMontage = {
  version: 1,
  angles: { principal: "trois-quarts", second: "face", repartitionParDefaut: REPARTITIONS_ANGLES.principal, secondJamaisDeuxFoisDeSuite: true, secondJamaisSurAccroche: true },
  cadrages: { largePct: 100, poitrinePct: [118, 122], poitrineParDefautPct: 120, seuilLevres: 85, poitrinePlafondLevresFaiblesPct: 112, zoomLentPct: [100, 106], zoomLentApresSec: 3, enPied: { largePct: 140, poitrinePct: 200, serrePct: 260, poitrineLevresFaiblesPct: 175, pointInteretY: 0.18 } },
  coupes: { premiereAvantSec: 2, auMoinsAvant5s: 2, pauseMinMs: 60, blancForceCoupeMs: 300, finApresDernierMotSec: [1.1, 1.3], finBoucleSec: [0.4, 0.6] },
  illustrations: { couverturePct: 25, dureeSec: [1.5, 2.5], jamaisDeuxDeSuite: true, pasDansDernieresSec: 1.5, ouvertureMaxSec: 1.5, visageAvantSec: 2, ancrageMotSec: [-0.2, 0.1] },
  nettoyageBlancs: { seuilMs: 180, cibleMs: [80, 120], fonduMs: [10, 20], respirationMs: [150, 250], teteMaxMs: 100 },
  motionPrompt: {
    "trois-quarts": MOTION_PRINCIPAL,
    face: MOTION_FACE,
  },
};

/**
 * Export (B.7). Son : AAC 256 kb/s (lot M4b ; B.7 disait 320) : l'encodeur AAC de FFmpeg (libfdk_aac n'est pas
 * distribué, licence) livre ≈ 240 kb/s quelle que soit la consigne au-delà de 256 sur une voix en double mono (le
 * canal différence est vide) ; mesuré 239 kb/s à 320 comme à 256. Les plateformes réencodent vers 128 kb/s.
 */
const EXPORT_AVOCAT = { fps: 25, debitMbpsMin: 12, debitMbpsMax: 16, audio: { codec: "aac" as const, kbps: 256, hz: 48000 }, couleur: "bt709" as const };

export const formatAvocat: DefinitionFormat = {
  id: "avocat",
  version: 2,
  nom: "Vidéo type avocat",
  nomCourt: "Type avocat",
  accroche: "Interview à deux caméras, fond sombre",
  description: "Une accroche forte, une promesse, l'essentiel en trois idées, une preuve, un appel. Le format qui fait réagir.",
  icone: "balance",
  statut: "actif",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.avocat`. */
  site: "oui",
  chapitresWeb: { rattaches: ["boucle"] },
  famille: "face-camera",
  // Générateur (G1a) : code de classement et déclinaison (ouverture et fin refaites par réseau, corps commun).
  codeClassement: "AV",
  declinaison: "ouverture-fin",
  // La durée vient du texte (mots ÷ débit) : vert 25-40 s, orange 40-50 s, « hors zone » au-delà (B.0 §18, v3.2).
  durees: { mode: "depuis-script", zoneSec: [25, 40], zoneOrangeSec: [40, 50], ciblesGenerationSec: [30, 45, 60], cibleParDefautSec: 30 },
  ratios: ["9:16", "4:5", "1:1"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran", "4:5": "plein-ecran", "1:1": "plein-ecran" },
  personnages: { min: 1, max: 1, roles: ["Face caméra"], sources: ["double", "rush"] },
  entrees: [],
  // Lot M3 : un seul écran « Votre vidéo » (5 blocs en feuilles compactes), puis la fabrication (B.0 §2, B.9).
  etapes: ["express", "fabrication"],
  reglages: {
    schema,
    champs: [
      {
        cle: "repartitionAngles",
        libelle: "Répartition des angles",
        type: "choix",
        options: [
          { valeur: "principal", libelle: "Surtout l'angle principal" },
          { valeur: "egal", libelle: "Deux angles à parts égales" },
          { valeur: "un-angle", libelle: "Un seul angle" },
        ],
      },
      {
        cle: "cadrageDouble",
        libelle: "Votre avatar est filmé",
        type: "choix",
        options: [
          { valeur: "taille", libelle: "À la taille" },
          { valeur: "en-pied", libelle: "En pied" },
        ],
        aide: "En pied : les plans alternent mi-cuisse, poitrine et visage, comme deux caméras.",
      },
      { cle: "micro", libelle: "Micro de podcast à l'image", type: "interrupteur", aide: "Posé du côté où vous regardez, flou, coupé par le bord." },
      {
        cle: "finEnBoucle",
        libelle: "Fin en boucle",
        type: "interrupteur",
        aide: "La vidéo s'arrête juste après le dernier mot pour repartir au début. Sinon : une respiration et un fondu au noir.",
      },
      {
        cle: "ouvertureSurIllustration",
        libelle: "Ouvrir sur une image",
        type: "interrupteur",
        aide: "Ouvrir sur une image peut faire perdre des spectateurs : à tester avec 2 versions.",
      },
    ],
  },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Le moment le plus fort, sans introduction. 12 mots au plus.", dureeCibleSec: [1, 3] },
      { id: "promesse", nom: "Promesse", couleur: "ambre", consigne: "Ce qu'on gagne à rester : « je vous explique comment l'éviter ».", dureeCibleSec: [2, 4] },
      { id: "coeur", nom: "Cœur", couleur: "sauge", consigne: "Trois idées au plus, une phrase = une idée, une relance toutes les 8 à 10 s.", dureeCibleSec: [10, 25] },
      { id: "preuve", nom: "Preuve", couleur: "texte-doux", consigne: "Un cas réel ou un chiffre, toujours.", dureeCibleSec: [3, 8] },
      { id: "appel", nom: "Appel", couleur: "orange-vif", consigne: "Une seule action, écrite pour mener à l'accroche.", dureeCibleSec: [2, 5] },
      { id: "boucle", nom: "Boucle", couleur: "brique", consigne: "La dernière phrase rejoint l'accroche : la vidéo tourne en boucle.", dureeCibleSec: [1, 3] },
    ],
    regles: [
      ...REGLES_COMMUNES,
      "L'accroche arrive avant 2 s, la promesse avant 5 s.",
      "Trois idées au plus ; une relance toutes les 8 à 10 s.",
      "Toujours une preuve : un cas réel ou un chiffre.",
      "Un seul appel à l'action, qui ramène à l'accroche (boucle).",
      "Ton oral : « est-ce qu'on le dirait comme ça à voix haute ? ».",
    ],
    criteres: [
      { id: "accroche", nom: "Accroche", poids: 3 },
      { id: "promesse", nom: "Promesse", poids: 2 },
      { id: "clarte", nom: "Clarté", poids: 2 },
      { id: "preuve", nom: "Preuve", poids: 2 },
      { id: "appel", nom: "Appel à l'action", poids: 1 },
      { id: "duree", nom: "Durée", poids: 1 },
      { id: "oralite", nom: "Oralité", poids: 1 },
      { id: "boucle", nom: "Boucle", poids: 1 },
    ],
    references: ["script-ref-avocat-1", "script-ref-avocat-2"],
    // Mesuré sur les références : 3,9 à 5,0 mots/s (B.9 bis).
    // Générateur (G1a, B.0 n° 86) : jusqu'à 2 segments facultatifs, retenus sur LinkedIn seulement.
    segmentsFacultatifsMax: 2,
    motsParSeconde: 4.4,
    annotations: ["angle", "titreEcran", "emphase", "illustration", "zoom", "pause", "incrustation"],
  },
  briques: briquesAuChoix(),
  stylesParDefaut: {
    lut: "lut-avocat-v1",
    intensiteLut: 70,
    sousTitres: "st-avocat-v1",
    styleMontage: "sm-avocat-v1",
    habillage: "hab-avocat-v1",
    profilSon: "ps-avocat-v1",
    // N1 Halo orange (décision de Will du 01/10 soir, `decors/CATALOGUE-DECORS.md`) ; « Noir chaud » reste au choix.
    decor: "decor-n1-halo-orange",
  },
  illustrations: { mode: "auto", couvertureCiblePct: 25, dureePlanSec: [1.5, 2.5], sourcesAutorisees: ["bibliotheque", "banque", "generee-ia"], affichage: "plein-ecran" },
  accrocheVisuelle: { titreFixe: false, encadreOuverture: ENCADRE_OUVERTURE_AVOCAT },
  musique: "interdite",
  export: EXPORT_AVOCAT,
  profilRendu: {
    version: 1,
    sousTitresId: "st-avocat-v1",
    styleMontageId: "sm-avocat-v1",
    habillageId: "hab-avocat-v1",
    profilSonId: "ps-avocat-v1",
    lutId: "lut-avocat-v1",
    decorId: "decor-n1-halo-orange",
    export: EXPORT_AVOCAT,
    encadreOuverture: ENCADRE_OUVERTURE_AVOCAT,
    // Grain en luminance 3-5 %, légère vignette (B.7) : réglés après un envoi test privé (lot M4).
    realisme: { grainPct: 4, vignettePct: 8, ambiance: "noir chaud, lueur orange" },
    // Lot « intensité · bruitages » (02/10) : Équilibré, bruitages discrets (posés seulement une fois écoutés et
    // validés par Will dans la Bibliothèque).
    intensite: "equilibre",
    bruitages: "discrets",
  },
  recetteMontage: RECETTE_MONTAGE_AVOCAT,
  capacitesRequises: ["voix", "visage", "retouche-par-plan", "posture", "decor"],
  // Simulation jusqu'au lot M7 : le moteur réel est choisi AU LANCEMENT par le réglage `moteur.avocat` (B.1).
  moteur: "simulation",
  // Générateur (G1a) : Facebook ajouté (sur accord de Will).
  reseauxConseilles: ["tiktok", "instagram", "youtube-shorts", "linkedin", "facebook"],
  exemples: [
    { titre: "Mon patron peut-il lire mes mails ?", vignette: "/demo/avocat-droits.jpg", video: "/demo/avocat-droits.mp4", ratio: "9:16" },
    { titre: "Licencié par SMS : c'est légal ?", vignette: "/demo/avocat-licenciement.jpg", video: "/demo/avocat-licenciement.mp4", ratio: "9:16" },
  ],
  aFournir: ["Un texte, ou une idée", "Mon double (visage + voix)"],
  migrerReglages: migrerReglagesAvocat,
  migrerScript: migrerScriptAvocat,
};
