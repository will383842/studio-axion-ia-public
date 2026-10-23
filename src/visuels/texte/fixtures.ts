import type { CarrouselSpecType } from "../../domaine/visuels/types";

/**
 * Carrousels INVENTÉS du fournisseur de simulation : thèmes neutres de bureau et d'atelier, aucun chiffre, aucun nom
 * réel, aucune marque, aucun domaine. Budgets de `registre-pages.ts` respectés. Une phrase de « pourquoi » par page.
 */
export interface FixtureCarrousel {
  id: string;
  pourquoi: string[];
  spec: CarrouselSpecType;
}

export const FIXTURES: readonly FixtureCarrousel[] = [
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
        { type: "T08", titre: "Avant et après", avant: "Des papiers partout, la tâche du jour introuvable.", apres: "Un plateau net, la tâche du jour sous la main." },
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
            { titre: "Le niveau", corps: "Il craint les chocs.", mini: "W07" },
            { titre: "L'étau", corps: "Il se graisse parfois.", mini: "W25" },
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
        { type: "T08", titre: "L'établi", avant: "Les outils traînent, on cherche avant de commencer.", apres: "Chaque outil a son crochet, le geste est immédiat." },
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
        { type: "T08", titre: "La préparation", avant: "On arrive les mains vides et on improvise.", apres: "On arrive avec une idée claire et un carnet ouvert." },
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
        { type: "T08", titre: "Une phrase allégée", avant: "Je me permets de revenir vers vous afin de savoir si éventuellement vous pourriez me répondre.", apres: "Pouvez-vous me répondre avant demain soir ?" },
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
        { type: "T08", titre: "Le classement", avant: "Des dossiers sans nom, empilés au fond d'un tiroir.", apres: "Des dossiers nommés, rangés par thème, faciles à retrouver." },
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
            { titre: "Une revue", corps: "Un coup d'œil de temps en temps.", mini: "W07" },
            { titre: "Un voisin", corps: "Les liés restent proches.", mini: "W06" },
          ],
        },
        { type: "T21" },
      ],
    },
  },
];
