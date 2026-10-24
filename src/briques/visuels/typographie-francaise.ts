// Typographie française (ART-1) : fonction PURE, appliquée à tous les textes de toutes les pages de carrousel.
// Espace fine insécable (U+202F) avant « ? ! ; » ; insécable (U+00A0) avant « : » et « » », après « « ». « : » et « ; » ne sont touchés que
// suivis d'une espace ou de la fin du texte (« 9:30 », « https:// » restent collés). L'apostrophe droite entre deux lettres devient ’.

export const ESPACE_FINE = " ";
export const ESPACE_INSECABLE = " ";

/** Espaces (ordinaire, insécable, fine) qu'un signe double remplace devant ou derrière lui. */
const ESPACES = "[ \\u00a0\\u202f]*";
/** Ce qui doit suivre « : » ou « ; » pour qu'il soit une ponctuation de phrase : une espace (toute espace Unicode) ou la fin du texte. */
const SUIVI_PONCTUATION = "(?=\\s|$)";

export function typographieFrancaise(texte: string): string {
  return (
    texte
      // Apostrophe droite entre deux lettres (« l'IA », « QU'UN ») : apostrophe typographique.
      .replace(/(?<=\p{L})'(?=\p{L})/gu, "’")
      // Devant ? ! : espace fine insécable, sauf en début de texte et derrière un autre ? ou ! (« ?! » reste collé).
      .replace(new RegExp(`(?<=[^\\s?!])${ESPACES}([?!])`, "gu"), `${ESPACE_FINE}$1`)
      // Devant ; et : seulement s'ils ponctuent la phrase (suivis d'une espace ou en fin de texte).
      .replace(new RegExp(`(?<=[^\\s?!])${ESPACES}(;)${SUIVI_PONCTUATION}`, "gu"), `${ESPACE_FINE}$1`)
      .replace(new RegExp(`(?<=[^\\s?!])${ESPACES}(:)${SUIVI_PONCTUATION}`, "gu"), `${ESPACE_INSECABLE}$1`)
      // Guillemets : insécable à l'intérieur.
      .replace(new RegExp(`«${ESPACES}`, "gu"), `«${ESPACE_INSECABLE}`)
      .replace(new RegExp(`(?<=\\S)${ESPACES}»`, "gu"), `${ESPACE_INSECABLE}»`)
  );
}
/** Champs d'une page qui sont des identifiants (énumérations du schéma), jamais du texte affiché. */
const IDENTIFIANTS = new Set(["type", "deco", "mini", "icone"]);

/** Copie de `valeur` (page de carrousel) dont toutes les chaînes de texte passent par `typographieFrancaise`. */
export function espacerPage<T>(valeur: T): T {
  const traiter = (v: unknown, cle?: string): unknown => {
    if (typeof v === "string") return cle && IDENTIFIANTS.has(cle) ? v : typographieFrancaise(v);
    if (Array.isArray(v)) return v.map((x) => traiter(x));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, traiter(x, k)]));
    return v;
  };
  return traiter(valeur) as T;
}
