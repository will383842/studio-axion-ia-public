/**
 * CAS RÉEL DU 12/10 (essai n° 2 par l'écran) : script ACCEPTÉ par le générateur (note 10 sur 10, fil Instagram et
 * Facebook, 5 étapes, 1 487 caractères dits), puis fiche REFUSÉE par le découpage (douleur trop longue pour la fiche,
 * mots de la douleur absents de l'accroche, durée estimée à 96,9 s). Le texte dit est repris MOT POUR MOT ; les mots à
 * l'écran sont une transcription pour les essais ; les mots de la douleur sont ceux qu'un générateur doit rendre.
 */
import type { AngleScript, DemandeScriptTableau, EcritureScript } from "@/domaine/scripts-tableau";

/** Le texte dit, tel qu'il a été accepté par le générateur. */
export const TEXTE_CAS_REEL =
  "Vous finissez à dix-neuf heures sans savoir où est passée la journée. Vous avez recopié des adresses, relancé des factures, répondu trois fois à la même question. Et le soir, vous vous dites : je n'ai rien fait de ce que j'avais prévu. Le problème n'est pas votre organisation. Le temps part dans des petites tâches répétées, trop courtes pour qu'on les remarque. En une semaine, avec une feuille, vous trouverez les trois qui vous coûtent le plus. Un. Gardez une feuille près du clavier toute la semaine. Notez chaque tâche que vous faites plus d'une fois, en trois mots. Deux. Chaque fois qu'elle revient, tracez un bâton à côté. Pas de chronomètre. Juste des bâtons. Trois. À côté de chaque tâche, écrivez combien de minutes elle vous prend. Une estimation suffit, une seule fois par tâche. Quatre. Vendredi, multipliez les bâtons par les minutes. Entourez les trois plus gros totaux. Cinq. Pour chacune, écrivez ce qui entre et ce qui sort. C'est exactement ce que vous direz à une IA. Prenons un plombier persuadé de perdre son temps au téléphone. Sa grille montre autre chose : recopier les coordonnées des mails vers ses devis. Quinze bâtons, quatre minutes à chaque fois : une heure par semaine. Ce qui entre : le mail. Ce qui sort : l'en-tête du devis. Il sait enfin quoi confier en premier. Une feuille. Des bâtons. Des minutes. Trois totaux entourés. Ce qui entre, ce qui sort. La grille d'une page est prête, colonnes tracées. Écrivez GRILLE en commentaire. Je vous l'envoie.";

export const DEMANDE_CAS_REEL: DemandeScriptTableau = {
  serie: "audit",
  sujet: "Trouver en une semaine les trois tâches qui vous coûtent le plus de temps",
  public: "Dirigeants de petites entreprises",
  vraiCas: null,
  reseau: "fil",
  fin: { type: "commentaire", mot: "GRILLE" },
  envoi: "La grille d'une page, colonnes tracées",
};

/** La douleur DÉCRITE par la passe « angle » ce jour-là (plus longue que la fiche, sans aucun mot de l'accroche). */
export const DOULEUR_DECRITE_CAS_REEL =
  "Le dirigeant de petite entreprise sent qu'il perd du temps, mais ne sait pas dire où. La journée file en petits gestes refaits sans y penser : recopier les coordonnées, relancer, répondre encore.";

export const ANGLE_CAS_REEL: AngleScript = {
  angle: "Comment voir où l'on perd du temps ?",
  douleur: DOULEUR_DECRITE_CAS_REEL,
  accroches: (["situation-vecue", "idee-recue-contredite", "chiffre-vrai", "erreur-frequente", "promesse-precise"] as const).map((type) => ({ type, dit: "Vous finissez à dix-neuf heures sans savoir où est passée la journée.", ecran: "Où est passée la journée ?", pourquoi: "" })),
  retenue: 0,
  raison: "Situation vécue.",
};

const p = (dit: string, ecran: string) => ({ dit, ecran });

export function ecritureCasReel(): EcritureScript {
  return {
    // Écrit avant le gabarit cadré du 15/10 : ni idée, ni gain, ni métier déclarés.
    idee: "",
    gain: { formule: "", unite: "" },
    metierExemple: "",
    script: {
      accroche: [p("Vous finissez à dix-neuf heures sans savoir où est passée la journée.", "Où est passée la journée ?")],
      douleur: [
        p("Vous avez recopié des adresses, relancé des factures, répondu trois fois à la même question.", "Adresses, factures, questions"),
        p("Et le soir, vous vous dites : je n'ai rien fait de ce que j'avais prévu.", "« Rien fait de prévu »"),
      ],
      // Forme v3 (14/10) : l'ancien « retournement » devient la promesse, chaque étape garde ses deux phrases
      // (action, puis l'explication en résultat), le récapitulatif devient « à retenir ». Le texte dit est inchangé.
      promesse: [
        p("Le problème n'est pas votre organisation.", "Pas l'organisation"),
        p("Le temps part dans des petites tâches répétées, trop courtes pour qu'on les remarque.", "Petites tâches répétées"),
        p("En une semaine, avec une feuille, vous trouverez les trois qui vous coûtent le plus.", "Une semaine, une feuille"),
      ],
      etapes: [
        { action: p("Un. Gardez une feuille près du clavier toute la semaine.", "1. Une feuille au clavier"), comment: [], resultat: p("Notez chaque tâche que vous faites plus d'une fois, en trois mots.", "Chaque tâche refaite") },
        { action: p("Deux. Chaque fois qu'elle revient, tracez un bâton à côté.", "2. Un bâton par fois"), comment: [], resultat: p("Pas de chronomètre. Juste des bâtons.", "Pas de chronomètre") },
        { action: p("Trois. À côté de chaque tâche, écrivez combien de minutes elle vous prend.", "3. Les minutes"), comment: [], resultat: p("Une estimation suffit, une seule fois par tâche.", "Une estimation suffit") },
        { action: p("Quatre. Vendredi, multipliez les bâtons par les minutes.", "4. Bâtons × minutes"), comment: [], resultat: p("Entourez les trois plus gros totaux.", "Les trois plus gros") },
        { action: p("Cinq. Pour chacune, écrivez ce qui entre et ce qui sort.", "5. Ce qui entre, sort"), comment: [], resultat: p("C'est exactement ce que vous direz à une IA.", "Ce qu'on dira à l'IA") },
      ],
      exemple: {
        mentionEcran: "Exemple illustratif",
        phrases: [
          p("Prenons un plombier persuadé de perdre son temps au téléphone.", "Plombier : le téléphone ?"),
          p("Sa grille montre autre chose : recopier les coordonnées des mails vers ses devis.", "Mails recopiés vers devis"),
          p("Quinze bâtons, quatre minutes à chaque fois : une heure par semaine.", "Une heure par semaine"),
          p("Ce qui entre : le mail.", "Entre : le mail"),
          p("Ce qui sort : l'en-tête du devis.", "Sort : l'en-tête"),
          p("Il sait enfin quoi confier en premier.", "Quoi confier d'abord"),
        ],
      },
      aRetenir: [p("Une feuille. Des bâtons. Des minutes. Trois totaux entourés. Ce qui entre, ce qui sort.", "Feuille, bâtons, minutes, totaux")],
      appel: [p("La grille d'une page est prête, colonnes tracées.", "La grille d'une page"), p("Écrivez GRILLE en commentaire.", "Commentez GRILLE"), p("Je vous l'envoie.", "Je vous l'envoie")],
    },
    // Les mots de la douleur, recopiés de l'accroche dite ; « dix-neuf heures » est dit dans les 3 premières secondes.
    motsDouleur: ["dix-neuf heures", "passée", "journée"],
    sources: [],
    affirmations: [],
    variantes: [],
    aPreparer: ["La grille d'une page, colonnes tracées"],
  };
}
