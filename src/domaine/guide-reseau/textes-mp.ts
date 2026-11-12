// Parcours « mot » : TEXTES VALIDÉS (dictionnaire v3). PUR : aucun réseau, aucune base.
// Source unique : contrats/dictionnaire-textes-mp.v2.json (empreinte vérifiée par test). Toute modification = NOUVELLE version
// (nouvel identifiant), inscrite au registre de preuve. Jamais de mention d'automatisme en ouverture, jamais de signature,
// jamais de question d'accord, jamais de mention STOP, aucun prix. Aucune entrée n'est supprimée : un texte remplacé passe à « retire ».
import dictionnaire from "../../../contrats/dictionnaire-textes-mp.v2.json";

export type IdTexteMp = keyof typeof dictionnaire.textes;
export interface TexteMp {
  /** Numéro de version = identifiant (ex. « mp-m1-v2 ») : c'est la valeur inscrite au registre de preuve (`versionTexteM1`). */
  version: string;
  /** « actif » : peut partir ; « retire » : gardé comme preuve de ce qu'une personne a pu recevoir, ne part plus. */
  statut: string;
  texte: string;
}
export const TEXTES_MP: Readonly<Record<IdTexteMp, TexteMp>> = dictionnaire.textes;

/** Groupes de formulations : listes ORDONNÉES de versions (l'ordre fait partie du contrat, il sert au choix). */
export type GroupeMp = keyof typeof dictionnaire.groupes;
export const GROUPES_MP: Readonly<Record<GroupeMp, readonly IdTexteMp[]>> = dictionnaire.groupes as Record<GroupeMp, IdTexteMp[]>;
/** Les textes qui peuvent encore partir (statut « actif »). */
export const textesActifs = (): Readonly<Partial<Record<IdTexteMp, TexteMp>>> =>
  Object.fromEntries(Object.entries(TEXTES_MP).filter(([, t]) => t.statut === "actif"));

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
