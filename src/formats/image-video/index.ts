import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import { CRITERES_STANDARD, migrationIdentite, REGLES_COMMUNES } from "../communs";

/**
 * FORMAT « IMAGE → VIDÉO » (image-video, code IV) — plan `docs/formats/image-video/50-PLAN-ARCHITECTE.md`, lot L15.
 *
 * Une infographie d'Axion-IA prend vie : le studio la lit (deux lectures Claude, carte validée par Will), écrit le
 * script (validé par Will), le fait dire par la voix de Will, puis anime l'image bloc par bloc sur la voix, une version
 * par réseau (YouTube Shorts, LinkedIn, Instagram, Facebook), en 9:16, sauf LinkedIn et le fil Facebook en 4:5 (décision de Will du 24/10). Aucun visage, aucune musique ;
 * bruitages discrets obligatoires.
 *
 * Statut `masque`. Inscrit au lot L17 dans `src/formats/index.ts`, `registre-codes.ts`, `moteurs/ids.ts`,
 * `moteurs/index.ts` et `Racine.tsx` (`RACCORDS_IMAGE_VIDEO` : ces 5 raccords). Il ne passe `actif` que sur décision de Will.
 */

export const ID_FORMAT_IMAGE_VIDEO = "image-video";
export const CODE_FORMAT_IMAGE_VIDEO = "IV";
export const ID_MOTEUR_IMAGE_VIDEO = "montage-image-video";

/** Les quatre réseaux du format (formats : voir `FORMATS_PAR_RESEAU_IV`, LinkedIn en 4:5 depuis le 24/10). */
export const RESEAUX_IMAGE_VIDEO = ["youtube-shorts", "linkedin", "instagram", "facebook"] as const;

/**
 * Réglages du format :
 * - `decoupage` : une seule valeur (« chapitres ») ; le mode « deux vidéos » n'existe pas dans cette version (B1) ;
 * - `appelCommentaire` : la fin seule (défaut depuis le 26/10/2026 : une seule demande par fin), ou la question propre à l'image puis la fin du réseau ;
 * - `validationCarte` : « automatique » (défaut : le code répare et adapte la carte, la carte et le script sont validés par
 *   le réglage, rien n'attend Will), « si-doute » (la carte ne s'affiche qu'en cas de doute, obligatoire pour les 10
 *   premières) ou « toujours » ;
 * - `bruitages` : « discrets », forcé (aucune autre valeur, jamais de musique).
 */
export const schemaReglagesImageVideo = z.object({
  decoupage: z.literal("chapitres").default("chapitres"),
  appelCommentaire: z.enum(["question-puis-fin", "fin-seule"]).default("fin-seule"),
  validationCarte: z.enum(["automatique", "toujours", "si-doute"]).default("automatique"),
  bruitages: z.literal("discrets").default("discrets"),
});
export type ReglagesImageVideo = z.infer<typeof schemaReglagesImageVideo>;

export const formatImageVideo: DefinitionFormat = {
  id: ID_FORMAT_IMAGE_VIDEO,
  version: 1,
  nom: "Image → vidéo",
  nomCourt: "Image → vidéo",
  accroche: "Votre idée prend vie.",
  description: "Décrivez votre idée ou collez votre script : le studio écrit le script, puis l'anime bloc par bloc sur votre voix, une version par réseau.",
  icone: "images",
  statut: "masque",
  /** Vidéos sur le site (lot S1) : conseil du plan, la décision est le réglage `siteGenerateurs.image-video`. */
  site: "non",
  adresseCreation: "/image-video",
  adresseFiche: "/image-video/{id}",
  ouvertDansLaNavigation: true,
  famille: "motion",
  codeClassement: CODE_FORMAT_IMAGE_VIDEO,
  declinaison: "aucune",
  // Corps de 30 à 78 s selon la complexité de l'image (plan § 3) ; total au plus 86 s (sous les 90 s de Facebook).
  durees: { mode: "depuis-script", zoneSec: [30, 64], zoneOrangeSec: [64, 86], ciblesGenerationSec: [40, 50, 60], cibleParDefautSec: 50 },
  ratios: ["9:16"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran" },
  // La voix seule : aucun visage n'est rendu.
  personnages: { min: 1, max: 1, roles: ["voix"], sources: ["double"] },
  entrees: [],
  etapes: ["express", "fabrication"],
  reglages: {
    schema: schemaReglagesImageVideo,
    champs: [
      {
        cle: "appelCommentaire",
        libelle: "Fin de la vidéo",
        type: "choix",
        options: [
          { valeur: "question-puis-fin", libelle: "Question, puis fin" },
          { valeur: "fin-seule", libelle: "Fin seule" },
        ],
      },
      {
        cle: "validationCarte",
        libelle: "Vérifier ce que j'ai compris",
        type: "choix",
        options: [
          { valeur: "automatique", libelle: "Automatique (le studio répare et adapte seul)" },
          { valeur: "si-doute", libelle: "En cas de doute" },
          { valeur: "toujours", libelle: "Toujours" },
        ],
        aide: "Automatique : l'image est réparée et adaptée sans validation, et ce qui a été adapté est dit sur l'écran de résultat.",
      },
    ],
  },
  recetteScript: {
    // Ossature unique (plan § 4) ; la recette par type d'image vit dans le moteur (`recettes.ts`).
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Huit mots au plus, finie avant trois secondes.", dureeCibleSec: [2, 3] },
      { id: "douleur", nom: "Douleur", couleur: "sauge", consigne: "Ce que la situation coûte aujourd'hui.", dureeCibleSec: [4, 8] },
      { id: "explication", nom: "Explication", couleur: "sauge", consigne: "L'image racontée bloc par bloc, chaque chiffre dit et montré.", dureeCibleSec: [18, 50], repetable: true },
      { id: "phrase-choc", nom: "Phrase-choc", couleur: "orange-vif", consigne: "La phrase du bas de l'image, mot pour mot.", dureeCibleSec: [2, 5] },
    ],
    regles: [...REGLES_COMMUNES, "Vouvoiement : toujours « vous ».", "Jamais le mot « machine »."],
    // Pas de critère « appel » : le format n'écrit aucune phrase d'appel (la fin vient de la banque).
    criteres: CRITERES_STANDARD.filter((c) => c.id !== "appel"),
    references: [],
    motsParSeconde: DEBIT_MOTS_PAR_SEC,
    modesDiction: ["voix-off"],
    modeParDefaut: "voix-off",
    annotations: ["titreEcran", "emphase", "illustration"],
    partiesDeclinaison: { ouverture: [], fin: [] },
  },
  briques: { "sous-titres": "active", "mention-ia": "au-choix-coupee" },
  musique: "interdite",
  stylesParDefaut: {},
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 3, sourcesAutorisees: [], affichage: "plein-ecran" },
  capacitesRequises: ["voix", "motion"],
  moteur: ID_MOTEUR_IMAGE_VIDEO,
  reseauxConseilles: [...RESEAUX_IMAGE_VIDEO],
  exemples: [],
  aFournir: ["Une infographie (PNG, JPEG ou WebP, 800 px de côté au moins)"],
  migrerReglages: migrationIdentite,
  pieces: {
    habillage: "charte-duo/1",
    sons: ["chiffre", "document", "telephone", "illustration-forte", "impact"],
    fin: "appels",
    voix: "voix-maitre",
    rendu: "par-scenes",
    controleImage: true,
  },
  ecranVideo: { attente: "generique", retouche: "aucune", monteur: false, coutsVisibles: true, publication: "aucune" },
};

/**
 * Les 5 raccords à poser au lot L17 (fichiers partagés, NON modifiés ici), une ligne chacun. Lu par le test du format :
 * si une de ces lignes apparaît avant L17, il le signale.
 */
export const RACCORDS_IMAGE_VIDEO = Object.freeze([
  { fichier: "src/formats/registre-codes.ts", ligne: `{ code: "${CODE_FORMAT_IMAGE_VIDEO}", formatId: "${ID_FORMAT_IMAGE_VIDEO}", creeLe: "2026-10-15" },` },
  { fichier: "src/formats/index.ts", ligne: `import { formatImageVideo } from "./image-video"; … puis \`formatImageVideo\` dans la liste FORMATS` },
  { fichier: "src/moteurs/ids.ts", ligne: `"${ID_MOTEUR_IMAGE_VIDEO}" ajouté à IDS_MOTEURS` },
  { fichier: "src/moteurs/index.ts", ligne: `import { moteurMontageImageVideo } from "./montage-image-video"; … puis \`"${ID_MOTEUR_IMAGE_VIDEO}": moteurMontageImageVideo\`` },
  { fichier: "studio-rendu/compositions/Racine.tsx", ligne: "import { CompositionsImageVideo } from \"./image-video/Compositions\"; … puis <CompositionsImageVideo /> dans la racine" },
]);
