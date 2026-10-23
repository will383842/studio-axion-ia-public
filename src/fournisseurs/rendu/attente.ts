/**
 * ATTENTE BORNÉE d'UN rendu de `studio-rendu` (lots R4-R5) : soumettre, suivre, soumettre à nouveau une panne
 * passagère (nouvel identifiant, 2 fois au plus), s'arrêter au délai. Toujours HORS verrou. Un 404 (conteneur
 * redémarré) est soumis à nouveau sous le MÊME identifiant (`suivreRendu`).
 */
import type { DemandeRendu, EtatRendu, ServiceRendu } from "../types";
import { ErreurRendu, suivreRendu } from "./client";
import { attendreParDefaut } from "./commun";

export interface OptionsAttente {
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => number;
  delaiMs: number;
  /** Nouvelles soumissions au plus après une panne passagère (défaut 2). */
  essais?: number;
}

/** Renvoie l'état « terminé », ou lève une `ErreurRendu` (refus, pannes répétées, délai dépassé). */
export async function executerRendu(service: ServiceRendu, premiere: DemandeRendu, o: OptionsAttente): Promise<Extract<EtatRendu, { statut: "termine" }>> {
  const attendre = o.attendre ?? attendreParDefaut;
  const maintenant = o.maintenant ?? Date.now;
  const fin = maintenant() + o.delaiMs;
  let demande = premiere;
  let essai = 0;
  await service.soumettre(demande);
  for (;;) {
    let e: EtatRendu | null = null;
    try {
      e = await suivreRendu(service, demande);
    } catch {
      e = null; // coupure passagère : relue au tour suivant
    }
    if (e?.statut === "termine") return e;
    if (e?.statut === "echec") {
      if (!e.erreur.reessayable || essai >= (o.essais ?? 2)) throw new ErreurRendu(e.erreur);
      essai++;
      demande = { ...demande, idRendu: `${premiere.idRendu}-e${essai}` };
      await service.soumettre(demande);
    }
    if (maintenant() >= fin) throw new ErreurRendu({ code: "indisponible", reessayable: true, message: "Le serveur du studio n'a pas fini à temps." });
    await attendre(800);
  }
}
