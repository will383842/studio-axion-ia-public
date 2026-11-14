import "server-only";
import { depots } from "@/services/_commun";
import { lirePeriode, type DepotsPlan } from "@/services/plan-editorial";
import { heureAffichageParis } from "@/domaine/plan-editorial/statuts";
import type { StatutPlan } from "@/domaine/plan-editorial/types";
import type { IdReseau } from "@/domaine/types";
import { cleJour } from "@/lib/dates";

/** Un créneau du plan éditorial d'un jour, montré à part dans la vue Jour. */
export type CreneauDuJour = { id: string; jourVise: string; reseaux: IdReseau[]; heure?: string; titre: string };

/** Seuls ces statuts se décalent depuis la vue Jour (les autres sont publiés, archivés ou confiés au diffuseur). */
const STATUTS_DECALABLES: readonly StatutPlan[] = ["propose", "a_valider", "valide"];

// Copie locale de actions/decaler.ts : ce fichier-là porte « use server », ses fonctions deviendraient des actions du navigateur.
function depotsPlan(): DepotsPlan {
  const d = depots();
  return { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] };
}

/**
 * Créneaux du plan pour ce jour qu'on peut encore décaler : statut proposé, à valider ou validé, jour à venir.
 * Le jour de Paris d'aujourd'hui est calculé ici, sans dépendre du paramètre `aujourdhui` (qui peut différer à minuit).
 * Ne lève jamais : en cas de panne, la liste est vide.
 */
export async function chargerPlanDuJour(jour: string, aujourdhui: string): Promise<CreneauDuJour[]> {
  void aujourdhui;
  try {
    const parisAujourdhui = cleJour(new Date());
    const liste = await lirePeriode(depotsPlan(), jour, jour);
    return liste
      .filter((c) => STATUTS_DECALABLES.includes(c.statut) && c.jourVise >= parisAujourdhui)
      .map((c) => {
        const reseaux = (Object.keys(c.heuresParReseau) as IdReseau[]).filter((r) => Boolean(c.heuresParReseau[r]));
        const premiere = reseaux.map((r) => c.heuresParReseau[r]).find((h): h is string => Boolean(h));
        return { id: c.id, jourVise: c.jourVise, reseaux, ...(premiere ? { heure: heureAffichageParis(premiere) } : {}), titre: c.videoId ?? c.visuelId ?? c.id };
      });
  } catch {
    return [];
  }
}
