import { nouvelId } from "@/lib/ids";
import { normaliserOrigine } from "./autonomie-usine";

/**
 * AUT-G : clé de registre propre à UNE dépense de l'Usine (`travailId#voix-…`). Le champ n'existe QUE pour l'origine
 * normalisée « usine » ; pour le Studio (origine absente ou « studio »), on rend un objet vide : la demande reste
 * strictement celle de master (pas de champ `cleUsine`, pas même `undefined`, pas de tirage d'identifiant).
 */
export function cleDepenseUsine(origine: unknown, travailId: string): { cleUsine?: string } {
  return normaliserOrigine(origine) === "usine" ? { cleUsine: `${travailId}#${nouvelId("voix")}` } : {};
}
