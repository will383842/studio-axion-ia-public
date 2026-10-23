/**
 * RENDU DE `banque-base7.generee.ts` : le texte exact du fichier que `npm run bases:banque` écrit à partir de la copie
 * JSON de la base 7 (le lien réduit à sa page). PUR (aucune lecture de fichier) : le script l'écrit, le test le rejoue et exige le même texte.
 */
import type { AppelBase } from "./index";

export const CHEMIN_BANQUE_GENEREE = "src/briques/fins/banque-base7.generee.ts";

/**
 * Le gabarit de lien de la base 7 est réduit à la PAGE (sans requête ni ancre) : la requête (`depuis=…`) d'un lien de
 * vidéo n'appartient qu'à `construireLienSuivi` (ADR 0002), jamais à la banque. Une cellule sans lien reste vide.
 */
export function pageDuGabarit(lien: string): string {
  return lien.split(/[?#]/)[0] ?? "";
}

/** La ligne telle qu'elle est écrite dans la banque générée (seul `lien` diffère de la base 7). */
export function ligneDeBanque<T extends { lien: string }>(a: T): T {
  return { ...a, lien: pageDuGabarit(a.lien) };
}

export function rendreBanqueGeneree(appels: readonly AppelBase[], commit: string | null): string {
  const lignes = appels.map((a) => `  ${JSON.stringify(ligneDeBanque(a))},`);
  return [
    "/**",
    " * GÉNÉRÉ — NE PAS MODIFIER À LA MAIN. Table `appel` de la base 7 de l'Usine (états brouillon, proposé, validé, retiré),",
    ` * lue dans la copie JSON du studio (commit source ${commit ?? "inconnu"}). Régénérer : \`npm run bases:banque\`.`,
    " * Une phrase à changer se change d'abord dans la base 7 (le dépôt privé des bases), puis on resynchronise et on régénère ;",
    " * `banque-base7.test.ts` échoue dès que ce fichier s'écarte de la base.",
    " */",
    'import type { AppelBanque } from "./banque";',
    "",
    "export const LIGNES_BASE_7: readonly AppelBanque[] = [",
    ...lignes,
    "];",
    "",
  ].join("\n");
}
