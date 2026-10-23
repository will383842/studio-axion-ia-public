/** Identifiants. Fonctionne côté serveur (Node) et client (crypto.randomUUID). */
export function nouvelId(prefixe: string): string {
  const brut = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefixe}-${brut}`;
}

/** Code de partage lisible (sans 0/O/1/l). */
export function codePartage(longueur = 8): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const octets = new Uint8Array(longueur);
  globalThis.crypto.getRandomValues(octets);
  return Array.from(octets, (o) => alphabet[o % alphabet.length]).join("");
}
