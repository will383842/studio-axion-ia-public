/**
 * Le script MODÈLE des essais : depuis le lot B1 (décision D1 de Will, 18/10), le témoin v5 (`exemples-v5/01-continuite.md`,
 * « Le seul qui connaît ce dossier client est en congé » ; TikTok/Reels, fin : appel de diagnostic), sans tutoriel
 * numéroté, qui passe tous les contrôles en code. L'ancien témoin du 15/10 (`exemples-v4.ts`, tutoriel « Un. Remplacez… »)
 * est gardé en données : il illustre l'ANCIEN défaut et est désormais refusé. Le script validé par Will le 12/10
 * (`MODELE-VALIDE.md`) est gardé dans sa forme d'avant la v3, pour les essais de relecture tolérante.
 */
import { QUESTIONS_IA, type DemandeScriptTableau, type EcritureScript } from "@/domaine/scripts-tableau";
import { exempleV5 } from "./exemples-v5";

export const DEMANDE_MODELE: DemandeScriptTableau = exempleV5("01-continuite").demande;

/**
 * Le témoin v5. Sa question sur l'IA (18/10) est dite juste avant la phrase sur l'entreprise, sans rien à l'écran : la
 * formulation tirée pour un premier script (aucun historique), sauf `question` donnée.
 */
export function ecritureModele(question: string = QUESTIONS_IA[0]): EcritureScript {
  const e = exempleV5("01-continuite").ecriture;
  return { ...e, script: { ...e.script, appel: e.script.appel.map((x, i) => (i === 0 ? { ...x, dit: question } : x)) } };
}

const p = (dit: string, ecran: string) => ({ dit, ecran });

/** Le script du 12/10 (validé par Will, structure d'avant la v3), tel qu'une trace ancienne l'a enregistré. */
export const DEMANDE_MODELE_1210: DemandeScriptTableau = {
  serie: "formation",
  sujet: "Apprendre l'IA en cinq jours, sur une seule tâche",
  public: "Dirigeants et artisans qui ont essayé l'IA sans résultat",
  vraiCas: null,
  reseau: "fil",
  fin: { type: "commentaire", mot: "CINQ" },
  envoi: "La page « Apprendre l'IA en cinq jours, sur une seule tâche »",
};

export function scriptAncien1210(): Record<string, unknown> {
  return {
    accroche: [p("Vous avez essayé l'IA trois fois.", "Essayé trois fois"), p("Et vous avez laissé tomber.", "Vous avez abandonné")],
    douleur: [p("Des réponses plates.", "Réponses plates"), p("Du texte qu'il faut tout réécrire.", "Tout à réécrire"), p("Vous vous êtes dit : ce n'est pas pour moi.", "« Pas pour moi »")],
    retournement: [p("Le problème n'est pas l'outil.", "Pas l'outil"), p("Vous l'avez essayé comme un moteur de recherche.", "Pas un moteur de recherche"), p("Ça s'apprend comme un geste : en répétant.", "Un geste qui se répète"), p("Voici comment, en cinq jours.", "En cinq jours")],
    etapes: [
      { phrases: [p("Un. Choisissez une seule tâche que vous refaites chaque semaine.", "1. Une seule tâche"), p("Un devis. Une relance. Un compte rendu.", "Devis, relance, compte rendu")] },
      { phrases: [p("Deux. Faites-la avec l'IA cinq jours de suite.", "2. Cinq jours de suite"), p("La même tâche. Pas une autre.", "La même tâche")] },
      { phrases: [p("Trois. Chaque jour, changez une seule chose dans votre demande.", "3. Un changement par jour"), p("Lundi : dites pour qui c'est.", "Lundi : pour qui")] },
      { phrases: [p("Quatre. Vendredi, gardez la demande qui marche.", "4. Vendredi : on garde"), p("Vous ne la retaperez plus jamais.", "Plus jamais retapée")] },
    ],
    exemple: { mentionEcran: "Exemple illustratif", phrases: [p("Prenons un artisan et ses relances de devis.", "Artisan : relances de devis"), p("Lundi, le message est froid.", "Lundi : froid")] },
    recapitulatif: [p("Une tâche. Cinq jours. Un changement par jour. Un modèle gardé.", "Tâche, cinq jours, modèle")],
    appel: [p("Le détail des cinq jours tient sur une page.", "Le détail : une page"), p("Écrivez CINQ en commentaire.", "Commentez CINQ"), p("Je vous l'envoie.", "Je vous l'envoie")],
  };
}
