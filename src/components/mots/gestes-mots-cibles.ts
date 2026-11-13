// R4 — gestes de la fiche d'un mot : chacun demande d'abord une confirmation claire, puis seulement appelle le service.
// PUR : la confirmation et les services arrivent en paramètres. Sans « oui », AUCUN service n'est appelé.
import type {
  ApercuReseauVue,
  CompteDuMot,
  ReseauAutoVue,
  ServicesMotsCibles,
} from "@/domaine/guide-reseau/vue-mots-cibles";
import {
  LIBELLES_ECRAN,
  NOM_RESEAU,
  PHRASES_CONFIRMATION,
} from "./fiche-mot-libelles";

export interface DemandeConfirmation {
  titre: string;
  phrase: string;
  bouton: string;
}
/** Affiche la question et rend `true` seulement si la personne répond « oui ». */
export type Confirmer = (demande: DemandeConfirmation) => Promise<boolean>;

/** `confirme` faux : la personne a dit non (ou le geste n'était pas permis), rien n'a été appelé. */
export interface IssueGeste {
  readonly confirme: boolean;
  readonly ok: boolean;
  readonly phrase: string;
}
const REFUSE: IssueGeste = { confirme: false, ok: false, phrase: "" };

export interface GestesMotsCibles {
  valider(
    mot: string,
    reseau: ReseauAutoVue,
    apercu: Extract<ApercuReseauVue, { ok: true }>,
  ): Promise<IssueGeste>;
  activer(mot: string, compte: CompteDuMot, titre: string): Promise<IssueGeste>;
  mettreEnPause(mot: string, compte: CompteDuMot): Promise<IssueGeste>;
}

const nomDuCompte = (c: CompteDuMot) => c.nom ?? c.compte;

export function creerGestesMotsCibles(
  services: Pick<
    ServicesMotsCibles,
    "validerTextes" | "activer" | "mettreEnPause"
  >,
  confirmer: Confirmer,
  /** Appelée après chaque geste confirmé et exécuté (pour afficher la phrase et recharger). */
  apres?: (mot: string, issue: IssueGeste) => void,
): GestesMotsCibles {
  const fin = (mot: string, i: IssueGeste) => {
    apres?.(mot, i);
    return i;
  };
  // Un service qui échoue ne fait jamais planter l'écran : phrase simple, rien n'est dit « réussi ».
  const echec = (mot: string) =>
    fin(mot, { confirme: true, ok: false, phrase: LIBELLES_ECRAN.geste });
  return {
    async valider(mot, reseau, apercu) {
      const q = PHRASES_CONFIRMATION.valider(
        mot,
        NOM_RESEAU[reseau],
        apercu.cible.titre,
      );
      if (!(await confirmer(q))) return REFUSE;
      try {
        const r = await services.validerTextes(mot, reseau, apercu.empreinte);
        return fin(mot, { confirme: true, ok: r.ok, phrase: r.phrase });
      } catch {
        return echec(mot);
      }
    },
    async activer(mot, compte, titre) {
      // Un compte non activable ne s'active jamais : ni question, ni service.
      if (!compte.activable || compte.reseau === null) return REFUSE;
      const q = PHRASES_CONFIRMATION.activer(
        mot,
        nomDuCompte(compte),
        NOM_RESEAU[compte.reseau],
        titre,
      );
      if (!(await confirmer(q))) return REFUSE;
      try {
        const r = await services.activer(mot, compte.compte);
        return fin(mot, {
          confirme: true,
          ok: r.issue === "execute",
          phrase: r.phrase,
        });
      } catch {
        return echec(mot);
      }
    },
    async mettreEnPause(mot, compte) {
      const q = PHRASES_CONFIRMATION.pause(mot, nomDuCompte(compte));
      if (!(await confirmer(q))) return REFUSE;
      try {
        const r = await services.mettreEnPause(mot, compte.compte);
        return fin(mot, {
          confirme: true,
          ok: r.issue === "execute",
          phrase: r.phrase,
        });
      } catch {
        return echec(mot);
      }
    },
  };
}
