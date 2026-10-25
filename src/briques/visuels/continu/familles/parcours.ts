import { z } from "zod";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
import type { DefinitionGabarit } from "../registre-gabarits";
import type { DefinitionParcours } from "../registre-parcours";

/**
 * Les huit parcours continus de la maquette v3 (`PANOS`) : un calque dessiné d'un seul tenant sur toute la largeur du parcours
 * (`studio-rendu/compositions/visuels/continu/parcours/`) et une page-gabarit par page, qui porte les seuls textes posés dans CETTE page.
 * Les numéros d'étape, « Avant » / « Avec nous » et l'étiquette « Scénario type » sont posés par le code : ce ne sont pas des champs.
 */

/** Champ texte : [nom, budget en caractères, facultatif]. */
type Champ = [nom: string, max: number, facultatif?: true];
type Bord = [number, number][];
const PLEIN: Bord = [[0, 1440]];

interface SpecPage {
  champs: Champ[];
  exemple: Record<string, string>;
  alt: string;
  orangeFort?: boolean;
  cas?: boolean;
  gauche?: Bord;
  droite?: Bord;
}

function pageDe(parcours: string, rang: number, nomParcours: string, sombre: boolean, spec: SpecPage): DefinitionGabarit {
  const type = `${parcours}${rang}`;
  const forme: Record<string, z.ZodType> = { type: z.literal(type), alt: texteSansLien(1, 125), rubrique: texteSansLien(1, RUBRIQUE_MAX).optional() };
  for (const [nom, max, facultatif] of spec.champs) forme[nom] = facultatif ? texteSansLien(1, max).optional() : texteSansLien(1, max);
  return {
    type,
    famille: "parcours",
    nom: `${nomParcours}, page ${rang}`,
    role: "contenu",
    sombre,
    orangeFort: !!spec.orangeFort,
    version: 1,
    schema: z.object(forme).strict(),
    exemple: { type, alt: spec.alt, ...spec.exemple },
    bordsLibres: { gauche: spec.gauche ?? PLEIN, droite: spec.droite ?? PLEIN },
    ...(spec.cas ? { cas: true } : {}),
    actif: true,
  };
}

interface SpecParcours {
  id: string;
  nom: string;
  commence: boolean;
  termine: boolean;
  /** Positions (0 = première page) en fond sombre. */
  sombres: number[];
  pages: SpecPage[];
}

const PARCOURS_SPECS: SpecParcours[] = [
  {
    id: "PA",
    nom: "Le chemin",
    commence: true,
    termine: true,
    sombres: [3],
    pages: [
      {
        champs: [["titre", 12], ["accent", 11], ["suite", 2, true], ["texte", 70], ["pastille", 16]],
        exemple: { rubrique: "IA pour les entreprises", titre: "Par où", accent: "commencer", suite: "?", texte: "Les outils se multiplient. Votre temps, non.", pastille: "On vous guide" },
        alt: "Une route orange part de la question « Par où commencer ? », avec la pastille « On vous guide » à cheval sur deux pages.",
        gauche: [[0, 950], [1220, 1440]],
      },
      { champs: [["etape", 16], ["detail", 60]], exemple: { etape: "On audite", detail: "On repère où le temps se perd." }, alt: "Première étape de la route : on audite, on repère où le temps se perd." },
      { champs: [["etape", 16], ["detail", 60]], exemple: { etape: "On choisit", detail: "Un premier cas simple, avec vous." }, alt: "Deuxième étape de la route : on choisit un premier cas simple, avec vous." },
      {
        champs: [["etape", 16], ["detail", 40], ["titre", 14], ["accent", 8], ["appel", 80]],
        exemple: { etape: "On installe", detail: "Chez vous, à votre façon.", titre: "Nous, on vous", accent: "le dit.", appel: "Racontez-nous votre situation. On répond avec une première piste." },
        alt: "Dernière étape de la route : on installe chez vous. Invitation à raconter votre situation pour recevoir une première piste.",
        droite: [[0, 715], [1210, 1440]],
      },
    ],
  },
  {
    id: "PB",
    nom: "Avant / avec nous",
    commence: true,
    termine: false,
    sombres: [],
    pages: [
      {
        champs: [["titre", 14], ["accent", 14], ["texte", 70], ["avant", 18], ["avec", 18]],
        exemple: { rubrique: "Cas concret", titre: "Les devis", accent: "sans réponse", texte: "Un devis part, le quotidien reprend, la relance attend.", avant: "Devis envoyé", avec: "Relance prête" },
        alt: "Deux voies parallèles : avant, un devis envoyé ; avec nous, une relance prête. Exemple illustratif.",
        cas: true,
        gauche: [[0, 165], [1085, 1440]],
      },
      {
        champs: [["avant", 18], ["avec", 18], ["aparte", 40]],
        exemple: { avant: "Oublié", avec: "Réponse reçue", aparte: "pendant ce temps, la relance attend…" },
        alt: "Sur la voie d'avant, le devis est oublié ; sur la voie avec nous, la réponse est reçue.",
      },
      {
        champs: [["avant1", 22], ["avant2", 18], ["titre", 14], ["accent", 12], ["suite", 2, true], ["texte", 50], ["note", 30]],
        exemple: { avant1: "Relance au hasard", avant2: "Réponse ?", titre: "Chaque devis", accent: "est suivi", suite: ".", texte: "Sans y penser, sans oublier.", note: "le temps que vous gardez" },
        alt: "La voie d'avant se perd en relances au hasard ; avec nous, chaque devis est suivi, sans y penser et sans oublier.",
      },
    ],
  },
  {
    id: "PC",
    nom: "Le grand mot",
    commence: true,
    termine: false,
    sombres: [],
    pages: [
      {
        champs: [["mot", 3], ["aparte", 34]],
        exemple: { rubrique: "Une idée reçue", mot: "Un", aparte: "pas dix projets d’un coup." },
        alt: "Premier mot d'une promesse en trois mots : « Un », sur une règle graduée, avec une sphère orange.",
        gauche: [[0, 465], [855, 1000], [1160, 1440]],
      },
      { champs: [["mot", 4], ["texte", 56]], exemple: { mot: "seul", texte: "Choisissez ce qui revient chaque semaine et vous pèse." }, alt: "Deuxième mot de la promesse : « seul ». Choisissez ce qui revient chaque semaine et vous pèse." },
      {
        champs: [["mot", 4], ["texte", 64]],
        exemple: { mot: "cas.", texte: "Un premier cas simple suffit pour démarrer. Ensuite, on étend." },
        alt: "Dernier mot de la promesse : « cas. ». Un premier cas simple suffit pour démarrer, ensuite on étend.",
        droite: [[0, 990], [1105, 1440]],
      },
    ],
  },
  {
    id: "PD",
    nom: "L’objet à cheval",
    commence: true,
    termine: false,
    sombres: [],
    pages: [
      {
        champs: [["titre", 14], ["accent", 14], ["suite", 24, true], ["texte", 70]],
        exemple: { rubrique: "Pour démarrer", titre: "3 questions", accent: "pour savoir", suite: "par où commencer", texte: "Trois questions simples, une page chacune. Notez vos réponses." },
        alt: "Trois questions pour savoir par où commencer, avec une loupe posée à cheval sur la page suivante.",
        gauche: [[0, 195], [525, 995], [1190, 1440]],
      },
      {
        champs: [["question1", 28], ["reponse1", 44], ["question2", 24], ["reponse2", 30]],
        exemple: { question1: "Quelle tâche vous pèse ?", reponse1: "Celle qui revient chaque semaine.", question2: "Qui s’en occupe ?", reponse2: "Avec quels outils ?" },
        alt: "Deux questions : quelle tâche vous pèse, celle qui revient chaque semaine ; qui s'en occupe, avec quels outils.",
      },
      {
        champs: [["question", 40], ["aparte", 50]],
        exemple: { question: "Comment saurez-vous que ça marche ?", aparte: "pas sûr des réponses ? on les trouve avec vous." },
        alt: "Troisième question : comment saurez-vous que ça marche ? Pas sûr des réponses, on les trouve avec vous.",
        orangeFort: true,
      },
    ],
  },
  {
    id: "PE",
    nom: "Bento continu",
    commence: true,
    termine: true,
    sombres: [],
    pages: [
      {
        champs: [["titre", 14], ["accent", 10], ["tuile", 34]],
        exemple: { rubrique: "Au quotidien", titre: "Ce que ça", accent: "change", tuile: "Moins de relances oubliées" },
        alt: "Une grille de tuiles illustrées commence : ce que ça change, avec moins de relances oubliées.",
        orangeFort: true,
        gauche: [[0, 195], [1250, 1440]],
      },
      {
        champs: [["doc", 26], ["docSous", 24], ["temps", 10], ["validez", 14], ["vue", 34], ["vueSous", 50], ["aparte", 46]],
        exemple: { doc: "Des comptes rendus clairs", docSous: "Après chaque réunion.", temps: "Du temps", validez: "Vous validez", vue: "Une vue claire de l’activité", vueSous: "Où en sont les dossiers, d’un coup d’oeil.", aparte: "ce que vous gagnez, pas ce qu’on installe." },
        alt: "Tuiles : des comptes rendus clairs, du temps, vous validez, et une vue claire de l'activité.",
      },
      {
        champs: [["equipe", 18], ["outils", 14], ["aparte", 30]],
        exemple: { equipe: "L’équipe suit", outils: "Vos outils", aparte: "sans changer vos habitudes." },
        alt: "Tuiles : l'équipe suit, vos outils, sans changer vos habitudes.",
      },
      {
        champs: [["titre", 22], ["accent", 26], ["bouton", 28]],
        exemple: { titre: "On regarde ensemble", accent: "lequel vous concerne.", bouton: "Écrire en message privé" },
        alt: "Tuile sombre pour conclure : on regarde ensemble lequel vous concerne, avec le bouton pour écrire en message privé.",
      },
    ],
  },
  {
    id: "PF",
    nom: "La courbe",
    commence: true,
    termine: false,
    sombres: [],
    pages: [
      {
        champs: [["titre", 14], ["accent", 14], ["suite", 22, true], ["texte", 60], ["depart", 14]],
        exemple: { rubrique: "Schéma illustratif", titre: "Ça démarre", accent: "doucement", suite: ", puis ça accélère.", texte: "Un premier cas, puis deux, puis toute l’équipe.", depart: "au départ" },
        alt: "Schéma illustratif : une courbe démarre doucement puis accélère, du premier cas jusqu'à toute l'équipe.",
        gauche: [[0, 195], [525, 815], [920, 1120], [1185, 1440]],
      },
      { champs: [["jalon", 16]], exemple: { jalon: "Un premier cas" }, alt: "Premier jalon de la courbe : un premier cas." },
      { champs: [["jalon", 16]], exemple: { jalon: "Deux cas" }, alt: "Deuxième jalon de la courbe : deux cas." },
      {
        champs: [["jalon", 22], ["final", 12], ["plusTard", 26]],
        exemple: { jalon: "Toute l’équipe", final: "Ça tourne", plusTard: "quelques mois plus tard" },
        alt: "Derniers jalons de la courbe : toute l'équipe, puis « Ça tourne », quelques mois plus tard.",
        droite: [[0, 1120], [1185, 1440]],
      },
    ],
  },
  {
    id: "PG",
    nom: "L’escalier",
    commence: true,
    termine: false,
    sombres: [],
    pages: [
      {
        champs: [["titre", 14], ["accent", 12], ["etape", 14], ["detail", 60]],
        exemple: { rubrique: "Un pas après l’autre", titre: "On avance", accent: "par étapes", etape: "Écouter", detail: "On comprend votre quotidien." },
        alt: "Un escalier dont chaque marche est une étape : on avance par étapes, première marche, écouter.",
        gauche: [[0, 195], [450, 1000]],
      },
      { champs: [["etape", 14], ["detail", 60]], exemple: { etape: "Choisir", detail: "Un premier cas simple." }, alt: "Deuxième marche : choisir un premier cas simple." },
      { champs: [["etape", 14], ["detail", 60]], exemple: { etape: "Installer", detail: "Chez vous, à votre façon." }, alt: "Troisième marche : installer chez vous, à votre façon." },
      {
        champs: [["etape", 12], ["detail", 30]],
        exemple: { etape: "Suivre", detail: "On ajuste." },
        alt: "Dernière marche, avec un drapeau orange : suivre, on ajuste.",
        droite: [[0, 550]],
      },
    ],
  },
  {
    id: "PH",
    nom: "Le circuit",
    commence: true,
    termine: false,
    sombres: [3],
    pages: [
      {
        champs: [["titre", 24], ["accent", 18], ["etape", 14], ["detail", 34]],
        exemple: { rubrique: "Le circuit", titre: "Chaque demande suit", accent: "le même chemin", etape: "On la reçoit", detail: "Un message, un appel." },
        alt: "Un circuit en quatre nœuds : chaque demande suit le même chemin, premier nœud, on la reçoit.",
        gauche: [[0, 195], [495, 1440]],
      },
      { champs: [["etape", 14], ["detail", 34]], exemple: { etape: "On prépare", detail: "La réponse est rédigée." }, alt: "Deuxième nœud du circuit : on prépare, la réponse est rédigée." },
      { champs: [["etape", 14], ["detail", 34]], exemple: { etape: "Vous relisez", detail: "Vous corrigez si besoin." }, alt: "Troisième nœud du circuit : vous relisez, vous corrigez si besoin." },
      { champs: [["etape", 14], ["detail", 34]], exemple: { etape: "Vous validez", detail: "Rien ne part sans vous." }, alt: "Dernier nœud du circuit, sur fond sombre : vous validez, rien ne part sans vous." },
    ],
  },
];

export const PARCOURS_PAGES: DefinitionGabarit[] = PARCOURS_SPECS.flatMap((p) => p.pages.map((s, i) => pageDe(p.id, i + 1, p.nom, p.sombres.includes(i), s)));

export const PARCOURS_DEFINITIONS: DefinitionParcours[] = PARCOURS_SPECS.map((p) => ({
  id: p.id,
  nom: p.nom,
  pages: p.pages.length as 3 | 4,
  commence: p.commence,
  termine: p.termine,
  pagesTypes: p.pages.map((_, i) => `${p.id}${i + 1}`),
  sombres: p.sombres,
  version: 1,
}));
