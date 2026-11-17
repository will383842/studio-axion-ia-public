/**
 * RÉGLAGE « NOTE D'INTÉRÊT DES EXTRAITS » (X4-07). Éteint par défaut : seul `true` exact (ou `{ actif: true }`) allume.
 * Absent, `false`, chaîne, nombre, lecture en échec = éteint. Seuils de départ (décision E4-2) : gardé ≥ 60,
 * « peut-être » de 40 à 59, ignoré < 40, 8 extraits gardés au plus. Seuils hors [0,100], incohérents ou mal typés = défauts.
 * PUR : la lecture est injectée (`lireParametre` côté service).
 */
export const CLE_REGLAGE_NOTE_INTERET = "archiveExtraits.noteInteret";

export type SeuilsNoteInteret = { garde: number; peutEtre: number; gardesMax: number };
export type ReglageNoteInteret = { actif: boolean; seuils: SeuilsNoteInteret };
export type LireReglageNoteInteret = (id: string, defaut: unknown) => Promise<unknown>;

export const SEUILS_PAR_DEFAUT: SeuilsNoteInteret = { garde: 60, peutEtre: 40, gardesMax: 8 };

const dansBornes = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;

function seuilsValides(v: unknown): SeuilsNoteInteret {
  if (typeof v !== "object" || v === null) return { ...SEUILS_PAR_DEFAUT };
  const { garde, peutEtre, gardesMax } = v as Record<string, unknown>;
  if (!dansBornes(garde) || !dansBornes(peutEtre) || peutEtre > garde) return { ...SEUILS_PAR_DEFAUT };
  if (typeof gardesMax !== "number" || !Number.isInteger(gardesMax) || gardesMax < 1) return { ...SEUILS_PAR_DEFAUT };
  return { garde, peutEtre, gardesMax };
}

export async function lireNoteInteret(lire: LireReglageNoteInteret): Promise<ReglageNoteInteret> {
  const eteint: ReglageNoteInteret = { actif: false, seuils: { ...SEUILS_PAR_DEFAUT } };
  let v: unknown;
  try {
    v = await lire(CLE_REGLAGE_NOTE_INTERET, false);
  } catch {
    return eteint;
  }
  if (v === true) return { actif: true, seuils: { ...SEUILS_PAR_DEFAUT } };
  if (typeof v === "object" && v !== null && (v as Record<string, unknown>).actif === true) {
    return { actif: true, seuils: seuilsValides((v as Record<string, unknown>).seuils) };
  }
  return eteint;
}
