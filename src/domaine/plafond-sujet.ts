/** Affichage d'un plafond en dollars, partagé par l'écran (client) et le journal (serveur) : pur, sans accès à la base. */

/** « 1,234 $ » : 2 décimales au moins, 4 au plus, sans arrondir en dessous. */
export const formaterUsd = (usd: number): string => {
  const [entier, dec = ""] = usd.toFixed(4).split(".");
  return `${entier},${dec.replace(/0{1,2}$/, "").padEnd(2, "0")} $`;
};
