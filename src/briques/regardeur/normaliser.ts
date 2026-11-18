/** Minuscules, sans accents, tout ce qui n'est pas lettre ou chiffre devient une espace, espaces réduites. */
export function normaliser(t: string): string {
  return t
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mots de `normaliser(t)` d'au moins `min` caractères. */
export function mots(t: string, min = 1): string[] {
  const n = normaliser(t);
  return n === "" ? [] : n.split(" ").filter((m) => m.length >= min);
}
