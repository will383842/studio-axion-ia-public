import { z } from "zod";
import { texteSansLien } from "../../../../domaine/visuels/schema";
import { RUBRIQUE_MAX } from "../../../../domaine/visuels/continu/geometrie";
import type { DefinitionGabarit } from "../registre-gabarits";

/**
 * Cas concrets (P3d) : S01 fenêtre « la relance », S02 conversation (sombre), S03 schéma en trois nœuds. Les trois portent `cas: true` :
 * l'étiquette « Scénario type · exemple illustratif » (`textesFixes.t26Etiquette`) est posée par le code, jamais saisie. Les noms propres
 * d'exemple (« M. Martin ») restent des champs ; les icônes sont des clés techniques posées par le composant.
 */
/** Budgets (caractères) de chaque champ de texte, mesurés par `essai-continu-cas.ts` (texte plein et mots longs, police ≥ 26 px, 0 débordement). */
export const BUDGETS_CAS = {
  S01: { titre: 22, accent: 22, fenetre: 34, destinataire: 24, objet: 40, message: 150, validation: 36 },
  S02: { titre: 22, accent: 28, question: 70, reponse: 50, pret: 50, validation: 24 },
  S03: { titre: 28, accent: 24 },
  noeud: { titre: 22, texte: 48 },
} as const;
const B = BUDGETS_CAS;

const commun = { alt: texteSansLien(1, 125), rubrique: texteSansLien(1, RUBRIQUE_MAX).optional() };

const noeud = z.object({ titre: texteSansLien(1, B.noeud.titre), texte: texteSansLien(1, B.noeud.texte) }).strict();

export const CARTES_CAS: DefinitionGabarit[] = [
  {
    type: "S01",
    famille: "cas",
    nom: "Fenêtre : la relance",
    role: "contenu",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("S01"),
        ...commun,
        titre: texteSansLien(1, B.S01.titre),
        accent: texteSansLien(1, B.S01.accent),
        fenetre: texteSansLien(1, B.S01.fenetre),
        destinataire: texteSansLien(1, B.S01.destinataire),
        objet: texteSansLien(1, B.S01.objet),
        message: texteSansLien(1, B.S01.message),
        validation: texteSansLien(1, B.S01.validation),
      })
      .strict(),
    exemple: {
      type: "S01",
      alt: "Une fenêtre de brouillon : une relance de devis à M. Martin, prête à partir après votre validation.",
      titre: "Une relance",
      accent: "prête à partir",
      fenetre: "Brouillon · Devis Martin",
      destinataire: "M. Martin",
      objet: "Suite à notre devis du 12",
      message: "Bonjour, je reviens vers vous au sujet du devis envoyé la semaine dernière. Avez-vous eu le temps de le regarder\u00a0?",
      validation: "Vous validez avant l’envoi",
    },
    bordsLibres: { gauche: [[0, 0]], droite: [[0, 0]] },
    cas: true,
    actif: true,
  },
  {
    type: "S02",
    famille: "cas",
    nom: "Conversation",
    role: "contenu",
    sombre: true,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("S02"),
        ...commun,
        titre: texteSansLien(1, B.S02.titre),
        accent: texteSansLien(1, B.S02.accent),
        question: texteSansLien(1, B.S02.question),
        reponse: texteSansLien(1, B.S02.reponse),
        pret: texteSansLien(1, B.S02.pret),
        validation: texteSansLien(1, B.S02.validation),
      })
      .strict(),
    exemple: {
      type: "S02",
      alt: "Une conversation : l’assistant propose de préparer un devis, vous répondez, il le prépare, vous validez.",
      titre: "Une question,",
      accent: "une réponse prête",
      question: "Vous avez reçu une demande de devis. Je prépare la réponse\u00a0?",
      reponse: "Oui, avec nos délais habituels.",
      pret: "C’est prêt. Relisez, puis validez.",
      validation: "Validé ✓",
    },
    bordsLibres: { gauche: [[0, 0]], droite: [[0, 0]] },
    cas: true,
    actif: true,
  },
  {
    type: "S03",
    famille: "cas",
    nom: "Schéma en trois nœuds",
    role: "contenu",
    sombre: false,
    orangeFort: false,
    version: 1,
    schema: z
      .object({
        type: z.literal("S03"),
        ...commun,
        titre: texteSansLien(1, B.S03.titre),
        accent: texteSansLien(1, B.S03.accent),
        noeuds: z.array(noeud).length(3),
      })
      .strict(),
    exemple: {
      type: "S03",
      alt: "Un schéma en trois étapes : on reçoit la demande, on prépare la réponse, vous validez avant l’envoi.",
      titre: "Chaque demande suit",
      accent: "le même chemin",
      noeuds: [
        { titre: "On la reçoit", texte: "Un message, un formulaire, un appel." },
        { titre: "On prépare", texte: "La réponse est rédigée pour vous." },
        { titre: "Vous validez", texte: "Rien ne part sans votre accord." },
      ],
    },
    bordsLibres: { gauche: [[0, 0]], droite: [[0, 0]] },
    cas: true,
    actif: true,
  },
];
