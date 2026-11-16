/**
 * ENTRÉES D'UNE DÉMO FACECAM À SA CRÉATION (G3-05) — fabrique les `video.entrees` : `{ demoFacecam }` toujours, et
 * `facecamAligneurReel: true` SEULEMENT si le réglage `demoFacecam.reel` vaut exactement `true`.
 * Éteint par défaut : réglage absent, `false`, texte « true » ou lecture en échec → rien d'ajouté.
 * Personne ne l'appelle encore ; aucun appel à Claude, aucun coût.
 */
import { lireParametre } from "./_commun";

/** Clé du réglage (absente de `reglages.ts` : lue ici seulement). */
export const CLE_REGLAGE_DEMO_REEL = "demoFacecam.reel";

export type DemoFacecamBrut = Record<string, unknown>;

export type EntreesCreationDemoFacecam = {
  demoFacecam: DemoFacecamBrut;
  facecamAligneurReel?: true;
};

export async function fabriquerEntreesDemoFacecam(demoFacecam: DemoFacecamBrut): Promise<EntreesCreationDemoFacecam> {
  const entrees: EntreesCreationDemoFacecam = { demoFacecam: structuredClone(demoFacecam) };
  let reel = false;
  try {
    reel = (await lireParametre<unknown>(CLE_REGLAGE_DEMO_REEL, false)) === true;
  } catch {
    reel = false;
  }
  if (reel) entrees.facecamAligneurReel = true;
  return entrees;
}
