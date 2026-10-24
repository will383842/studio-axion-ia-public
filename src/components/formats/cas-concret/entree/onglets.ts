/**
 * Les trois onglets de la page « Cas concret MD » (refonte du 24/10/2026) : À faire, Déjà faits, Retirés. PUR : lecture de
 * l'adresse (`?onglet=`), adresses des onglets et phrase de synthèse. Des liens serveur, sans état dans le navigateur.
 */

export const ONGLETS = [
  { id: "a-faire", libelle: "À faire" },
  { id: "deja-faits", libelle: "Déjà faits" },
  { id: "retires", libelle: "Retirés" },
] as const;
export type OngletId = (typeof ONGLETS)[number]["id"];

type ParamsBruts = Record<string, string | string[] | undefined> | undefined;

/** `?onglet=deja-faits` ; toute autre valeur (ou aucune) : « À faire ». */
export function lireOnglet(brut: ParamsBruts): OngletId {
  const v = Array.isArray(brut?.onglet) ? brut?.onglet[0] : brut?.onglet;
  return ONGLETS.find((o) => o.id === v)?.id ?? "a-faire";
}

/** L'adresse d'un onglet (« À faire » : l'adresse de la page, sans paramètre). */
export const lienOnglet = (id: OngletId): string => (id === "a-faire" ? "/cas-concret" : `/cas-concret?onglet=${id}`);

const pluriel = (n: number, un: string, plusieurs: string): string => `${n} ${n > 1 ? plusieurs : un}`;

/** « 103 cas à faire · 4 déjà faits · 3 validés » (une ligne sous les onglets). */
export function phraseSyntheseOnglets(c: { aFaire: number; faits: number; valides: number }): string {
  return [pluriel(c.aFaire, "cas à faire", "cas à faire"), pluriel(c.faits, "déjà fait", "déjà faits"), pluriel(c.valides, "validé", "validés")].join(" · ");
}
