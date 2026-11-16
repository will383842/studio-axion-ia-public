/**
 * DOSSIER MODÈLE D'UN NOUVEAU GÉNÉRATEUR (G1-04). À COPIER vers `src/formats/<id>/index.ts`, jamais à importer :
 * aucun fichier du studio ne cite ce dossier (le test `tests/generateurs/gabarit-dossier.test.ts` le vérifie).
 *
 * Gestes du guide `docs/formats/AJOUTER-UN-FORMAT.md` (section « Créer un nouveau générateur : les 16 gestes ») :
 *   - ce fichier est le geste 2 ; l'inscription dans `src/formats/index.ts` (geste 3) est faite par une personne ;
 *   - le moteur se copie depuis `src/moteurs/gabarit/` (geste 5), la composition depuis
 *     `studio-rendu/compositions/_gabarit/Gabarit.tsx` (geste 6).
 * Règles : statut `masque` (seul Will passe `actif`) ; aucune couleur ni police en dur ; aucun import d'un autre format ;
 * pas de musique ; aucune transition sur le visage ; la durée vient du script.
 * Remplacez chaque valeur « MODELE » ci-dessous ; une fiche copiée ne doit plus contenir ce mot.
 */
import { z } from "zod";
import type { DefinitionFormat } from "../types";
import { briquesAuChoix, CRITERES_STANDARD, entree, migrationIdentite, REGLES_COMMUNES } from "../communs";

/** Identifiant : minuscules et tirets. Le dossier du format, du moteur (`montage-<id>`) et de la composition le reprennent. */
export const ID_FORMAT_MODELE = "modele";
/** Code libre de 2 ou 3 lettres : à réserver d'abord, en ajout seul, dans `src/formats/registre-codes.ts` (geste 1). */
export const CODE_FORMAT_MODELE = "MOD";

export const formatModele: DefinitionFormat = {
  id: ID_FORMAT_MODELE,
  version: 1,
  nom: "Modèle de générateur",
  nomCourt: "Modèle",
  accroche: "Une phrase simple, en vouvoiement",
  description: "Ce que la vidéo montre et ce que vous fournissez, en une ou deux phrases sans jargon.",
  icone: "ecran-partage",
  adresseCreation: "/modele",
  /** Toujours `masque` à la création : seul Will passe un format à `actif`. */
  statut: "masque",
  famille: "autre",
  codeClassement: CODE_FORMAT_MODELE,
  declinaison: "aucune",
  /** La durée vient du script (jamais d'un nombre posé ici sans zone). */
  durees: { mode: "depuis-script", zoneSec: [30, 90], zoneOrangeSec: [90, 150], ciblesGenerationSec: [45, 60, 90], cibleParDefautSec: 60 },
  /** Les ratios du moteur (`src/moteurs/gabarit/`, champ `ratios` de la définition), ni plus ni moins. */
  ratios: ["9:16"],
  ratioMaitre: "9:16",
  miseEnPage: "plein-ecran",
  miseEnPageParRatio: { "9:16": "plein-ecran" },
  personnages: { min: 0, max: 0, roles: [], sources: [] },
  entrees: [
    entree("medias-illustration", "Vos images", "Facultatif : sans elles, la vidéo se fait avec des visuels de texte.", { obligatoire: false, multiple: true, accepte: ["image/*"] }),
  ],
  etapes: ["express", "fabrication"],
  reglages: { schema: z.object({}), champs: [] },
  recetteScript: {
    blocs: [
      { id: "accroche", nom: "Accroche", couleur: "orange", consigne: "Dite en 3 s : ce que la vidéo va montrer.", dureeCibleSec: [3, 6] },
      { id: "corps", nom: "Le fond", couleur: "sauge", consigne: "Une idée par phrase.", dureeCibleSec: [20, 70] },
      { id: "appel", nom: "Appel", couleur: "orange-vif", consigne: "Une seule action.", dureeCibleSec: [4, 8] },
    ],
    regles: [...REGLES_COMMUNES],
    criteres: CRITERES_STANDARD,
    references: [],
    motsParSeconde: 2.8,
    annotations: ["emphase", "pause"],
  },
  briques: briquesAuChoix(),
  stylesParDefaut: { lut: "lut-axion-naturel", sousTitres: "st-avocat-v1", styleMontage: "sm-rythme", profilSon: "ps-voix-claire" },
  illustrations: { mode: "aucune", couvertureCiblePct: 0, dureePlanSec: 2, sourcesAutorisees: [], affichage: "incrustation" },
  accrocheVisuelle: { titreFixe: false, position: "haut" },
  /** Aucune musique, jamais. */
  musique: "interdite",
  capacitesRequises: [],
  /** Identifiant du moteur inscrit (`src/moteurs/ids.ts`, geste 4) : ici le moteur de `src/moteurs/gabarit/` une fois copié et renommé. */
  moteur: "montage-modele",
  reseauxConseilles: ["linkedin", "instagram"],
  exemples: [],
  aFournir: ["Vos images (facultatif)"],
  migrerReglages: migrationIdentite,
  /** `true` : pas de prix affiché ni de montant (format maison). */
  sansPrix: true,
  /** Ce que l'écran de la vidéo affiche ou masque (remplace les `formatId === …` de la fiche vidéo). */
  ecranVideo: { attente: "generique", retouche: "operations", monteur: false, coutsVisibles: false, publication: "generique" },
  /** Pièces communes demandées (voir `PiecesFormat` dans `src/formats/types.ts`). */
  pieces: { sons: [], fin: "appels", voix: "voix-maitre", rendu: "une-passe", controleImage: true },
};
