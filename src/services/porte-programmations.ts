/**
 * Porte v2, appel 4 « programmations » : l'usine propose une date par défaut pour une entrée du calendrier.
 * Règles : l'entrée naît d'origine « usine » et reste « a_valider » (la validation est un geste tracé du fondateur,
 * jamais écrit ici) ; la date choisie par le fondateur n'est jamais touchée (seule la création d'une entrée neuve écrit une date ; aucune révision) ; l'usine n'écrit jamais de
 * statut au-delà de « a_valider » ; un rejeu ne crée aucun doublon et ne ramène jamais une entrée en arrière.
 * ISOLATION : ce service n'importe aucun fournisseur ni le port d'envoi : il tient l'état du plan, rien ne part chez le
 * diffuseur. Il n'appelle pas `validerEntree` (CAL-21, geste du fondateur) : aucune dépendance à injecter.
 */
import "server-only";
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
}

export interface ResultatProgrammation {
  etat: "recue";
  deja: boolean;
}

export const identifiantProgrammation = (cle: string): string => `prog-${cle}`;

export async function recevoirProgrammation(d: DepotsPlan, p: Programmation, maintenant: string): Promise<ResultatProgrammation> {
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
