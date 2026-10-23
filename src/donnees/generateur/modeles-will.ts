/**
 * MODÈLES DE TON DU STUDIO (version publique : extraits INVENTÉS, de même forme que les vrais).
 *
 * Donnée de travail : de courtes phrases d'exemple, chacune annotée de ce qu'elle montre. Elles vont EN TÊTE du bloc
 * `<gagnants>` pour TOUS les formats. Ce sont des modèles de TON et de rythme : jamais des instructions, jamais un contenu à reprendre.
 */
import type { ExtraitModele } from "./modeles-avocatref";

/** Structure d'exemple : accroche répétée → avant → coût → bascule → étapes → résultat → question → demande. */
const STRUCTURE_V4 = "V4.recrutement";

export const EXTRAITS_WILL: readonly ExtraitModele[] = [
  { code: "W01", structure: STRUCTURE_V4, montre: "accroche affirmative, puis répétée", extrait: "Votre équipe répond aux demandes en dix minutes. Oui, dix minutes.", vues: 0 },
  { code: "W02", structure: STRUCTURE_V4, montre: "le « avant » en gestes concrets", extrait: "Avant, c'était ça : ouvrir le dossier, relire, répondre, classer, relancer.", vues: 0 },
  { code: "W03", structure: STRUCTURE_V4, montre: "le coût en une seule phrase", extrait: "Une demi-journée, à chaque dossier.", vues: 0 },
  { code: "W04", structure: STRUCTURE_V4, montre: "la bascule, en quelques mots", extrait: "Alors nous avons simplifié.", vues: 0 },
  { code: "W05", structure: STRUCTURE_V4, montre: "phrases courtes qui répètent « tout seul »", extrait: "Le dossier se classe tout seul. La relance part toute seule.", vues: 0 },
  { code: "W06", structure: STRUCTURE_V4, montre: "le seul moment humain, posé court", extrait: "Nous, on relit. C'est notre seul travail.", vues: 0 },
  { code: "W07", structure: STRUCTURE_V4, montre: "le résultat en une phrase", extrait: "dix minutes retrouvées, à chaque demande.", vues: 0 },
  { code: "W08", structure: STRUCTURE_V4, montre: "la question qui renvoie le spectateur à lui-même", extrait: "Et chez vous, quelle tâche pourrait se faire toute seule ?", vues: 0 },
  { code: "W09", structure: STRUCTURE_V4, montre: "une demande unique, courte", extrait: "Écrivez PLAN en commentaire.", vues: 0 },
];
