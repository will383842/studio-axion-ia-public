/**
 * Manrope variable 200 à 800 (SIL OFL 1.1, licence `../commune/polices/OFL-Manrope.txt`) : police unique de la charte
 * Axion 2026, chargée EN LOCAL dans Remotion (aucune dépendance réseau). Le rendu attend le chargement (`delayRender`).
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import { DELAI_DELAYRENDER_MS } from "./commun/attente-police";
import manropeVariable from "../commune/polices/Manrope-Variable.ttf";

export const FAMILLE_MANROPE = "Axion Manrope";

let chargementManrope: Promise<void> | null = null;

export function chargerPoliceManrope(): void {
  if (chargementManrope || typeof document === "undefined") return;
  const attente = delayRender("Police Manrope", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const face = new FontFace(FAMILLE_MANROPE, `url(${manropeVariable})`, { weight: "200 800" });
  chargementManrope = face.load().then(
    (f) => {
      document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Manrope illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementManrope.catch(() => undefined);
}

/** Promesse du chargement de Manrope (lance le chargement si besoin). */
export function policeManropePrete(): Promise<void> {
  chargerPoliceManrope();
  return chargementManrope ?? Promise.resolve();
}
