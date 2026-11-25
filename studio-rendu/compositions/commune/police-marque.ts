/**
 * POLICES-RENDU-v20l : UN chargeur de la police de marque (Manrope variable 200 à 800, SIL OFL 1.1, licence
 * `./polices/OFL-Manrope.txt`), enregistrée sous ses deux noms (celui de la charte et le nom court) et attendue par le
 * rendu. Un fichier illisible ARRÊTE le rendu (`cancelRender`) : jamais une vidéo en police de secours.
 * Rien ne s'exécute au niveau du module ; sans navigateur (`document` absent) rien n'est chargé.
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import manropeVariable from "./polices/Manrope-Variable.ttf";

const DELAI_MS = 30_000;

let chargement: Promise<void> | null = null;

export function chargerPoliceMarque(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police Manrope", { timeoutInMilliseconds: DELAI_MS });
  // Noms écrits en clair (lus par le cliquet `tests/polices/familles-enregistrees.test.ts`) ; égaux à FAMILLE_CSS et POLICE de la charte (test).
  const faces = [
    new FontFace("Axion Manrope", `url(${manropeVariable})`, { weight: "200 800" }),
    new FontFace("Manrope", `url(${manropeVariable})`, { weight: "200 800" }),
  ];
  chargement = Promise.all(faces.map((f) => f.load())).then(
    (chargees) => {
      for (const f of chargees) document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Manrope illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargement.catch(() => undefined);
}

/** Promesse du chargement de la police de marque (le lance si besoin). */
export function policeMarquePrete(): Promise<void> {
  chargerPoliceMarque();
  return chargement ?? Promise.resolve();
}
