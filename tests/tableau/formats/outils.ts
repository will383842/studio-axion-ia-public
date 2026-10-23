/**
 * Outils des tests des formats de sortie : une fiche d'exemple calée sur des mots fabriqués (aucune voix), mise en
 * page dans un format, et les propriétés de ses `TableauScene`.
 */
import { calerFicheTableau } from "../../../src/moteurs/montage-tableau/calage";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import type { IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { mettreEnPage, type MiseEnPageTableau } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { proprietesScenes } from "../../../studio-rendu/compositions/tableau/proprietes";
import type { ProprietesTableauScene } from "../../../studio-rendu/compositions/tableau/types";
import { motsFabriques, preuvesExemple } from "../compositions/outils";
import { contexteExemple } from "../regles/exemples";

/** Mise en page et propriétés des scènes d'une fiche d'exemple, dans un format de sortie. */
export function scenesFormat(fiche: FicheTableau, format: IdFormatSortie): { mise: MiseEnPageTableau; scenes: ProprietesTableauScene[] } {
  const r = calerFicheTableau(fiche, motsFabriques(fiche), { contexte: contexteExemple(fiche) });
  if (!r.ok) throw new Error(r.problemes.join("\n"));
  const preuves = preuvesExemple(fiche);
  const mise = mettreEnPage(r.fiche, { preuves, format });
  return { mise, scenes: proprietesScenes({ miseEnPage: mise, scenes: r.fiche.scenes, heures: r.elements, stylo: r.fiche.stylo, preuves }) };
}
