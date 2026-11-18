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

/**
 * Une fin montrée à l'écran de validation (17/11, Williams : l'écran montre tout ce qui sera dit et écrit) : la phrase dite
 * et les textes écrits de la fin au mot choisie, ou `FIN_AUCUNE` (dit) quand rien n'est dit ni écrit après la question.
 */
export interface FinARelire {
  reseaux: string;
  dit: string;
  ecrits: readonly string[];
}

/**
 * Les lignes à relire, une par écran (rang 1 → `e01`), puis (17/11) une ligne VERROUILLÉE par fin, groupe « Fin »
 * (identifiant `f-<réseaux>`, ignoré par `rangDeLigne` : jamais une modification).
 */
export function lignesDesEcrans(ecrans: readonly EcranApercu[], fins: readonly FinARelire[] = []): LigneScript[] {
  return [
    ...ecrans.map((e) => ({
      id: idEcranAttendu(e.rang - 1),
      dit: e.texteDit,
      ecrits: (e.ecrits ?? []).map((texte, k) => ({ texte, modifiable: e.modifiables?.[k] === true })),
      groupe: e.nom,
    })),
    ...fins.map((f) => ({ id: `f-${f.reseaux}`, dit: f.dit, ecrits: f.ecrits.map((texte) => ({ texte, modifiable: false })), verrouille: true, groupe: "Fin" })),
  ];
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
