import "server-only";
/** RAP-3 · lecture LOCALE de la mesure de l'écart calendrier / diffuseur (écrite par la synchro). Aucun appel réseau ; ne lève jamais. */
import { depots } from "@/services/_commun";
import { estRapatrieeIntrouvable, estRapatrieeRetirable } from "@/services/retirer-rapatriee";
import { PARAM_ECART_CALENDRIER, type EcartCalendrier } from "@/services/zernio";

/**
 * Mesure de l'écart + rapatriées introuvables chez le diffuseur (comptage local, aucun appel réseau).
 * `introuvables` = affichées ; `retirables` = identifiants du retrait groupé (introuvables depuis 24 h, après 2 constats).
 * `jamaisMesuree` : aucune mesure écrite, la mesure rendue est un gabarit NON vérifié (jamais de bouton de retrait).
 */
export type EcartAffiche = EcartCalendrier & { introuvables?: number; retirables?: string[]; jamaisMesuree?: boolean };

async function lireIntrouvables(): Promise<{ introuvables: number; retirables: string[] }> {
  try {
    const liste = await depots().publications.lister(estRapatrieeIntrouvable);
    const maintenant = Date.now();
    return { introuvables: liste.length, retirables: liste.filter((p) => estRapatrieeRetirable(p, maintenant)).map((p) => p.id) };
  } catch {
    return { introuvables: 0, retirables: [] };
  }
}

export async function lireEcartCalendrier(): Promise<EcartAffiche | null> {
  const { introuvables, retirables } = await lireIntrouvables();
  try {
    const v = (await depots().parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as Partial<EcartCalendrier> | undefined;
    if (!v || typeof v.luLe !== "string" || typeof v.verifie !== "boolean" || typeof v.absents !== "number") {
      // Mesure absente : rien à dire sur l'écart ; les introuvables se voient quand même, mais la mesure est « jamais mesurée » (non vérifiée).
      return introuvables > 0 ? { luLe: "", verifie: false, jamaisMesuree: true, chezDiffuseur: 0, absents: 0, exemples: [], introuvables, retirables } : null;
    }
    return { luLe: v.luLe, verifie: v.verifie, chezDiffuseur: Number(v.chezDiffuseur) || 0, absents: v.absents, exemples: Array.isArray(v.exemples) ? v.exemples : [], introuvables, retirables };
  } catch {
    return null;
  }
}
