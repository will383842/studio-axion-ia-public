// Variante de la dernière page sombre (T21) : choisie par le CODE à partir du titre de couverture, pour que la page change d'un
// carrousel à l'autre sans que le spec la fournisse. Chaque variante a un sens (une conversation, une bulle de message, le texte seul).
export const VARIANTES_T21 = ["conversation", "bulle", "typographie"] as const;
export type VarianteT21 = (typeof VARIANTES_T21)[number];

/** Titre comparé sans casse, sans accents, espaces réduits. */
const cle = (titre: string): string =>
  titre.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();

/** Variante de T21 pour ce titre de couverture : hachage FNV-1a (32 bits) du titre, déterministe. */
export function varianteT21(titreCouverture: string): VarianteT21 {
  let h = 0x811c9dc5;
  for (const c of cle(titreCouverture)) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return VARIANTES_T21[h % VARIANTES_T21.length]!;
}
