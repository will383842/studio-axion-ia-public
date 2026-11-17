/**
 * Réglages du dosage de l'animation (X3-02) : `dosageMotion.actif` et `dosageMotion.defauts`.
 * PUR : la lecture est injectée (`LireReglage`), aucun import de service. Tout éteint : seul `true` exact allume ;
 * absent, autre valeur ou lecture en échec = comportement actuel. Rien ne l'appelle en production.
 * Aucune date, aucun hasard.
 */
import { CRANS_PERMIS, DOSAGE_DEFAUT_CODE } from "./crans";
import { DOSAGES } from "./types";
import type { DosageMotion, IdGenerateurDosage } from "./types";

export const CLE_ACTIF = "dosageMotion.actif";
export const CLE_DEFAUTS = "dosageMotion.defauts";

export type LireReglage = (id: string, defaut: unknown) => Promise<unknown>;

const GENERATEURS = Object.keys(CRANS_PERMIS) as IdGenerateurDosage[];

function estDosage(v: unknown): v is DosageMotion {
  return typeof v === "string" && (DOSAGES as readonly string[]).includes(v);
}

function estPermis(generateur: IdGenerateurDosage, v: unknown): v is DosageMotion {
  return estDosage(v) && CRANS_PERMIS[generateur].includes(v);
}

/** Vrai seulement si la valeur lue est exactement `true` ; lecture en échec = faux. */
export async function dosageActif(lire: LireReglage): Promise<boolean> {
  try {
    return (await lire(CLE_ACTIF, false)) === true;
  } catch {
    return false;
  }
}

/** Défauts par générateur ; toute valeur inconnue ou non permise = défaut du code de ce générateur. */
export async function defautsLus(lire: LireReglage): Promise<Record<IdGenerateurDosage, DosageMotion>> {
  let brut: unknown;
  try {
    brut = await lire(CLE_DEFAUTS, {});
  } catch {
    brut = undefined;
  }
  const objet = typeof brut === "object" && brut !== null && !Array.isArray(brut) ? (brut as Record<string, unknown>) : {};
  const out = { ...DOSAGE_DEFAUT_CODE };
  for (const g of GENERATEURS) {
    const v = Object.prototype.hasOwnProperty.call(objet, g) ? objet[g] : undefined;
    if (estPermis(g, v)) out[g] = v;
  }
  return out;
}

/** Choix de la vidéo s'il est permis, sinon défaut du générateur s'il est permis, sinon défaut du code. */
export function dosageRetenu(p: {
  choixVideo?: DosageMotion;
  defautGenerateur?: DosageMotion;
  generateur: IdGenerateurDosage;
}): { dosage: DosageMotion; ramene: boolean } {
  const { generateur, choixVideo, defautGenerateur } = p;
  if (choixVideo !== undefined && estPermis(generateur, choixVideo)) return { dosage: choixVideo, ramene: false };
  const ramene = choixVideo !== undefined;
  if (defautGenerateur !== undefined && estPermis(generateur, defautGenerateur)) return { dosage: defautGenerateur, ramene };
  return { dosage: DOSAGE_DEFAUT_CODE[generateur], ramene };
}
