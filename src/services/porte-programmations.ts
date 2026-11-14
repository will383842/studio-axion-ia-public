/**
 * Porte v2, appel 4 « programmations » : l'usine propose une date par défaut pour une entrée du calendrier.
 * Règles : l'entrée naît d'origine « usine » et reste « a_valider » (la validation est un geste tracé du fondateur,
 * jamais écrit ici) ; la date choisie par le fondateur l'emporte (`ecritureDatePermise`) ; l'usine n'écrit jamais de
 * statut au-delà de « a_valider » ; un rejeu ne crée aucun doublon et ne ramène jamais une entrée en arrière.
 * ISOLATION : ce service n'importe aucun fournisseur ni le port d'envoi : il tient l'état du plan, rien ne part chez le
 * diffuseur. Il n'appelle pas `validerEntree` (CAL-21, geste du fondateur) : aucune dépendance à injecter.
 */
import "server-only";
import { ecritureDatePermise } from "@/domaine/plan-editorial/origine-date";
import type { IdReseau } from "@/domaine/types";
import { changerStatut, creerCreneau, type DepotsPlan } from "@/services/plan-editorial";

export interface Programmation {
  /** Clé d'idempotence : donne l'identifiant de l'entrée créée. */
  cle: string;
  reseau: IdReseau;
  jour: string;
  instant: string;
  compteCible: string;
  videoId?: string;
  visuelId?: string;
  repere?: string;
  /** Entrée existante à laquelle l'usine propose une date par défaut (sinon une entrée neuve est créée). */
  entreeId?: string;
}

export type ResultatProgrammation =
  | { etat: "recue"; deja: boolean }
  | { etat: "date_du_fondateur_conservee"; deja: true };

export const identifiantProgrammation = (cle: string): string => `prog-${cle}`;

export async function recevoirProgrammation(d: DepotsPlan, p: Programmation, maintenant: string): Promise<ResultatProgrammation> {
  // Entrée existante visée : la règle d'origine tranche. Date du fondateur (ou entrée d'avant, sans origine) : intacte.
  // Entrée d'origine usine encore à relire : la date par défaut est révisée, sans toucher au statut.
  if (p.entreeId) {
    const cible = await d.creneaux.obtenir(p.entreeId);
    if (cible) {
      const permis = ecritureDatePermise(cible.origine, "usine");
      if (!permis.ok) return { etat: "date_du_fondateur_conservee", deja: true };
      if (cible.statut === "propose" || cible.statut === "a_valider") {
        await d.creneaux.enregistrer({ ...cible, jourVise: p.jour, heuresParReseau: { ...cible.heuresParReseau, [p.reseau]: p.instant } });
      }
      return { etat: "recue", deja: true };
    }
  }
  const id = identifiantProgrammation(p.cle);
  const existant = await d.creneaux.obtenir(id);
  if (existant) {
    // Rejeu : on termine seulement une création restée à « propose » (panne entre les deux écritures).
    if (existant.statut === "propose") await changerStatut(d, id, "a_valider", "usine", maintenant);
    return { etat: "recue", deja: true };
  }
  await creerCreneau(
    d,
    {
      id, jourVise: p.jour, heuresParReseau: { [p.reseau]: p.instant }, compteCible: p.compteCible, origine: "usine",
      ...(p.repere ? { repereUsine: p.repere } : {}), ...(p.videoId ? { videoId: p.videoId } : {}), ...(p.visuelId ? { visuelId: p.visuelId } : {}),
    },
    maintenant,
  );
  await changerStatut(d, id, "a_valider", "usine", maintenant);
  return { etat: "recue", deja: false };
}
