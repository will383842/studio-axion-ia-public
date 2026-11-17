/**
 * MIGRATION — étape 25 (C2-U13) : cinq styles de texte à l'écran (`donnees/styles-texte-ecran.ts`).
 *
 * INACTIVE tant que `STYLES_TEXTE_ECRAN_INSTALLES` n'est pas `true` : elle renvoie null et n'écrit rien. Allumée, elle
 * n'ajoute que les éléments absents (jamais un élément existant, renommé, réglé ou rangé), sans vidéo, sans fichier,
 * sans réglage et sans style par défaut de format : aucune vidéo existante ne change. Idempotente (second passage : null).
 * Résumé rangé dans `rapport.lots["styles-texte-ecran"]`.
 */
import type { Depots } from "@/domaine/depots";
import { elementsStylesTexteEcran, STYLES_TEXTE_ECRAN_INSTALLES } from "@/donnees/styles-texte-ecran";

export async function etape25StylesTexteEcran(d: Depots, maintenant: string, installes: boolean = STYLES_TEXTE_ECRAN_INSTALLES): Promise<Record<string, unknown> | null> {
  if (installes !== true) return null;
  const stylesAjoutes: string[] = [];
  for (const e of elementsStylesTexteEcran(maintenant)) {
    if (await d.elements.obtenir(e.id)) continue;
    await d.elements.enregistrer(e);
    stylesAjoutes.push(e.id);
  }
  return stylesAjoutes.length ? { stylesAjoutes } : null;
}
