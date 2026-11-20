/** Mot sans casse, sans accent, sans ponctuation : « D'abord » et « dabord » désignent le même mot.
 *  Fichier à part (sans import de `./fiche` ni `./gabarit`) pour casser la boucle d'import fiche ↔ gabarit ↔ fidelite-texte. */
export const cleMot = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
