import { choisirMiseEnLignes, type MiseEnLignes, type OptionsAjustement } from "./ajustement";

/** Texte en capitales selon les règles du français (accents conservés : « échange » → « ÉCHANGE »). */
export function enCapitales(texte: string): string {
  return texte.toLocaleUpperCase("fr-FR");
}

/** Mise en lignes d'un titre EN CAPITALES : le texte est passé en capitales AVANT la mesure (elles sont plus larges que les minuscules). */
export function mettreEnLignesCapitales(
  titre: string,
  mesurer: (lignes: string[], taille: number) => number,
  options: OptionsAjustement & { maxLignes: number; hauteurMax: number },
): MiseEnLignes {
  return choisirMiseEnLignes(enCapitales(titre), mesurer, options);
}
