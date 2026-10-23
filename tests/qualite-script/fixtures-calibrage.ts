/**
 * JEU D'ESSAI DE CALIBRAGE DU SOCLE QUALITÉ (18/10/2026). Six scripts courts, RÉALISTES mais INVENTÉS : aucun client
 * réel, aucune entreprise réelle. Les textes du banc à l'aveugle du 17/10 sont sur le serveur : ils ne sont pas ici.
 *
 * Trois BONS selon les règles de Will : une douleur dès l'accroche, une valeur, une preuve, le positionnement « on s'en
 * occupe pour vous », UN seul appel. Trois MAUVAIS : le tutoriel « faites-le vous-même », l'annonce d'outil, les redites.
 *
 * Marqueur de preuve fictive : toute ligne qui porte un chiffre porte `sourcee: true` (la source est une mission
 * FICTIVE, `tests/generateur/preuves-fictives.ts`) ; une ligne chiffrée sans ce marqueur est une erreur du jeu d'essai.
 */
import type { Partie, ScriptNormalise } from "@/domaine/qualite-script";
import type { ReseauDeclinaison } from "@/domaine/types";

export interface ScriptCalibrage {
  id: string;
  /** « bon » : conforme aux règles de Will ; « mauvais » : enfreint l'une d'elles. */
  nature: "bon" | "mauvais";
  /** Le défaut visé (mauvais) ou ce qui fait la qualité (bon). */
  resume: string;
  reseau: ReseauDeclinaison;
  dureeViseeSec: number;
  /** Partie, texte dit, et `sourcee: true` si la ligne porte un chiffre de la preuve fictive. */
  lignes: [Partie, string, boolean?][];
}

export const SCRIPTS_CALIBRAGE: readonly ScriptCalibrage[] = [
  {
    id: "B1-devis",
    nature: "bon",
    resume: "Douleur (devis en retard), preuve fictive, « on s'en occupe », un seul appel.",
    reseau: "instagram",
    dureeViseeSec: 30,
    lignes: [
      ["accroche", "Vos devis partent trois jours trop tard.", true],
      ["douleur", "Pendant ce temps, votre client demande un second prix ailleurs."],
      ["douleur", "Et le soir, vous relancez à la main, après les chantiers."],
      ["promesse", "Chez nous, on s'en occupe pour vous, de bout en bout."],
      ["corps", "Le devis se prépare tout seul à partir de la demande du client, avec vos prix et votre modèle."],
      ["corps", "La relance part le lendemain, sans que personne y pense."],
      ["preuve", "Dans une PME du bâtiment fictive, le délai d'envoi est passé de trois jours à une demi-journée.", true],
      ["corps", "Mais le prix final reste votre décision : on automatise la mécanique, pas votre jugement."],
      ["corps", "Votre équipe retrouve du temps pour les chantiers, et vos clients reçoivent leur devis plus vite."],
      ["a-retenir", "Le devis part seul, vous gardez la relation avec le client."],
      ["appel", "Écrivez DEVIS en commentaire, et on regarde votre cas ensemble."],
    ],
  },
  {
    id: "B2-factures",
    nature: "bon",
    resume: "Douleur du DAF (relances à la main), valeur chiffrée fictive, exemple, une question-appel.",
    reseau: "linkedin",
    dureeViseeSec: 30,
    lignes: [
      ["accroche", "Chaque fin de mois, votre équipe comptable court après les factures."],
      ["douleur", "Une pièce manque, un fournisseur relance, et la clôture prend du retard."],
      ["douleur", "Résultat : votre directeur financier passe ses soirées à vérifier des lignes."],
      ["promesse", "Nous automatisons la saisie et le rapprochement pour vous, et nous restons responsables du résultat."],
      ["corps", "Les factures arrivent par mail, elles sont lues, classées et rapprochées des commandes."],
      ["corps", "Seules les exceptions remontent à votre équipe, avec la raison de l'écart."],
      ["exemple", "Par exemple, dans un cabinet comptable fictif, la saisie est passée de huit heures à deux heures par semaine.", true],
      ["corps", "Alors, la clôture se prépare pendant le mois, et non plus dans la dernière nuit."],
      ["corps", "Vous gagnez des heures, vous réduisez les erreurs, et vous gardez la main sur les validations."],
      ["a-retenir", "Votre équipe décide, la saisie, c'est notre métier."],
      ["question", "Quelle tâche de clôture pourrait tourner toute seule chez vous ?"],
    ],
  },
  {
    id: "B3-recrutement",
    nature: "bon",
    resume: "Douleur du DRH (tri de candidatures), preuve fictive, cible unique, un seul appel.",
    reseau: "linkedin",
    dureeViseeSec: 30,
    lignes: [
      ["accroche", "Votre DRH trie encore deux cents candidatures à la main.", true],
      ["douleur", "Les bons profils attendent une réponse, et ils signent ailleurs."],
      ["douleur", "Chaque semaine de retard coûte un poste vide à votre entreprise."],
      ["promesse", "Chez nous, le tri et les réponses sont faits pour vous, avec votre grille de critères."],
      ["corps", "Chaque candidature est lue, classée, puis une réponse polie part le jour même."],
      ["corps", "Votre DRH ne reçoit que les profils qui correspondent, avec un résumé de trois lignes.", true],
      ["preuve", "Dans une PME de services fictive, un poste ouvert est pourvu en dix jours au lieu de six semaines.", true],
      ["corps", "Mais l'entretien reste humain : c'est votre équipe qui choisit."],
      ["corps", "Vous gagnez du temps, vous perdez moins de candidats, et votre image d'employeur progresse."],
      ["a-retenir", "Le tri est automatique, la décision reste la vôtre."],
      ["appel", "Écrivez-moi RECRUTEMENT en message privé, et on regarde votre prochain poste."],
    ],
  },
  {
    id: "M1-tutoriel",
    nature: "mauvais",
    resume: "Tutoriel « faites-le vous-même » : PO-01 (conclusion), aucune douleur, aucun positionnement.",
    reseau: "instagram",
    dureeViseeSec: 30,
    lignes: [
      ["accroche", "Voici comment créer vos devis avec un assistant IA, étape par étape."],
      ["corps", "Première étape : ouvrez l'assistant et collez votre modèle de devis."],
      ["corps", "Deuxième étape : copiez ce prompt et remplacez les champs entre crochets."],
      ["corps", "Troisième étape : relisez le résultat, corrigez les prix, puis envoyez le devis au client."],
      ["corps", "Quatrième étape : programmez un rappel dans votre agenda pour relancer dans une semaine."],
      ["corps", "Ensuite, enregistrez le prompt dans un fichier pour le réutiliser à chaque devis."],
      ["corps", "Si le résultat ne vous plaît pas, modifiez le prompt et recommencez jusqu'à la bonne version."],
      ["corps", "C'est simple, vous pouvez le faire vous-même en un quart d'heure.", true],
      ["a-retenir", "À vous de jouer : faites-le vous-même, pas besoin d'un expert."],
      ["appel", "Essayez-le dès ce soir et dites-moi en commentaire comment ça s'est passé."],
    ],
  },
  {
    id: "M2-annonce-outil",
    nature: "mauvais",
    resume: "Annonce d'outil : PO-02 (« vient de sortir », « nouvelle fonctionnalité »), aucun bénéfice pour l'entreprise.",
    reseau: "linkedin",
    dureeViseeSec: 30,
    lignes: [
      ["accroche", "Un nouvel outil d'IA vient de sortir, et il change tout."],
      ["corps", "L'éditeur vient d'annoncer une nouvelle fonctionnalité de résumé de réunions."],
      ["corps", "La dernière mise à jour ajoute aussi une application mobile et un mode vocal."],
      ["corps", "J'ai testé pour vous : l'interface est plus rapide et les réponses sont plus longues."],
      ["corps", "Le modèle gère maintenant davantage de langues et de formats de fichiers."],
      ["corps", "Il est disponible dès aujourd'hui pour les abonnés de l'offre payante."],
      ["corps", "D'autres éditeurs préparent déjà leurs propres annonces pour les semaines à venir."],
      ["a-retenir", "Retenez surtout que les outils évoluent très vite."],
      ["appel", "Abonnez-vous pour suivre toutes les nouveautés de l'IA."],
    ],
  },
  {
    id: "M3-redites",
    nature: "mauvais",
    resume: "Redites : la même idée reprise en variantes, phrase redite à 2-3 mots près en fin de script, peu de substance.",
    reseau: "instagram",
    dureeViseeSec: 30,
    lignes: [
      ["accroche", "L'automatisation fait gagner du temps à votre entreprise."],
      ["corps", "Avec l'automatisation, votre entreprise gagne du temps chaque jour."],
      ["corps", "Gagner du temps grâce à l'automatisation, c'est très utile pour une entreprise."],
      ["corps", "Mais non. C'est tout."],
      ["corps", "L'automatisation permet vraiment à une entreprise de gagner du temps."],
      ["corps", "Beaucoup d'entreprises veulent gagner du temps avec l'automatisation."],
      ["corps", "Voilà. C'est tout."],
      ["a-retenir", "Automatiser fait gagner du temps à votre entreprise, chaque jour, avec l'automatisation."],
      ["corps", "L'automatisation fait gagner beaucoup de temps à votre entreprise, chaque jour."],
      ["appel", "Écrivez AUTO en commentaire pour en savoir plus."],
    ],
  },
];

/** Le script normalisé d'un cas (la ligne chiffrée sans marqueur de preuve fictive est refusée par le test du jeu). */
export function normaliser(s: ScriptCalibrage): ScriptNormalise {
  return {
    reseau: s.reseau,
    dureeViseeSec: s.dureeViseeSec,
    lignes: s.lignes.map(([partie, dit, sourcee], i) => ({ id: `${s.id}-${i}`, partie, dit, ...(sourcee ? { sourcee: true } : {}) })),
  };
}
