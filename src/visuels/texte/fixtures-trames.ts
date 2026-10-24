import type { Intention } from "../../briques/visuels/trames";
import type { FixtureCarrousel } from "./fixtures";

/**
 * Contenu d'essai d'une trame par intention (L12) : exemples types INVENTÉS, sur le thème du studio, pour une TPE ou une PME qui ne sait
 * pas par où commencer avec l'IA. Aucun chiffre ni mot-nombre, aucun nom réel, aucune marque, aucune promesse. Les pages suivent
 * exactement `typesDeLaTrame` (contrôlé par les tests).
 */
export const FIXTURES_TRAMES: Record<Intention, FixtureCarrousel> = {
  eveil: {
    id: "trame-eveil",
    pourquoi: [
      "La couverture nomme le problème : des journées qui filent sans avancer.",
      "La liste pose ce qui coince au quotidien.",
      "Le message clé fait sentir ce que coûte l'attente.",
      "Idée reçue contre réalité : l'IA n'est pas réservée aux grands.",
      "Les questions aident le lecteur à situer son entreprise.",
      "La relance remet le lecteur face à sa propre situation.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur les tâches répétées d'une petite entreprise et le déclic pour commencer avec l'IA",
      pages: [
        { type: "T01", titre: "Vos journées filent, le travail reste", sousTitre: "Ce que les tâches répétées vous prennent sans bruit" },
        {
          type: "T06",
          titre: "Ce qui coince",
          points: [
            { texte: "Les mêmes courriels, réécrits chaque semaine" },
            { texte: "Des devis qui attendent le soir pour partir" },
            { texte: "Des informations ressaisies d'un outil à l'autre" },
            { texte: "Des relances oubliées faute de temps" },
          ],
        },
        { type: "T10", message: "Attendre aussi a un coût", legende: "Du temps perdu, des clients qui patientent", deco: "E01" },
        { type: "T22", titre: "Idée reçue, réalité", mythe: "L'IA, c'est pour les grandes entreprises.", realite: "Une petite équipe peut commencer, sur ses tâches de tous les jours." },
        {
          type: "T23",
          titre: "Avant de vous lancer",
          questions: [
            { question: "Quelle tâche revient sans cesse ?", aide: "Celle que l'on repousse au soir." },
            { question: "Où ressaisit-on la même chose ?", aide: "Entre devis, agenda et tableur." },
            { question: "Quel client attend une réponse ?", aide: "Celui qui relance déjà." },
          ],
          annotation: "Vos réponses tracent le chemin",
        },
        { type: "T29", relance: "Et chez vous, quelle tâche revient ?", rappels: [{ texte: "Les tâches répétées prennent du temps" }, { texte: "Une petite équipe peut commencer" }, { texte: "Vos réponses montrent par où partir" }] },
        { type: "T21" },
      ],
    },
  },
  methode: {
    id: "trame-methode",
    pourquoi: [
      "La couverture fait la promesse : savoir par où commencer.",
      "Le sommaire annonce les parties du chemin.",
      "Le message clé donne le principe de la méthode.",
      "Les étapes déroulent la méthode dans l'ordre.",
      "La checklist aide à vérifier que l'on est prêt.",
      "Idée reçue contre réalité : pas besoin de tout changer d'un coup.",
      "Le schéma montre le circuit d'une demande une fois la méthode en place.",
      "La relance demande au lecteur où il en est.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel de méthode pour démarrer l'IA dans une petite entreprise, étape par étape",
      pages: [
        { type: "T01", titre: "Démarrer l'IA dans votre entreprise", sousTitre: "Une méthode claire, pas à pas, sur vos propres tâches" },
        {
          type: "T02",
          titre: "Au programme",
          cartes: [
            { titre: "Repérer", corps: "Les tâches qui reviennent sans cesse.", mini: "W01" },
            { titre: "Essayer", corps: "Un outil sur une seule tâche.", mini: "W02" },
            { titre: "Installer", corps: "Ce qui a fait ses preuves.", mini: "W03" },
          ],
        },
        { type: "T10", message: "Partir de vos tâches, choisir l'outil ensuite", legende: "La règle qui guide chaque étape", deco: "E02" },
        {
          type: "T20",
          titre: "Les étapes",
          etapes: [
            { titre: "Lister vos tâches", corps: "Notez ce qui revient chaque semaine." },
            { titre: "Choisir une tâche", corps: "La plus pénible, pas la plus rare." },
            { titre: "Tester un outil", corps: "Sur de vrais dossiers de l'équipe." },
            { titre: "Former l'équipe", corps: "Chacun apprend sur ses propres cas." },
          ],
        },
        {
          type: "T27",
          titre: "Êtes-vous prêt ?",
          lignes: [
            { texte: "Vos tâches répétées sont notées" },
            { texte: "Une tâche est choisie pour commencer" },
            { texte: "Une personne suit l'essai" },
            { texte: "L'équipe sait pourquoi on change" },
          ],
        },
        { type: "T22", titre: "Une idée qui freine", mythe: "Il faut tout changer d'un coup pour en profiter.", realite: "Une tâche bien choisie suffit pour commencer, et l'équipe apprend en avançant." },
        {
          type: "T28",
          titre: "Le circuit d'une demande",
          noeuds: [
            { texte: "La demande arrive", icone: "courrier" },
            { texte: "Un brouillon se prépare", icone: "crayon" },
            { texte: "Vous relisez", icone: "loupe" },
            { texte: "La réponse part", icone: "envoyer" },
            { texte: "Le client est servi", icone: "utilisateurs" },
          ],
        },
        { type: "T29", relance: "Par quelle tâche commencez-vous ?", rappels: [{ texte: "Partir de vos tâches" }, { texte: "Essayer sur une seule tâche" }, { texte: "Garder ce qui marche" }] },
        { type: "T21" },
      ],
    },
  },
  preuve: {
    id: "trame-preuve",
    pourquoi: [
      "La couverture pose la question que se pose le lecteur.",
      "Le cas concret raconte un scénario type, inventé et vraisemblable : avant, puis avec nous.",
      "Sans et avec : les points qui changent, face à face.",
      "Le message clé retient ce qui change vraiment.",
      "Le schéma montre le chemin suivi par l'atelier du scénario.",
      "La checklist invite le lecteur à se situer.",
      "La relance ramène le scénario chez le lecteur.",
      "La dernière page invite à écrire en message privé.",
    ],
    spec: {
      version: "carrousel/1",
      alt: "Carrousel sur un scénario type d'atelier qui gagne en sérénité avec l'IA, sans et avec",
      pages: [
        { type: "T01C", titre: "L'IA, utile pour un atelier ?", sousTitre: "Un scénario type, raconté simplement" },
        {
          type: "T26",
          titre: "Un atelier débordé",
          avant: ["Des demandes notées sur des papiers", "Des devis envoyés en retard"],
          avec: ["Demandes rangées au même endroit", "Un brouillon de devis prêt à relire"],
          outils: ["Tableur partagé", "Agenda commun"],
          vous: "Plus de temps pour le travail qui compte",
        },
        {
          type: "T24",
          titre: "Sans et avec",
          lignes: [
            { sans: "Demandes éparses", avec: "Un seul fil" },
            { sans: "Relances oubliées", avec: "Rappel au bon moment" },
            { sans: "Devis du soir", avec: "Brouillon prêt" },
          ],
        },
        { type: "T10", message: "L'outil prépare le travail, vous gardez la main", legende: "Chaque décision reste la vôtre", deco: "E03" },
        {
          type: "T28",
          titre: "Comment l’atelier s’y est pris",
          noeuds: [
            { texte: "Lister les demandes", icone: "liste" },
            { texte: "Choisir une tâche", icone: "cible" },
            { texte: "Tester un outil", icone: "engrenage" },
            { texte: "Garder ce qui marche", icone: "coche-cercle" },
            { texte: "Former l’équipe", icone: "utilisateurs" },
          ],
        },
        {
          type: "T27",
          titre: "Et chez vous ?",
          lignes: [
            { texte: "Des demandes arrivent par plusieurs canaux" },
            { texte: "Des devis partent plus tard que voulu" },
            { texte: "Les mêmes informations sont tapées souvent" },
            { texte: "Des relances passent à la trappe" },
          ],
        },
        { type: "T29", relance: "Et si c'était votre atelier ?", rappels: [{ texte: "Un seul fil pour les demandes" }, { texte: "Un brouillon prêt à relire" }, { texte: "Vous gardez la main" }] },
        { type: "T21" },
      ],
    },
  },
};
