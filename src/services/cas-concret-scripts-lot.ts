/**
 * CAS CONCRET : la page en LOT (lot K3, vitesse). Deux gestes, sans rien écrire ni dépenser :
 *   - `scriptsValidesDe(ids)` lit le réglage des scripts validés UNE seule fois pour tous les cas (avant : une lecture par cas,
 *     deux fois par cas sur la page) ;
 *   - `preparerPageCas` estime TOUJOURS les cas d'avant le stock (comme avant K3) ; seuls les cas DU STOCK sont plafonnés
 *     (20 au plus). La feuille « Votre vidéo » estime à l'ouverture : un cas du stock sans montant d'avance s'ouvre
 *     avec le bouton inactif jusqu'au retour de sa propre estimation.
 * N'importe que la constante publique du réglage (`CLE_SCRIPTS_VALIDES`) : les fonctions d'écriture des scripts ne sont pas touchées.
 */
import "server-only";
import { lireScriptValide, scriptValideDuCatalogue, type ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { lireParametre } from "./_commun";
import { CLE_SCRIPTS_VALIDES } from "./cas-concret-scripts";

/** Cas DU STOCK estimés à l'affichage de la page (la taille d'une page de cartes). */
export const CAS_PAR_PAGE = 20;

/** Le script validé de chaque cas (studio, sinon catalogue ; `null` : aucun), après UNE seule lecture du réglage. */
export async function scriptsValidesDe(ids: readonly string[], lire: () => Promise<unknown> = () => lireParametre<unknown>(CLE_SCRIPTS_VALIDES, {})): Promise<Record<string, ScriptValide | null>> {
  const lu = await lire();
  const gardes = lu && typeof lu === "object" && !Array.isArray(lu) ? (lu as Record<string, unknown>) : {};
  const sortie: Record<string, ScriptValide | null> = {};
  for (const id of ids) sortie[id] = lireScriptValide(gardes[id]) ?? scriptValideDuCatalogue(id) ?? null;
  return sortie;
}

export interface EstimationPage {
  centimes: number;
  refus?: string | null;
}

/**
 * Estime les cas de la page : les valides d'abord, puis ceux à valider (en essai). Les cas qui ne sont pas du stock sont
 * TOUS estimés (22 cas = 22 estimations, comme avant K3) ; les cas du stock, `max` au plus EN TOUT. Les autres cas du
 * stock n'ont pas de montant d'avance. `estimer` et `estStock` sont fournis par la page (`estimerCas`, `estCasStock`) ;
 * les appels se font l'un après l'autre.
 */
export async function preparerPageCas<T extends { cas: { id: string } }>(
  valides: readonly T[],
  aValider: readonly T[],
  estimer: (c: T, essai: boolean) => Promise<EstimationPage>,
  max: number = CAS_PAR_PAGE,
  estStock: (id: string) => boolean = () => false,
): Promise<{ montants: Record<string, number>; refus: Record<string, string> }> {
  const montants: Record<string, number> = {};
  const refus: Record<string, string> = {};
  let reste = max;
  for (const [liste, essai] of [[valides, false], [aValider, true]] as const) {
    for (const c of liste) {
      if (estStock(c.cas.id)) {
        if (reste <= 0) continue;
        reste -= 1;
      }
      const e = await estimer(c, essai);
      montants[c.cas.id] = e.centimes;
      if (e.refus) refus[c.cas.id] = e.refus;
    }
  }
  return { montants, refus };
}
