/**
 * MIGRATION — étape 24 (lot C) : YouTube Shorts retiré des réseaux cochés par défaut (`reseaux.parDefaut`).
 * Jouée UNE SEULE FOIS (repère `migrations.reseaux-sans-youtube`) : un YouTube Shorts remis plus tard par le fondateur
 * n'est jamais retiré de nouveau. Rien n'est supprimé : l'ancienne valeur est gardée dans `reseaux.parDefaut.avantLotC`
 * (jamais écrasée). Valeur absente, illisible, sans YouTube Shorts, ou réduite à YouTube Shorts seul : intacte.
 * Écritures idempotentes : deux démarrages simultanés aboutissent au même état. Renvoie null s'il n'y a rien à dire.
 */
import type { Depots } from "@/domaine/depots";
import { RESEAU_RETIRE_DES_DEFAUTS } from "@/domaine/reseaux-par-defaut";

const REPERE = "migrations.reseaux-sans-youtube";
const SAUVEGARDE = "reseaux.parDefaut.avantLotC";
const CLE = "reseaux.parDefaut";

export async function etape24ReseauxSansYoutube(d: Depots, maintenant: string): Promise<Record<string, unknown> | null> {
  if (await d.parametres.obtenir(REPERE)) return null;
  let rapport: Record<string, unknown> | null = null;
  const actuel = await d.parametres.obtenir(CLE);
  if (actuel) {
    const valeur: unknown = actuel.valeur;
    if (!Array.isArray(valeur)) rapport = { illisible: 1 };
    else if (valeur.includes(RESEAU_RETIRE_DES_DEFAUTS)) {
      const filtree = valeur.filter((r) => r !== RESEAU_RETIRE_DES_DEFAUTS);
      if (filtree.length === 0) rapport = { seulYoutube: 1 };
      else {
        // Sauvegarde d'abord (valeur exacte d'avant), jamais écrasée ; puis la valeur sans YouTube Shorts, `creeLe` gardé.
        if (!(await d.parametres.obtenir(SAUVEGARDE))) await d.parametres.enregistrer({ id: SAUVEGARDE, valeur, creeLe: maintenant, modifieLe: maintenant });
        await d.parametres.enregistrer({ id: CLE, valeur: filtree, creeLe: actuel.creeLe, modifieLe: maintenant });
        rapport = { retire: 1 };
      }
    }
  }
  await d.parametres.enregistrer({ id: REPERE, valeur: maintenant, creeLe: maintenant, modifieLe: maintenant });
  return rapport;
}
