/** Les maquettes du lot GM ne s'ouvrent que hors production (vérification E2E-1 n° 10). PUR, testé. */
export function maquettesOuvertes(env: { NODE_ENV?: string } = process.env): boolean {
  return env.NODE_ENV !== "production";
}
