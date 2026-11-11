// Parcours « mot » : TEXTES VALIDÉS v2 (décision du 03/11/2026). PUR : aucun réseau, aucune base.
// Source unique : contrats/dictionnaire-textes-mp.v2.json (empreinte vérifiée par test). Toute modification = NOUVELLE version
// (nouvel identifiant), inscrite au registre de preuve. Jamais de question d'accord, jamais de mention STOP, aucun prix.
import dictionnaire from "../../../contrats/dictionnaire-textes-mp.v2.json";

export const MENTION_OUVERTURE: string = dictionnaire.mention_ouverture;
export type IdTexteMp = keyof typeof dictionnaire.textes;
export interface TexteMp {
  /** Numéro de version = identifiant (ex. « mp-m1-v2 ») : c'est la valeur inscrite au registre de preuve (`versionTexteM1`). */
  version: string;
  texte: string;
}
export const TEXTES_MP: Readonly<Record<IdTexteMp, TexteMp>> = dictionnaire.textes;

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
