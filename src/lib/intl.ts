/**
 * Formateurs Intl PARTAGÉS (mémoire native, 17/10). PUR.
 *
 * Un `new Intl.DateTimeFormat(…)` coûte ~16 Ko de mémoire NATIVE (ICU, malloc), invisible pour V8 : elle n'est rendue
 * qu'au ramasse-miettes de l'objet, que V8 ne déclenche pas pour elle. Créé à chaque appel (un par dépense dans le budget
 * de l'accueil, rafraîchi toutes les 4 s), il entassait des centaines de milliers de formateurs morts entre deux
 * ramasse-miettes : 1,2 Go dans le tas malloc de glibc, jamais rendu au système (docs/memoire-native/COMPTE-RENDU.md).
 * Ici, un seul formateur par réglage, réutilisé (`format` n'a pas d'état : sûr entre requêtes).
 * Garde-fou : tests/memoire-intl.test.ts refuse tout `new Intl.…` ailleurs qu'au niveau du module.
 */
const formateurs = new Map<string, unknown>();

function partage<T>(genre: string, locale: string, options: object | undefined, creer: () => T): T {
  const cle = `${genre}|${locale}|${options ? JSON.stringify(options) : ""}`;
  let f = formateurs.get(cle) as T | undefined;
  if (!f) {
    f = creer();
    formateurs.set(cle, f);
  }
  return f;
}

export function formateurDate(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return partage("date", locale, options, () => new Intl.DateTimeFormat(locale, options));
}

export function formateurNombre(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return partage("nombre", locale, options, () => new Intl.NumberFormat(locale, options));
}

export function formateurRelatif(locale: string, options?: Intl.RelativeTimeFormatOptions): Intl.RelativeTimeFormat {
  return partage("relatif", locale, options, () => new Intl.RelativeTimeFormat(locale, options));
}

export function formateurNoms(locale: string, options: Intl.DisplayNamesOptions): Intl.DisplayNames {
  return partage("noms", locale, options, () => new Intl.DisplayNames(locale, options));
}
