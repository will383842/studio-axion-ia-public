/**
 * SUIVI DE FABRICATION DU TABLEAU ANIMÉ, partie affichée (tâche TB-21, plan § 15 n° 2 ; harmonisation F2) : titre et phrase communs
 * (`EnTeteSuivi`), les 4 étapes parlantes rendues par `SuiviFabrication` (adaptateur `versSuiviFabricationTableau`), actions rangées
 * par `ActionsSuivi`. En cas d'arrêt, l'erreur en clair et « Reprendre cette étape » quand c'est réessayable ; après TOUT arrêt, les
 * boutons de `actionsArret` (« Corriger la fiche », « Reprendre la fabrication » : table `issuesApresArret`). Un travail arrêté n'a
 * aucune roue qui tourne ; les fichiers déjà faits restent téléchargeables, avec ce qui manque, et la voix déjà payée est gardée.
 * Sans état ni appel : `SuiviTableau` lui passe le travail à jour et les actions.
 */
import type { ReactNode } from "react";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { Icone } from "@/components/ui/Icone";
import { heurePrete } from "@/domaine/facecam-parcours";
import { versSuiviFabricationTableau } from "./vues-gabarit";
import { erreurEnClair, type EtapeMoteurLue, type ErreurLue } from "./vue";

/** Fichiers déjà déposés par une fabrication arrêtée (une sortie a pu aboutir, une autre non). */
export interface FichiersArret {
  prets: { cle: string; libelle: string; url: string }[];
  /** Libellés des sorties qui manquent. */
  manquants: string[];
}

export interface TravailTableauLu {
  statut: "en_file" | "en_cours" | "termine" | "echec" | "annule";
  etapes: (EtapeMoteurLue & { erreur?: ErreurLue })[];
  erreur?: ErreurLue;
  finEstimee?: string;
  rang?: number;
}

export function EtapesTableau({
  travail,
  onReessayer,
  reessaiEnCours,
  maintenantMs,
  passerDevant,
  action,
  actionsArret,
  annuler,
  fichiers,
}: {
  travail: TravailTableauLu;
  onReessayer?: () => void;
  reessaiEnCours?: boolean;
  /** Pour les tests : l'heure « maintenant ». */
  maintenantMs?: number;
  /** « Passer devant », pendant la fabrication (travail en file). */
  passerDevant?: ReactNode;
  /** Autre bouton (« Arrêter »), pendant la fabrication. */
  action?: ReactNode;
  /** Boutons montrés après un arrêt (« Corriger la fiche », « Reprendre la fabrication »). */
  actionsArret?: ReactNode;
  /** « Annuler cette vidéo » (corbeille), pendant comme après la fabrication. */
  annuler?: ReactNode;
  /** Fichiers déjà faits par la fabrication arrêtée, et ce qui manque. */
  fichiers?: FichiersArret | null;
}) {
  const echec = travail.statut === "echec";
  const annule = travail.statut === "annule";
  const vue = versSuiviFabricationTableau(travail);
  // Le message de l'erreur est dans l'encart du suivi quand une étape la porte ; sinon (rien en échec côté moteur) il monte dans le titre.
  const messageTitre = echec && !vue.etapes.some((e) => e.erreur) ? erreurEnClair(travail).message : undefined;
  const specifique =
    (echec || annule) && (annule || (fichiers && (fichiers.prets.length > 0 || fichiers.manquants.length > 0))) ? (
      <div className="space-y-2 rounded-2xl border border-trait bg-surface-1 px-4 py-3">
        {annule && <p className="text-[15px] text-texte-doux">La voix déjà payée est gardée. « Reprendre la fiche » rouvre le brouillon.</p>}
        {fichiers?.prets.map((f) => (
          <p key={f.cle} className="flex flex-wrap items-center justify-between gap-2 text-[15px] text-texte">
            <span>
              <Icone nom="coche" size={14} className="mr-1.5 inline text-sauge" />
              {f.libelle} : prête
            </span>
            <a href={f.url} download className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-orange-vif hover:underline">
              Télécharger
            </a>
          </p>
        ))}
        {fichiers && fichiers.manquants.length > 0 && (
          <p className="text-sm text-texte-doux">
            Il manque : {fichiers.manquants.join(", ")}.{fichiers.prets.length > 0 ? " « Reprendre la fabrication » fabrique ce qui manque sans repayer la voix." : ""}
          </p>
        )}
      </div>
    ) : undefined;

  return (
    <section aria-label="Fabrication en cours" className="space-y-4">
      <EnTeteSuivi etat={vue.etat} pret={heurePrete(travail.finEstimee, maintenantMs)} message={messageTitre} />
      <SuiviFabrication vue={vue} compacte onReessayer={onReessayer} reessaiEnCours={reessaiEnCours} specifiqueSuivi={specifique} />
      <ActionsSuivi etat={vue.etat} passerDevant={passerDevant} arreter={action} propres={actionsArret} annuler={annuler} />
    </section>
  );
}
