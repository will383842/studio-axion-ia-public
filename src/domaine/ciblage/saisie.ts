/** Cible reçue d'un écran ou d'une action : assainie ici, jamais crue sur parole. PUR. */
import type { Ciblage, NiveauCible, TypeAutomatisation } from "./types";
import { TYPES_AUTOMATISATION } from "./types";
import { libelleCibleValide } from "./controles";

export const CIBLE_ABSENTE = "CIBLE_ABSENTE";
export const MESSAGE_CIBLE_ABSENTE = "Choisissez à qui parle la vidéo.";

const NIVEAUX: readonly NiveauCible[] = ["metier", "secteur", "taille"];

/** La cible saisie si elle est valable (niveau connu, libellé d'une ligne de 80 caractères au plus, nettoyé) ; sinon `undefined`. */
export function ciblageSaisieValide(c: unknown): Ciblage | undefined {
  const x = c as Partial<Ciblage> | null | undefined;
  if (!x || typeof x.libelle !== "string" || !NIVEAUX.includes(x.niveau as NiveauCible) || !libelleCibleValide(x.libelle)) return undefined;
  return { niveau: x.niveau as NiveauCible, libelle: x.libelle.trim(), origine: "saisie" };
}

/** Un type d'automatisation connu, sinon `undefined` (« À classer »). */
export function typeAutomatisationValide(t: unknown): TypeAutomatisation | undefined {
  return TYPES_AUTOMATISATION.find((x) => x.id === t)?.id;
}
