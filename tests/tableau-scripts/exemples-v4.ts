/**
 * L'EXEMPLE VALIDÉ DU GABARIT CADRÉ (Will, 15/10/2026) : « Ce devis collé dans ChatGPT contient trois données de
 * trop. » Texte dit recopié MOT POUR MOT du diagnostic (le diagnostic du 15/10 (non publié),
 * « Exemple réécrit ») et de `exemples-v4/01-formation.md` (vérifié par `exemples-v4.test.ts`) ; les mots à l'écran,
 * l'idée, le gain, le métier et les affirmations sont ajoutés pour le format de sortie du générateur. Il passe TOUS les
 * contrôles en code ; c'est le témoin donné au générateur (`SCRIPT_TEMOIN`).
 */
import type { DemandeScriptTableau, EcritureScript, LigneGrille } from "@/domaine/scripts-tableau";

export interface ExempleV4 {
  /** Nom du fichier dans `exemples-v4/` (sans « .md »). */
  fichier: string;
  titre: string;
  demande: DemandeScriptTableau;
  ecriture: EcritureScript;
  grille: LigneGrille[];
  /** « Que manque-t-il pour comprendre le réflexe ? » : vide, sinon le script n'est pas livré. */
  manques: string[];
}

const p = (dit: string, ecran: string) => ({ dit, ecran });
const ok = (critere: LigneGrille["critere"], remarque: string): LigneGrille => ({ critere, respecte: true, remarque });

const FORMATION: ExempleV4 = {
  fichier: "01-formation",
  titre: "Formation · Ce devis collé dans ChatGPT contient trois données de trop",
  demande: {
    serie: "formation",
    sujet: "Vos équipes collent des données de clients dans l'IA : les réflexes avant de coller",
    public: "Dirigeants de TPE et PME dont les salariés utilisent ChatGPT sans cadre",
    vraiCas: null,
    reseau: "courts",
    fin: { type: "diagnostic" },
    envoi: "Un appel de diagnostic : ce que l'équipe colle aujourd'hui dans l'IA, et les réflexes à lui apprendre",
    duree: 60,
  },
  ecriture: {
    idee: "Ce qui permet de reconnaître votre client ne se colle pas.",
    gain: { formule: "Six lignes collées au lieu de tout le fil de mails", unite: "lignes" },
    metierExemple: "assistante",
    script: {
      accroche: [p("Ce devis collé dans ChatGPT contient trois données de trop.", "Trois données de trop")],
      douleur: [
        p("Le nom du client.", "Le nom"),
        p("L'adresse du chantier.", "L'adresse du chantier"),
        p("Son portable.", "Son portable"),
        p("Selon les réglages, l'outil peut s'en servir pour s'entraîner.", "Il peut s'en servir"),
        p("Votre client, lui, n'a rien autorisé.", "Rien autorisé"),
      ],
      promesse: [p("Trois réflexes à prendre avant de coller.", "Trois réflexes avant de coller"), p("Le troisième se cache là où personne ne regarde.", "Le troisième se cache")],
      etapes: [
        {
          action: p("Un. Remplacez les noms par des lettres.", "Remplacez les noms"),
          comment: [p("Monsieur Martin devient Client A, la société Durand devient Fournisseur B.", "M. Martin → Client A"), p("Pour rédiger une relance, l'IA n'a pas besoin du vrai nom.", "Pas besoin du vrai nom")],
        },
        {
          action: p("Deux. Effacez les coordonnées : adresse, téléphone, e-mail, numéro de dossier.", "Effacez les coordonnées"),
          comment: [p("Gardez seulement ce qui sert à la réponse, par exemple « chantier en ville ».", "« Chantier en ville »")],
        },
        {
          action: p("Trois. Coupez la signature et l'historique en bas du mail.", "Coupez la signature"),
          comment: [p("C'est là que restent le nom, le portable et souvent l'adresse du client.", "Nom, portable, adresse")],
        },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Une assistante prépare une relance de devis.", "Une relance de devis"),
          p("Avant, elle collait tout le fil de mails.", "Avant : tout le fil"),
          p("Maintenant, elle colle six lignes : Client A, sans coordonnées, sans signature.", "Maintenant : six lignes"),
          p("La relance est aussi utile, et les données du client restent chez vous.", "Les données restent chez vous"),
        ],
      },
      aRetenir: [p("Ce qui permet de reconnaître votre client ne se colle pas.", "Ce qui le reconnaît reste")],
      appel: [p("Axion-IA forme les équipes à ces réflexes.", "Axion-IA forme vos équipes"), p("Réservez un appel de diagnostic.", "Réservez un diagnostic")],
    },
    motsDouleur: ["devis collé", "ChatGPT", "trois données de trop"],
    sources: [],
    affirmations: [
      {
        extrait: "Selon les réglages, l'outil peut s'en servir pour s'entraîner.",
        nature: "fait",
        pourquoi: "Prudent et exact : selon le compte et ses réglages, les échanges peuvent servir à améliorer l'outil ; « peut » et « selon les réglages » ne promettent rien de plus.",
      },
      {
        extrait: "Votre client, lui, n'a rien autorisé.",
        nature: "fait",
        pourquoi: "Le client a confié ses coordonnées pour son devis, pas pour un outil tiers : il n'a donné aucun accord pour ce partage-là.",
      },
      {
        extrait: "Le troisième se cache là où personne ne regarde.",
        nature: "consigne",
        pourquoi: "Image, pas une statistique : la signature et l'historique en bas d'un mail sont rarement relus avant de coller ; l'étape 3 dit où regarder.",
      },
      {
        extrait: "Pour rédiger une relance, l'IA n'a pas besoin du vrai nom.",
        nature: "consigne",
        pourquoi: "La relance se rédige à partir du contexte (le devis, le délai) ; le vrai nom se remet à la main avant l'envoi.",
      },
      {
        extrait: "C'est là que restent le nom, le portable et souvent l'adresse du client.",
        nature: "fait",
        pourquoi: "Une signature reprend le nom et le téléphone de l'expéditeur, et l'historique cité garde les messages du client, souvent avec son adresse.",
      },
    ],
    variantes: [],
    aPreparer: ["Le lien de réservation de l'appel de diagnostic."],
  },
  grille: [
    ok("une-idee", "Une idée : ce qui reconnaît le client ne se colle pas ; dite dès l'accroche, redite en une phrase."),
    ok("gain", "Six lignes au lieu du fil entier, la relance aussi utile : annoncé (« avant de coller »), montré dans l'exemple."),
    ok("accroche-douleur", "Une phrase, un chiffre (trois données), lisible sans le son."),
    ok("douleur-vecue", "Le nom, l'adresse, le portable : la scène se voit ; son coût est dit (le client n'a rien autorisé)."),
    ok("promesse-tenue", "« Trois réflexes » : le nombre réel ; la boucle « le troisième se cache » est tenue à l'étape 3."),
    ok("etapes-claires", "Remplacez, effacez, coupez : un geste et une ou deux phrases concrètes chacun."),
    ok("clarte", "Mots simples, aucun jargon, aucune formule creuse, rien de répété."),
    ok("verite", "« Selon les réglages », « peut » ; chaque phrase avec « rien » ou « personne ne » est justifiée."),
    ok("une-seule-demande", "Une demande, cinq mots ; la phrase sur l'entreprise reprend « ces réflexes »."),
    ok("cadre", "Six passages dans l'ordre, 187 mots, chaque passage dans sa borne."),
  ],
  manques: [],
};

export const EXEMPLES_V4: readonly ExempleV4[] = [FORMATION];

/** Une copie neuve de l'exemple `fichier` (les essais la modifient librement). */
export function exempleV4(fichier: string): ExempleV4 {
  const e = EXEMPLES_V4.find((x) => x.fichier === fichier);
  if (!e) throw new Error(`exemple inconnu : ${fichier}`);
  return structuredClone(e);
}
