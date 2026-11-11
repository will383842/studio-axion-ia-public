// Parcours « mot » : TEXTES VALIDÉS v2 (décision du 03/11/2026). PUR : aucun réseau, aucune base.
// Source unique : contrats/dictionnaire-textes-mp.v2.json (empreinte vérifiée par test). Toute modification = NOUVELLE version
// (nouvel identifiant), inscrite au registre de preuve. Jamais de question d'accord, jamais de mention STOP, aucun prix.
import dictionnaire from "../../../contrats/dictionnaire-textes-mp.v2.json";
import brouillons from "../../../contrats/dictionnaire-textes-mp-brouillons.v1.json";

export const MENTION_OUVERTURE: string = dictionnaire.mention_ouverture;
export type IdTexteMp = keyof typeof dictionnaire.textes;
export interface TexteMp {
  /** Numéro de version = identifiant (ex. « mp-m1-v2 ») : c'est la valeur inscrite au registre de preuve (`versionTexteM1`). */
  version: string;
  texte: string;
}
export const TEXTES_MP: Readonly<Record<IdTexteMp, TexteMp>> = dictionnaire.textes;

/**
 * Textes BROUILLONS (fiche Z2) : fichier séparé, pour ne pas toucher à l'empreinte figée du dictionnaire validé.
 * Ils ne sont PAS dans l'empreinte du parcours : à revalider sur la page /mots avant allumage.
 */
export type IdTexteMpBrouillon = keyof typeof brouillons.textes;
export interface TexteMpBrouillon extends TexteMp {
  statut: "brouillon";
}
export const TEXTES_MP_BROUILLONS: Readonly<Record<IdTexteMpBrouillon, TexteMpBrouillon>> = brouillons.textes as Record<IdTexteMpBrouillon, TexteMpBrouillon>;

export interface ValeursTexteMp {
  mot?: string;
  titre?: string;
  lien?: string;
}
const MARQUEURS: readonly [string, keyof ValeursTexteMp][] = [
  ["[MOT]", "mot"],
  ["[TITRE DU GUIDE]", "titre"],
  ["[LIEN]", "lien"],
];

/** Remplace les marqueurs. `null` si un marqueur présent dans le texte n'a pas de valeur : un texte à trous ne part jamais. */
export function rendreTexteMp(id: IdTexteMp, valeurs: ValeursTexteMp): string | null {
  let t = TEXTES_MP[id].texte;
  for (const [marqueur, cle] of MARQUEURS) {
    if (!t.includes(marqueur)) continue;
    const v = valeurs[cle]?.trim();
    if (!v) return null;
    t = t.split(marqueur).join(v);
  }
  return t;
}
