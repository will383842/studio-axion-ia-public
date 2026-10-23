/**
 * RELIRE LE SCRIPT DU CAS CONCRET (brique 3 sur 8 : l'adaptateur du format pour l'écran commun `RelireScript`). PUR.
 *
 * Une ligne par écran du corps (identifiant `e01`, `e02`… comme les écrans de la fiche) : la phrase dite, les textes
 * affichés dans l'ordre de l'aperçu ; le chiffre tiré d'un fait du cas (écran « chiffre ») n'est pas modifiable. Les
 * différences reviennent en `ModificationEcran` (par rang), le format que `appliquerModifications` contrôle déjà.
 */
import type { DifferenceLigne, LigneScript } from "@/domaine/relecture-script";
import { idEcranAttendu } from "./fiche";
import type { ModificationEcran } from "./modifier-script";
import type { EcranApercu } from "./script-valide";

/** Les lignes à relire, une par écran (rang 1 → `e01`). */
export function lignesDesEcrans(ecrans: readonly EcranApercu[]): LigneScript[] {
  return ecrans.map((e) => ({
    id: idEcranAttendu(e.rang - 1),
    dit: e.texteDit,
    ecrits: (e.ecrits ?? []).map((texte, k) => ({ texte, modifiable: e.modifiables?.[k] === true })),
    groupe: e.nom,
  }));
}

/** Rang d'un écran depuis l'identifiant de sa ligne (`e03` → 3) ; `null` si l'identifiant n'en est pas un. */
export function rangDeLigne(id: string): number | null {
  const m = /^e(\d{2,})$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Les différences de l'écran commun, en modifications d'écrans (ce que le serveur contrôle et applique). */
export function modificationsDesDifferences(differences: readonly DifferenceLigne[]): ModificationEcran[] {
  return differences.flatMap((d) => {
    const rang = rangDeLigne(d.id);
    if (rang === null) return [];
    return [{ rang, ...(d.dit !== undefined ? { texteDit: d.dit } : {}), ...(d.ecrits ? { ecrits: d.ecrits } : {}) }];
  });
}
