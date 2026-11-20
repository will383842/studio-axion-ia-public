import "server-only";
/** RAP-3 · lecture LOCALE de la mesure de l'écart calendrier / diffuseur (écrite par la synchro). Aucun appel réseau ; ne lève jamais. */
import { depots } from "@/services/_commun";
import { retraitGroupeSur, estRapatrieeIntrouvable, estRapatrieeRetirable } from "@/services/retirer-rapatriee";
import { PARAM_ECART_CALENDRIER, type EcartCalendrier } from "@/services/zernio";

/**
 * Mesure de l'écart + rapatriées introuvables chez le diffuseur (comptage local, aucun appel réseau).
 * `introuvables` = affichées ; `retirables` = identifiants du retrait groupé (introuvables depuis 24 h, après 2 constats).
 * `jamaisMesuree` : aucune mesure écrite, la mesure rendue est un gabarit NON vérifié (jamais de bouton de retrait).
 */
export type EcartAffiche = EcartCalendrier & { introuvables?: number; retirables?: string[]; jamaisMesuree?: boolean; /** Message : le retrait groupé est refusé (autre espace probable, retrait de masse). */ retraitRefuse?: string };

async function lireIntrouvables(mesure: Partial<EcartCalendrier> | undefined): Promise<{ introuvables: number; retirables: string[]; retraitRefuse?: string }> {
  try {
    const toutes = await depots().publications.lister(() => true);
    const liste = toutes.filter(estRapatrieeIntrouvable);
    const maintenant = Date.now();
    const retirables = liste.filter((p) => estRapatrieeRetirable(p, maintenant)).map((p) => p.id);
    if (retirables.length === 0) return { introuvables: liste.length, retirables };
    const sur = retraitGroupeSur(mesure as EcartCalendrier | undefined, toutes);
    return sur.sur ? { introuvables: liste.length, retirables } : { introuvables: liste.length, retirables: [], retraitRefuse: sur.message };
  } catch {
    return { introuvables: 0, retirables: [] };
  }
}

export async function lireEcartCalendrier(): Promise<EcartAffiche | null> {
  try {
    const v = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as Partial<EcartCalendrier> | undefined;
    const { introuvables, retirables, retraitRefuse } = await lireIntrouvables(v);
    if (!v || typeof v.luLe !== "string" || typeof v.verifie !== "boolean" || typeof v.absents !== "number") {
      // Mesure absente : rien à dire sur l'écart ; les introuvables se voient quand même, mais la mesure est « jamais mesurée » (non vérifiée).
      return introuvables > 0 ? { luLe: "", verifie: false, jamaisMesuree: true, chezDiffuseur: 0, absents: 0, exemples: [], introuvables, retirables } : null;
    }
    return { luLe: v.luLe, verifie: v.verifie, chezDiffuseur: Number(v.chezDiffuseur) || 0, absents: v.absents, exemples: Array.isArray(v.exemples) ? v.exemples : [], introuvables, retirables, ...(retraitRefuse ? { retraitRefuse } : {}), ...(typeof v.suivies === "number" ? { suivies: v.suivies } : {}), ...(typeof v.connusFiables === "number" ? { connusFiables: v.connusFiables } : {}), ...(v.espaceSuspectLe ? { espaceSuspectLe: v.espaceSuspectLe } : {}) };
  } catch {
    return null;
  }
}
