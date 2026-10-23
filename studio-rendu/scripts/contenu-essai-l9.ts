/**
 * Contenus MOYENS (réalistes, thème du studio) des gabarits de la vague 1 (L9) : aucun chiffre, aucun nom réel, aucune marque, aucun logo.
 * Servent aux planches avant / après (`essai-l9.ts`) ; les mêmes formes nourrissent les fixtures de simulation Axion.
 */
export interface PageEssai {
  nom: string;
  page: Record<string, unknown>;
}

export const MOYENS_L9: readonly PageEssai[] = [
  { nom: "t22-moyen", page: { type: "T22", titre: "Une idée reçue tenace", mythe: "L'IA, c'est réservé aux grandes entreprises.", realite: "Une petite équipe s'y met sur une tâche précise, avec des outils simples." } },
  {
    nom: "t23-moyen",
    page: {
      type: "T23",
      titre: "Avant de choisir un outil",
      questions: [
        { question: "Quelle tâche revient sans cesse ?", aide: "Celle qu'on refait chaque semaine, à l'identique.", icone: "horloge" },
        { question: "Où se perd le plus de temps ?", aide: "Relances, recherches, copier-coller entre logiciels.", icone: "loupe" },
        { question: "Qui veut bien essayer ?", aide: "Une personne curieuse suffit pour lancer l'essai.", icone: "utilisateurs" },
      ],
      annotation: "Une réponse claire suffit pour démarrer.",
    },
  },
  {
    nom: "t24-moyen",
    page: {
      type: "T24",
      titre: "Le suivi des demandes",
      lignes: [
        { sans: "Des messages éparpillés", avec: "Une seule file à traiter" },
        { sans: "Des relances oubliées", avec: "Un rappel au bon moment" },
        { sans: "Des réponses à refaire", avec: "Des brouillons prêts" },
        { sans: "On cherche l'historique", avec: "Tout est au même endroit" },
      ],
    },
  },
  {
    nom: "t26-moyen",
    page: {
      type: "T26",
      titre: "Un cabinet de conseil",
      avant: ["Chaque devis repart de zéro", "Les relances se font de mémoire"],
      avec: ["Un modèle de devis prérempli", "Un suivi qui relance au bon moment"],
      outils: ["Tableur partagé", "Agenda en ligne"],
      vous: "plus de temps pour vos clients",
    },
  },
  {
    nom: "t27-moyen",
    page: {
      type: "T27",
      titre: "Êtes-vous prêt à démarrer ?",
      lignes: [
        { texte: "Une même tâche revient chaque semaine dans l'équipe" },
        { texte: "Les informations sont dispersées dans plusieurs outils" },
        { texte: "Quelqu'un dans l'équipe a envie d'essayer" },
        { texte: "Vous savez dire ce qui vous fait perdre du temps" },
      ],
    },
  },
  {
    nom: "t28-moyen",
    page: {
      type: "T28",
      titre: "Le trajet d'une demande",
      noeuds: [
        { texte: "La demande arrive", icone: "courrier" },
        { texte: "Elle est triée, classée", icone: "dossier" },
        { texte: "Un brouillon est préparé", icone: "crayon" },
        { texte: "Vous validez et envoyez", icone: "envoyer" },
      ],
    },
  },
];

/** Variantes moyennes supplémentaires (nombre d'éléments différent) : la planche montre toutes les mises en page. */
export const VARIANTES_L9: readonly PageEssai[] = [
  {
    nom: "t23-moyen-2",
    page: {
      type: "T23",
      titre: "Deux questions à se poser",
      questions: [
        { question: "Quelle tâche vous coûte le plus d'énergie ?", aide: "Pas forcément la plus longue : celle qu'on repousse sans cesse.", icone: "sablier" },
        { question: "Que feriez-vous du temps libéré ?", aide: "Plus de temps pour les clients, la qualité, ou souffler un peu.", icone: "ampoule" },
      ],
      annotation: "Commencez par ce qui pèse.",
    },
  },
  {
    nom: "t27-moyen-5",
    page: {
      type: "T27",
      titre: "Le bon moment pour s'y mettre",
      lignes: [
        { texte: "Vos équipes recopient des données d'un outil à l'autre" },
        { texte: "Les mêmes questions de clients reviennent souvent" },
        { texte: "Les comptes rendus de réunion prennent du retard" },
        { texte: "Les documents internes sont difficiles à retrouver" },
        { texte: "Vous voulez avancer sans tout changer d'un coup" },
      ],
    },
  },
  {
    nom: "t28-moyen-3",
    page: {
      type: "T28",
      titre: "Notre façon de faire",
      noeuds: [
        { texte: "On écoute vos besoins", icone: "bulle" },
        { texte: "On installe l'outil", icone: "engrenage" },
        { texte: "On forme vos équipes", icone: "utilisateurs" },
      ],
    },
  },
  {
    nom: "t24-moyen-5",
    page: {
      type: "T24",
      titre: "Une réunion d'équipe",
      lignes: [
        { sans: "Prise de notes à la main", avec: "Compte rendu préparé" },
        { sans: "Décisions floues", avec: "Décisions listées" },
        { sans: "Tâches oubliées", avec: "Tâches attribuées" },
        { sans: "Envoi tardif", avec: "Envoi le jour même" },
        { sans: "Personne ne relit", avec: "Relu en un coup d'œil" },
      ],
    },
  },
];

/**
 * AVANT le lot L9 : le même contenu que `MOYENS_L9`, forcé dans les anciens gabarits (seule possibilité jusque-là) : mythe / réalité, sans /
 * avec et cas concret en avant / après (T08), questions et checklist en liste numérotée (T06), flux en étapes (T20).
 */
export const AVANT_L9: readonly PageEssai[] = [
  { nom: "t22-avant", page: { type: "T08", titre: "Une idée reçue tenace", avant: "L'IA, c'est réservé aux grandes entreprises.", apres: "Une petite équipe s'y met sur une tâche précise." } },
  { nom: "t23-avant", page: { type: "T06", titre: "Avant de choisir un outil", points: [{ texte: "Quelle tâche revient sans cesse ? Celle qu'on refait chaque semaine." }, { texte: "Où se perd le plus de temps ? Relances, recherches, copier-coller." }, { texte: "Qui veut bien essayer ? Une personne curieuse suffit." }] } },
  { nom: "t24-avant", page: { type: "T08", titre: "Le suivi des demandes", avant: "Messages éparpillés, relances oubliées.", apres: "Une seule file, un rappel au bon moment." } },
  { nom: "t26-avant", page: { type: "T08", titre: "Un cabinet de conseil", avant: "Chaque devis repart de zéro.", apres: "Un modèle de devis prérempli." } },
  { nom: "t27-avant", page: { type: "T06", titre: "Êtes-vous prêt à démarrer ?", points: [{ texte: "Une même tâche revient chaque semaine" }, { texte: "Les informations sont dispersées" }, { texte: "Quelqu'un a envie d'essayer" }, { texte: "Vous savez ce qui coûte du temps" }] } },
  { nom: "t28-avant", page: { type: "T20", titre: "Le trajet d'une demande", etapes: [{ titre: "Arrivée", corps: "La demande arrive." }, { titre: "Tri", corps: "Elle est triée, classée." }, { titre: "Brouillon", corps: "Un brouillon est préparé." }, { titre: "Envoi", corps: "Vous validez et envoyez." }] } },
];
