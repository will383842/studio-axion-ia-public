/**
 * FIX-TABLEAU-FIN-CHOISIE-a (18/11, règle de Williams du 17/11) : une fin choisie qui ne serait ni dite ni écrite bloque
 * « Tout est bon ». Au style par parties (« reference/3 »), la fin choisie dans le formulaire (« Écrivez PLAN en
 * commentaire ») n'a aucun effet si le texte ne la dit pas : elle serait perdue sans un mot. PUR.
 */
import { estStyleReference3, type FicheTableau } from "./fiche";
import { sansAppelAuMot, type IdSortie } from "./formats-sortie";
import type { FinRetenue } from "./relecture";
import { texteDitDe } from "./variantes-fin";

export const LIBELLE_FIN_CHOISIE = "Fin choisie";

const normaliser = (t: string): string => ` ${t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;

/** Message de blocage si la fin choisie de cette sortie n'est pas dans le texte dit ; sinon `null`. */
export function finChoisieAbsente(fiche: FicheTableau, sortie: IdSortie, fin: FinRetenue | undefined): string | null {
  if (!estStyleReference3(fiche)) return null;
  if (sansAppelAuMot(sortie)) return null;
  if (!fin || !("ecran" in fin)) return null;
  if (normaliser(texteDitDe(fiche)).includes(normaliser(fin.ecran))) return null;
  return `La fin choisie « ${fin.ecran} » n'est pas dans votre texte : elle ne serait ni dite ni écrite. Ajoutez-la à la fin du texte, ou choisissez « Aucune ».`;
}
