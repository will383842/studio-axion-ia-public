/**
 * Contrat de la route du site `POST /api/interne/oppositions-par-conv` (import des oppositions connues du site, par conversation).
 * PUR : aucun réseau, aucune base. Lecture STRICTE : toute réponse qui n'est pas exactement celle du contrat vaut « INCONNU »
 * (`null`), jamais « non opposée ».
 */
export const CHEMIN_OPPOSITIONS_PAR_CONV = "/api/interne/oppositions-par-conv";
export const VERSION_OPPOSITIONS_PAR_CONV = 1;
export const LOT_MAX_PAR_CONV = 100;
export const RE_REF_CONV = /^c1_[A-Za-z0-9_-]{22}$/;

/** Corps de la demande, ou `null` si la liste ne respecte pas le contrat (1 à 100 références conformes, sans doublon). */
export function construireCorpsParConv(
  convs: readonly string[],
): string | null {
  if (convs.length < 1 || convs.length > LOT_MAX_PAR_CONV) return null;
  if (convs.some((c) => typeof c !== "string" || !RE_REF_CONV.test(c)))
    return null;
  if (new Set(convs).size !== convs.length) return null;
  return JSON.stringify({ schemaVersion: VERSION_OPPOSITIONS_PAR_CONV, convs });
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const memesCles = (
  o: Record<string, unknown>,
  attendues: readonly string[],
): boolean => {
  const k = Object.keys(o);
  return (
    k.length === attendues.length && attendues.every((a) => Object.hasOwn(o, a))
  );
};

/**
 * Lit la réponse 200 : mêmes références, même ordre, même longueur que la demande, version 1, AUCUN autre champ.
 * Rend un booléen par référence demandée, ou `null` (INCONNU) pour tout écart.
 */
export function lireReponseParConv(
  corps: unknown,
  demandees: readonly string[],
): boolean[] | null {
  if (
    !estObjet(corps) ||
    !memesCles(corps, ["ok", "schemaVersion", "resultats"])
  )
    return null;
  if (corps.ok !== true || corps.schemaVersion !== VERSION_OPPOSITIONS_PAR_CONV)
    return null;
  const r = corps.resultats;
  if (!Array.isArray(r) || r.length !== demandees.length) return null;
  const res: boolean[] = [];
  for (let i = 0; i < r.length; i++) {
    const x: unknown = r[i];
    if (!estObjet(x) || !memesCles(x, ["conv", "opposee"])) return null;
    if (x.conv !== demandees[i] || typeof x.opposee !== "boolean") return null;
    res.push(x.opposee);
  }
  return res;
}
