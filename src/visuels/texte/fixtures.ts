import type { CarrouselSpecType } from "../../domaine/visuels/types";

/**
 * Carrousels INVENTÉS du fournisseur de simulation : thèmes du studio puis thèmes neutres de bureau et d'atelier, aucun chiffre, aucun nom
 * réel, aucune marque, aucun domaine. Budgets de `registre-pages.ts` respectés. Une phrase de « pourquoi » par page.
 */
export interface FixtureCarrousel {
  id: string;
  pourquoi: string[];
  spec: CarrouselSpecType;
}

/**
 * Modèles sur le thème du studio (formation à l'IA pour les entreprises) : structure frein / idée reçue / questions / cas concret /
 * ce qu'on fait. Aucun chiffre ni mot-nombre, aucune promesse de résultat, aucun nom de client, aucun lieu précis. La simulation
 * ne choisit que parmi ces modèles.
 */
export const FIXTURES_AXION: readonly FixtureCarrousel[] = [
  {
    id: "axion-freins-au-demarrage",
    pourquoi: [
      "La couverture pose le sujet : se lancer sans fausse route.",
      "La liste nomme les freins que l'on entend souvent.",
      "Idée reçue contre réalité : le blocage se défait simplement.",
      "Les cartes disent ce que le studio fait, étape par étape.",
      "Le schéma montre le circuit d'une demande une fois l'outil en place.",
      "Le message clé rassure : un cas simple suffit pour commencer.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur les freins au démarrage de l'IA en entreprise, avec idée reçue, réalité et démarche",
      pages: [
        { type: "T01", titre: "Se lancer dans l'IA sans fausse route", sousTitre: "Ce qui freine, et ce qu'il en est vraiment" },
        {
          type: "T06",
          titre: "Ce qui freine souvent",
          points: [
            { texte: "On pense que c'est réservé aux grandes entreprises" },
            { texte: "On ne sait pas par où commencer" },
            { texte: "On redoute de tout changer d'un coup" },
            { texte: "On manque de temps pour s'y former" },
          ],
        },
        { type: "T22", titre: "Idée reçue, réalité", mythe: "L'IA, c'est trop technique pour nous.", realite: "Des outils simples, expliqués pas à pas, sur vos propres tâches." },
        {
          type: "T02",
          titre: "Ce qu'on fait pour vous",
          cartes: [
            { titre: "Un état des lieux", corps: "On regarde vos tâches du quotidien.", mini: "W01" },
            { titre: "Un choix adapté", corps: "On retient ce qui sert vraiment.", mini: "W02" },
            { titre: "Une mise en place", corps: "Les outils s'installent chez vous.", mini: "W03" },
            { titre: "Une formation", corps: "Vos équipes apprennent sur leurs cas.", mini: "W06" },
          ],
        },
        {
          type: "T28",
          titre: "Le trajet d'une demande",
          noeuds: [
            { texte: "La demande arrive", icone: "courrier" },
            { texte: "Elle est triée", icone: "dossier" },
            { texte: "Un brouillon est prêt", icone: "crayon" },
            { texte: "Vous validez", icone: "coche-cercle" },
          ],
        },
        { type: "T10", message: "Un cas simple suffit pour commencer", legende: "On avance à votre rythme", deco: "E01" },
        { type: "T21" },
      ],
    },
  },
  {
    id: "axion-avant-de-commencer",
    pourquoi: [
      "La couverture annonce les bonnes questions à se poser.",
      "Les questions utiles avant de choisir un outil, chacune avec une piste de réponse.",
      "Avant et après : partir du besoin plutôt que de l'outil.",
      "La checklist aide chacun à situer son équipe.",
      "Les étapes déroulent la méthode du studio du début à la fin.",
      "Le message clé retient le besoin d'abord, l'outil ensuite.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur les questions à se poser avant de se former à l'IA, puis la méthode du studio",
      pages: [
        { type: "T01B", titre: "Les bonnes questions avant de commencer", sousTitre: "Pour avancer sans vous disperser", deco: "E03" },
        {
          type: "T23",
          titre: "Les questions à se poser",
          questions: [
            { question: "Quelle tâche vous prend du temps ?", aide: "Celle qui revient sans rien apporter.", icone: "horloge" },
            { question: "Qui aurait envie d'essayer ?", aide: "Une personne curieuse suffit.", icone: "utilisateurs" },
            { question: "Quelles données restent chez vous ?", aide: "Celles qui ne sortent jamais.", icone: "cadenas" },
          ],
          annotation: "Le besoin d'abord, l'outil ensuite.",
        },
        { type: "T08", titre: "Le bon réflexe", avant: "On achète un outil, puis on cherche son usage.", apres: "On cherche l'usage, puis on choisit l'outil." },
        {
          type: "T27",
          titre: "Votre équipe est-elle prête ?",
          lignes: [
            { texte: "Une même tâche revient souvent dans la semaine" },
            { texte: "Les informations sont dispersées entre plusieurs outils" },
            { texte: "Quelqu'un dans l'équipe a envie d'essayer" },
            { texte: "Vous savez dire ce qui vous fait perdre du temps" },
          ],
        },
        {
          type: "T20",
          titre: "Comment on avance",
          etapes: [
            { titre: "On audite", corps: "On regarde vos usages actuels." },
            { titre: "On choisit", corps: "On retient les bons outils." },
            { titre: "On installe", corps: "On met en place chez vous." },
            { titre: "On forme", corps: "Vos équipes apprennent en pratique." },
            { titre: "On suit", corps: "On répond à vos questions ensuite." },
          ],
        },
        { type: "T10", message: "Le besoin d'abord, l'outil ensuite", legende: "Le studio forme les équipes sur place", deco: "E04" },
        { type: "T21" },
      ],
    },
  },
  {
    id: "axion-cas-concret",
    pourquoi: [
      "La couverture annonce un cas concret, raconté simplement.",
      "Le scénario type montre un usage du quotidien rendu plus fluide.",
      "Les étapes montrent comment le studio intervient.",
      "Les cartes rappellent les principes qui guident la démarche.",
      "Sans et avec : la différence au quotidien, point par point.",
      "Le message clé encourage à commencer petit.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel présentant un cas concret simple d'accompagnement à l'IA dans une petite équipe",
      pages: [
        { type: "T01C", titre: "Un cas concret, pas à pas", sousTitre: "Comment une petite équipe se lance", deco: "E05" },
        {
          type: "T26",
          titre: "Une petite équipe d'accueil",
          avant: ["Des demandes un peu partout", "Les mêmes réponses tapées à la main"],
          avec: ["Une seule file, triée par sujet", "Des brouillons de réponse prêts"],
          outils: ["Boîte partagée", "Assistant"],
          vous: "des réponses plus rapides, relues par vous",
        },
        {
          type: "T20",
          titre: "Le déroulé du cas",
          etapes: [
            { titre: "On observe", corps: "On regarde comment l'équipe traite ces demandes aujourd'hui." },
            { titre: "On installe", corps: "L'outil est mis en place chez vous, avec vos règles." },
            { titre: "On forme", corps: "L'équipe apprend à s'en servir sur ses propres demandes." },
          ],
        },
        {
          type: "T02",
          titre: "Ce qui compte",
          cartes: [
            { titre: "Rester simple", corps: "Un seul sujet à la fois, pour apprendre sans pression.", mini: "W01" },
            { titre: "Garder la main", corps: "Chaque réponse est relue par une personne.", mini: "W02" },
            { titre: "Former les équipes", corps: "Vos équipes comprennent ce qu'elles utilisent.", mini: "W03" },
          ],
        },
        {
          type: "T24",
          titre: "La différence au quotidien",
          lignes: [
            { sans: "Demandes éparpillées", avec: "Une seule file" },
            { sans: "Réponses à la main", avec: "Brouillons prêts" },
            { sans: "Relances oubliées", avec: "Rappel au bon moment" },
          ],
        },
        { type: "T10", message: "Un usage bien choisi suffit pour démarrer", legende: "Un seul usage, bien choisi", deco: "E02" },
        { type: "T21" },
      ],
    },
  },
];

/** Anciens modèles neutres (bureau, atelier, pause de midi) : conservés pour les tests, plus choisis par la simulation. */
export const FIXTURES_NEUTRES: readonly FixtureCarrousel[] = [
  {
    id: "bureau-qui-respire",
    pourquoi: [
      "La couverture annonce le thème en une phrase simple.",
      "Des cartes posent le décor : chaque geste a sa place.",
      "Une courte liste donne les réflexes à garder.",
      "L'avant et l'après rendent le changement visible.",
      "Des étapes montrent comment s'y prendre sans effort.",
      "Un message clé résume l'idée à retenir.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur l'art de garder un bureau dégagé, de la couverture à l'invitation finale",
      pages: [
        { type: "T01", titre: "Un bureau qui respire", sousTitre: "Des gestes simples, un plateau dégagé" },
        {
          type: "T02",
          titre: "Les gestes simples du matin",
          cartes: [
            { titre: "Dégager le plateau", corps: "Seul l'utile reste en vue.", mini: "W01" },
            { titre: "Relire la liste", corps: "On sait par où commencer.", mini: "W02" },
            { titre: "Ouvrir la fenêtre", corps: "Un peu d'air avant le travail.", mini: "W03" },
            { titre: "Poser la tâche lourde", corps: "Elle passe en tête de file.", mini: "W06" },
          ],
        },
        {
          type: "T06",
          titre: "Les bons réflexes",
          points: [{ texte: "Vider le plateau chaque soir" }, { texte: "Trier le courrier dès son arrivée" }, { texte: "Garder un seul carnet ouvert" }, { texte: "Essuyer la surface en partant" }],
        },
        { type: "T08", titre: "Avant et après", avant: "Des papiers partout, la tâche introuvable.", apres: "Un plateau net, la tâche sous la main." },
        {
          type: "T20",
          titre: "Comment bien s'y prendre",
          etapes: [
            { titre: "Tout sortir", corps: "On pose les piles sur la table." },
            { titre: "Trier", corps: "Garder, classer ou jeter." },
            { titre: "Ranger", corps: "Chaque chose retrouve sa place." },
            { titre: "Entretenir", corps: "Un coup de chiffon suffit." },
          ],
        },
        { type: "T10", message: "Un bureau net, un esprit libre", legende: "Le calme commence sur la table", deco: "E01" },
        { type: "T21" },
      ],
    },
  },
  {
    id: "atelier-bien-tenu",
    pourquoi: [
      "La couverture pose le thème de l'atelier avec un bloc de couleur.",
      "Des cartes courtes passent en revue les outils du quotidien.",
      "Des étapes enchaînées expliquent l'entretien d'un outil.",
      "L'avant et l'après montrent l'effet d'un établi rangé.",
      "Une liste de points fixe les habitudes utiles.",
      "Un message clé ferme la partie pratique.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur l'entretien d'un atelier et de ses outils, avec cartes, étapes et conclusion",
      pages: [
        { type: "T01B", titre: "Un atelier bien tenu", sousTitre: "Les outils durent quand on les soigne", deco: "E03" },
        {
          type: "T02",
          titre: "Les outils du quotidien",
          cartes: [
            { titre: "Le marteau", corps: "Le manche reste sec.", mini: "W01" },
            { titre: "La scie", corps: "La lame reste propre.", mini: "W02" },
            { titre: "Le tournevis", corps: "La pointe reste nette.", mini: "W03" },
            { titre: "Le mètre", corps: "Il se range enroulé.", mini: "W06" },
          ],
        },
        {
          type: "T20",
          titre: "Entretenir un outil",
          etapes: [
            { titre: "Nettoyer", corps: "Retirer la poussière et les copeaux." },
            { titre: "Contrôler", corps: "Chercher un jeu ou une fissure." },
            { titre: "Huiler", corps: "Une goutte sur les parties mobiles." },
          ],
        },
        { type: "T08", titre: "L'établi", avant: "Les outils traînent, on cherche d'abord.", apres: "Chaque outil a son crochet, geste immédiat." },
        {
          type: "T06",
          titre: "Les habitudes utiles",
          points: [{ texte: "Ranger chaque outil après usage" }, { texte: "Balayer avant de partir" }, { texte: "Noter ce qui manque" }, { texte: "Aérer le local" }],
        },
        { type: "T10", message: "Un outil soigné travaille mieux", legende: "Le soin se voit au résultat", deco: "E04" },
        { type: "T21" },
      ],
    },
  },
  {
    id: "rendez-vous-sans-stress",
    pourquoi: [
      "La couverture annonce un sujet familier, traité avec calme.",
      "Une courte liste rassemble les réflexes de préparation.",
      "Des cartes détaillent ce qui compte pendant l'échange.",
      "L'avant et l'après opposent l'improvisation à la préparation.",
      "Des étapes déroulent le rendez-vous du début à la fin.",
      "Un message clé rappelle l'esprit général.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur la préparation d'un rendez-vous de bureau, avec liste, cartes et étapes",
      pages: [
        { type: "T01C", titre: "Des rendez-vous sans stress", sousTitre: "Préparer, écouter, conclure", deco: "E02" },
        {
          type: "T06",
          titre: "Avant de bien commencer",
          points: [{ texte: "Relire les notes de la dernière fois" }, { texte: "Préparer la salle et l'eau" }, { texte: "Fixer une heure de fin" }],
        },
        {
          type: "T02",
          titre: "Pendant l'échange",
          cartes: [
            { titre: "Écouter d'abord", corps: "Laisser finir chaque phrase avant de répondre.", mini: "W01" },
            { titre: "Reformuler", corps: "Dire avec ses mots ce qui vient d'être compris.", mini: "W03" },
            { titre: "Noter l'essentiel", corps: "Une ligne par décision, rien de plus.", mini: "W02" },
          ],
        },
        { type: "T08", titre: "La préparation", avant: "On arrive les mains vides et on improvise.", apres: "On arrive avec une idée claire et un carnet." },
        {
          type: "T20",
          titre: "Le déroulé idéal",
          etapes: [
            { titre: "Accueillir", corps: "Un mot aimable." },
            { titre: "Cadrer", corps: "Rappeler le but." },
            { titre: "Échanger", corps: "Chacun parle à son tour." },
            { titre: "Conclure", corps: "Un prochain pas clair." },
            { titre: "Remercier", corps: "Le message part le soir." },
          ],
        },
        { type: "T10", message: "Bien écouter, c'est déjà bien répondre", legende: "Écouter d'abord fait gagner du temps", deco: "E05" },
        { type: "T21" },
      ],
    },
  },
  {
    id: "message-clair",
    pourquoi: [
      "La couverture pose le sujet de l'écrit, sans détour.",
      "Des étapes montrent comment construire un message net.",
      "De grandes cartes comparent des manières d'ouvrir un échange.",
      "Un message clé fixe la règle de base.",
      "L'avant et l'après illustrent une phrase alourdie, puis allégée.",
      "Une liste récapitule les points de relecture.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur l'écriture d'un message de bureau clair, avec étapes, comparaison et relecture",
      pages: [
        { type: "T01", titre: "Écrire un message clair", sousTitre: "Une idée par phrase, un objet net" },
        {
          type: "T20",
          titre: "Construire un message net",
          etapes: [
            { titre: "Choisir l'objet", corps: "Quelques mots qui disent tout." },
            { titre: "Dire l'essentiel", corps: "La demande vient dès l'ouverture." },
            { titre: "Donner le détail", corps: "Une ligne pour chaque information utile." },
            { titre: "Relire", corps: "Retirer ce qui ne sert pas." },
          ],
        },
        {
          type: "T02",
          titre: "Ouvrir un échange",
          cartes: [
            { titre: "Le long détour", corps: "On commence par tout ce qui s'est passé avant, et la demande arrive trop tard pour être lue.", mini: "W03" },
            { titre: "L'entrée directe", corps: "On pose la demande tout de suite, puis on explique ce qui aide à y répondre.", mini: "W02" },
          ],
        },
        { type: "T10", message: "Dire d'abord ce qu'on attend", legende: "Le reste vient ensuite" },
        { type: "T08", titre: "Une phrase allégée", avant: "Je me permets de revenir vers vous, si possible.", apres: "Pouvez-vous me répondre avant demain soir ?" },
        {
          type: "T06",
          titre: "La relecture",
          points: [{ texte: "L'objet dit-il l'essentiel ?" }, { texte: "La demande apparaît-elle dès l'ouverture ?" }, { texte: "Chaque phrase porte-t-elle une seule idée ?" }, { texte: "La formulation reste-t-elle posée ?" }],
        },
        { type: "T21" },
      ],
    },
  },
  {
    id: "dossiers-qui-dorment",
    pourquoi: [
      "La couverture évoque un problème que chacun reconnaît.",
      "Une liste donne les constats de départ, sans jugement.",
      "L'avant et l'après montrent le résultat d'un bon classement.",
      "Des cartes détaillent les gestes de tri.",
      "Un message clé rassure sur la démarche.",
      "Des étapes décrivent l'archivage pas à pas.",
      "Des cartes courtes aident à retrouver ce qu'on cherche.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur le tri et l'archivage de dossiers de bureau, avec liste, cartes et étapes",
      pages: [
        { type: "T01B", titre: "Les dossiers qui dorment", sousTitre: "Les réveiller sans y passer la nuit", deco: "E09" },
        {
          type: "T06",
          titre: "Les constats",
          points: [{ texte: "Les piles montent sans qu'on s'en aperçoive" }, { texte: "Les noms de fichiers ne disent plus rien" }, { texte: "On garde tout par peur de manquer" }],
        },
        { type: "T08", titre: "Le classement", avant: "Des dossiers sans nom, empilés dans un tiroir.", apres: "Des dossiers nommés, rangés, faciles à retrouver." },
        {
          type: "T02",
          titre: "Les gestes de tri",
          cartes: [
            { titre: "Regrouper", corps: "Rassembler ce qui parle du même sujet.", mini: "W01" },
            { titre: "Nommer", corps: "Un titre court, lisible, sans abréviation.", mini: "W03" },
            { titre: "Dater", corps: "Une mention simple de la dernière mise à jour.", mini: "W02" },
            { titre: "Écarter", corps: "Mettre de côté ce qui ne sert plus.", mini: "W06" },
          ],
        },
        { type: "T10", message: "Trier, c'est se donner de l'air", legende: "Un geste à la fois", deco: "E13" },
        {
          type: "T20",
          titre: "Archiver pas à pas",
          etapes: [
            { titre: "Relire", corps: "Un regard frais sur chaque dossier." },
            { titre: "Décider", corps: "Garder, transmettre ou détruire." },
            { titre: "Ranger", corps: "Un lieu clair pour les clos." },
          ],
        },
        {
          type: "T02",
          titre: "Retrouver vite",
          cartes: [
            { titre: "Une étiquette", corps: "Lisible de loin.", mini: "W01" },
            { titre: "Un index", corps: "Une page qui liste tout.", mini: "W03" },
            { titre: "Un code couleur", corps: "Un thème, une teinte.", mini: "W25" },
            { titre: "Un rangement fixe", corps: "Toujours au même endroit.", mini: "W02" },
          ],
        },
        { type: "T21" },
      ],
    },
  },
];

export const FIXTURES: readonly FixtureCarrousel[] = [...FIXTURES_AXION, ...FIXTURES_NEUTRES];
