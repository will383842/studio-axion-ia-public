// Réglage `varieteCommune` (X2-05), éteint par défaut. Seul `true` ou `{ seuil }` allume.
// Fichier pur : la lecture est fournie par l'appelant. Absent de la table = éteint.
// Fenêtre, prêtes comptées et repli sont figés (décisions E2-1, E2-2, E2-3) : non réglables.
export const CLE_VARIETE_COMMUNE = "varieteCommune";
export const FENETRE_VARIETE_COMMUNE = 10;
export const PRETES_COMPTEES = true;
export const REPLI_VARIETE_COMMUNE = "moins-ressemblante" as const;
export const SEUIL_DEFAUT = 0.5;
export const SEUIL_MIN = 0.3;
export const SEUIL_MAX = 0.9;

export type ReglageVarieteCommune =
  | { actif: false }
  | { actif: true; seuil: number; fenetre: 10; pretesNonPubliees: true; repli: "moins-ressemblante" };

function allume(seuil: number): ReglageVarieteCommune {
  return { actif: true, seuil, fenetre: 10, pretesNonPubliees: true, repli: REPLI_VARIETE_COMMUNE };
}

export function interpreterReglageVarieteCommune(v: unknown): ReglageVarieteCommune {
  try {
    if (v === true) return allume(SEUIL_DEFAUT);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return { actif: false };
    const cles = Object.keys(v);
    if (cles.length !== 1 || cles[0] !== "seuil") return { actif: false };
    const s = (v as { seuil: unknown }).seuil;
    if (typeof s !== "number" || !Number.isFinite(s)) return { actif: false };
    return allume(Math.min(SEUIL_MAX, Math.max(SEUIL_MIN, s)));
  } catch {
    return { actif: false };
  }
}

export async function lireReglageVarieteCommune(
  lire: (cle: string) => Promise<unknown>,
): Promise<ReglageVarieteCommune> {
  try {
    return interpreterReglageVarieteCommune(await lire(CLE_VARIETE_COMMUNE));
  } catch {
    return { actif: false };
  }
}
