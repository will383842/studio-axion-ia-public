/**
 * Dépôt des demandes de production : une demande = un suivi « en file », rangé selon la date cible. Tout est injecté (enregistrement) :
 * aucun appel réel, aucun fournisseur, aucune fabrication ici. Le dépôt est tout ou rien : une demande invalide ou en double
 * refuse le lot entier avant tout enregistrement.
 */
import { lireDemande, ordreDeFile, type DemandeDeProduction, type TypeDemande } from "@/domaine/productions/demande";

export interface SuiviDeProduction {
  demandeId: string;
  type: TypeDemande;
  dateCible: string;
  /** Place dans la file, à partir de 1. */
  rang: number;
  statut: "en_file";
}

export interface DependancesDepotDemandes {
  enregistrer: (suivi: SuiviDeProduction) => Promise<void>;
}

export async function deposerDemandes(brutes: readonly unknown[], deps: DependancesDepotDemandes): Promise<SuiviDeProduction[]> {
  const demandes: DemandeDeProduction[] = [];
  for (const [i, brut] of brutes.entries()) {
    const d = lireDemande(brut);
    if (!d) throw new Error(`La demande ${i + 1} est invalide`);
    demandes.push(d);
  }
  if (new Set(demandes.map((d) => d.id)).size !== demandes.length) throw new Error("Deux demandes portent le même identifiant");
  const suivis = ordreDeFile(demandes).map<SuiviDeProduction>((d, i) => ({ demandeId: d.id, type: d.type, dateCible: d.dateCible, rang: i + 1, statut: "en_file" }));
  for (const s of suivis) await deps.enregistrer(s);
  return suivis;
}
