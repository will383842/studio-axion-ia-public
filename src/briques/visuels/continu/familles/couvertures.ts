import { z } from "zod";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
import type { DefinitionGabarit } from "../registre-gabarits";

const mots = (t: string) => t.trim().split(/\s+/);
/** Texte sans lien de 1 à `max` caractères dont aucun mot ne dépasse `motMax` caractères (un mot ne se coupe pas : il sortirait de sa boîte). */
const texte = (max: number, motMax: number) => texteSansLien(1, max).refine((t) => mots(t).every((m) => m.length <= motMax), `mots de ${motMax} caractères au plus`);
/** Morceau de titre : `nombre` mots au plus (le titre d'une page 1 tient en 10 mots : titre + accent + suite). */
const court = (max: number, nombre: number, motMax: number) => texte(max, motMax).refine((t) => mots(t).length <= nombre, `${nombre} mots au plus`);
const alt = () => texteSansLien(1, 125);
const rubrique = () => texteSansLien(1, RUBRIQUE_MAX).optional();
const trois = <T extends z.ZodType>(un: T) => z.array(un).length(3);
const deux = <T extends z.ZodType>(un: T) => z.array(un).length(2);

/**
 * Couvertures (page 1) : le titre tient en 10 mots au plus, accent compris. L'accent (italique orange) est un champ à part ; `suite` reprend
 * le titre après l'accent. Numéros, icônes, décors et mots d'interface (« Activité ») sont posés par le code, jamais des champs.
 * `bordsLibres` : intervalles verticaux (4:5, hauteur 1350) sans texte ni objet dans les 120 px de chaque bord, relevés sur les rendus de
 * contenu moyen (en-tête et pied posés par le moteur exclus).
 */
export const COUVERTURES: DefinitionGabarit[] = [
  {
    type: "C01",
    nom: "Orbite",
    famille: "couverture",
    role: "couverture",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C01"),
        alt: alt(),
        rubrique: rubrique(),
        titre: court(12, 4, 11),
        accent: court(12, 2, 11),
        suite: court(12, 3, 11).optional(),
        texte: texte(48, 20),
      })
      .strict(),
    exemple: {
      type: "C01",
      alt: "Couverture : par où commencer avec l’IA ? Quatre outils en orbite autour d’une sphère orange.",
      rubrique: "IA pour les entreprises",
      titre: "Par où",
      accent: "commencer",
      suite: "avec l’IA ?",
      texte: "Les outils se multiplient. Votre temps, non.",
    },
    bordsLibres: { gauche: [[0, 190], [800, 1350]], droite: [[0, 290], [380, 740]] },
    actif: true,
  },
  {
    type: "C02",
    nom: "Question sur fond sombre",
    famille: "couverture",
    role: "couverture",
    sombre: true,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C02"),
        alt: alt(),
        rubrique: rubrique(),
        titre: court(20, 8, 9),
        texte: texte(80, 13),
      })
      .strict(),
    exemple: {
      type: "C02",
      alt: "Couverture sombre : perdus face à l’IA ? Un grand point d’interrogation orange et trois tuiles.",
      rubrique: "Le constat",
      titre: "Perdus face à l’IA ?",
      texte: "La plupart des entreprises ne savent pas par où commencer. Vous n’êtes pas seul.",
    },
    bordsLibres: { gauche: [[0, 190], [1110, 1350]], droite: [[0, 130], [860, 1350]] },
    actif: true,
  },
  {
    type: "C03",
    nom: "Sommaire illustré",
    famille: "couverture",
    role: "couverture",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C03"),
        alt: alt(),
        rubrique: rubrique(),
        titre: court(26, 5, 14),
        accent: court(20, 3, 14),
        entrees: trois(texte(30, 20)),
      })
      .strict(),
    exemple: {
      type: "C03",
      alt: "Couverture : trois questions pour savoir par où commencer, présentées en sommaire illustré.",
      rubrique: "Pour démarrer",
      titre: "3 questions pour savoir",
      accent: "par où commencer",
      entrees: ["La tâche qui vous pèse", "Qui s’en occupe", "Comment mesurer"],
    },
    bordsLibres: { gauche: [[0, 190], [1210, 1350]], droite: [[0, 550], [1210, 1350]] },
    actif: true,
  },
  {
    type: "C04",
    nom: "Cartes en éventail",
    famille: "couverture",
    role: "couverture",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C04"),
        alt: alt(),
        rubrique: rubrique(),
        titre: court(8, 3, 8),
        accent: court(8, 2, 8),
        suite: court(12, 3, 7).optional(),
        texte: texte(40, 20),
        cartes: trois(texte(8, 8)),
      })
      .strict(),
    exemple: {
      type: "C04",
      alt: "Couverture : un seul cas, bien choisi. Trois cartes en éventail.",
      rubrique: "Une idée reçue",
      titre: "Un seul",
      accent: "cas,",
      suite: "bien choisi.",
      texte: "Pas dix projets d’un coup.",
      cartes: ["Un cas", "Validé", "Le bon"],
    },
    bordsLibres: { gauche: [[0, 190], [1290, 1350]], droite: [[0, 610], [1270, 1350]] },
    actif: true,
  },
  {
    type: "C05",
    nom: "Fenêtre d'application",
    famille: "couverture",
    role: "couverture",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C05"),
        alt: alt(),
        rubrique: rubrique(),
        titre: court(28, 6, 12),
        accent: court(12, 3, 12),
        suite: court(2, 1, 2).optional(),
        etats: deux(texte(18, 14)),
        lignes: deux(z.object({ sujet: texte(18, 14), detail: texte(14, 14) }).strict()),
        badge: texte(16, 14),
      })
      .strict(),
    exemple: {
      type: "C05",
      alt: "Couverture : et si la relance se faisait toute seule ? Une fenêtre d’application montre deux relances prêtes.",
      rubrique: "Automatiser",
      titre: "Et si la relance se faisait",
      accent: "toute seule",
      suite: "?",
      etats: ["2 relances prêtes", "À jour"],
      lignes: [
        { sujet: "Devis Martin", detail: "relance prête" },
        { sujet: "Réunion du lundi", detail: "compte rendu" },
      ],
      badge: "Relance envoyée",
    },
    bordsLibres: { gauche: [[0, 190], [1190, 1350]], droite: [[0, 550], [1190, 1350]] },
    actif: true,
  },
  {
    type: "C06",
    nom: "Manifeste et plaques",
    famille: "couverture",
    role: "couverture",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C06"),
        alt: alt(),
        /** Rubrique libre (la maquette y met « Axion-IA »). */
        rubrique: rubrique(),
        titre: court(30, 6, 16),
        accent: court(20, 3, 16),
      })
      .strict(),
    exemple: {
      type: "C06",
      alt: "Couverture : pas de jargon, on vous dit par où commencer. Trois plaques empilées en perspective.",
      rubrique: "Axion-IA",
      titre: "Pas de jargon. On vous dit",
      accent: "par où commencer.",
    },
    bordsLibres: { gauche: [[0, 190], [620, 890], [1070, 1350]], droite: [[0, 980]] },
    actif: true,
  },
  {
    type: "C07",
    nom: "Téléphone",
    famille: "couverture",
    role: "couverture",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("C07"),
        alt: alt(),
        rubrique: rubrique(),
        titre: court(16, 4, 8),
        accent: court(18, 4, 8),
        texte: texte(56, 18),
        notifications: z.array(z.object({ titre: texte(16, 10), detail: texte(22, 11) }).strict()).length(4),
      })
      .strict(),
    exemple: {
      type: "C07",
      alt: "Couverture : votre journée, sans les relances. Un téléphone affiche quatre notifications.",
      rubrique: "Au quotidien",
      titre: "Votre journée,",
      accent: "sans les relances",
      texte: "Tout ce qui revient chaque semaine, préparé pour vous.",
      notifications: [
        { titre: "Devis Martin", detail: "Relance prête à partir" },
        { titre: "Jeudi 10 h", detail: "Rendez-vous confirmé" },
        { titre: "Compte rendu", detail: "Prêt à relire" },
        { titre: "Tout est à jour", detail: "Rien à signaler" },
      ],
    },
    bordsLibres: { gauche: [[0, 190], [1170, 1350]], droite: [[0, 300], [1160, 1350]] },
    actif: true,
  },
];
