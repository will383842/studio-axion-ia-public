/**
 * Gestes « Activer » / « Mettre en pause » d'une ligne LOCALE du mot GUIDE (sans idWorkflow). PUR : la confirmation de
 * l'opérateur est demandée AVANT tout appel ; sans « oui », aucun geste n'est appelé. La session est exigée côté serveur
 * (`mots-gestes`). Aucun appel vers Zernio : le registre local est la seule source de vérité.
 */
import type { Resultat } from "@/services/mots-service";

export interface ServicesMotLocal {
  activerLocal(compte: string): Promise<Resultat>;
  mettreEnPauseLocal(mot: string, compte: string): Promise<Resultat>;
}
export interface AppuiMotLocal {
  /** Demande son accord à l'opérateur (phrase en français) ; la réponse peut venir plus tard (boîte dans la page). */
  confirmer(phrase: string): boolean | Promise<boolean>;
  /** Résultat du geste, à montrer à l'opérateur. */
  apres(r: Resultat): void;
}

export const PHRASE_ACTIVER = "Activer le mot GUIDE pour ce compte ? Les commentaires GUIDE recevront alors une réponse et un message privé.";
export const PHRASE_VALIDER_GUIDE = "Valider les textes du mot GUIDE ? Ce sont les textes officiels du serveur ; rien n’est envoyé.";
export const PHRASE_PAUSE = "Mettre le mot GUIDE en pause pour ce compte ? Plus aucun message ne partira ; rien n’est supprimé.";

export function creerGestesMotLocal(services: ServicesMotLocal, appui: AppuiMotLocal) {
  // Appels de service SANS question : l'écran pose la question lui-même, HORS de toute transition React, puis lance seulement ceux-ci.
  const executerActiver = async (compte: string): Promise<boolean> => {
    appui.apres(await services.activerLocal(compte));
    return true;
  };
  const executerPause = async (mot: string, compte: string): Promise<boolean> => {
    appui.apres(await services.mettreEnPauseLocal(mot, compte));
    return true;
  };
  return {
    executerActiver,
    executerPause,
    async activer(compte: string): Promise<boolean> {
      if (!(await appui.confirmer(PHRASE_ACTIVER))) return false;
      return executerActiver(compte);
    },
    async pause(mot: string, compte: string): Promise<boolean> {
      if (!(await appui.confirmer(PHRASE_PAUSE))) return false;
      return executerPause(mot, compte);
    },
  };
}
