/**
 * Polices des visuels de carrousels, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu) :
 * - Archivo Black (SIL OFL 1.1) : titres ;
 * - Inter (SIL OFL 1.1, trois graisses Medium / SemiBold / Bold) : texte courant, étiquettes et légendes ;
 * - Kalam Bold (SIL OFL 1.1, licence `../commune/polices/OFL-Kalam.txt`) : annotations manuscrites (L9), toujours à l'encre.
 * Sources : Archivo Black, dépôt google/fonts, commit 47d54ca1ebb14fd864695f1d39dc734f39017c33 ; Inter, dépôt rsms/inter
 * (licences : OFL-*.txt, à côté des fichiers ; droits : `src/briques/droits/registre/police-inter.ts`).
 * Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import { DELAI_DELAYRENDER_MS } from "./commun/attente-police";
import archivoBlack from "../commune/polices/ArchivoBlack-Regular.ttf";
import interMedium from "../commune/polices/Inter-Medium.ttf";
import interSemiBold from "../commune/polices/Inter-SemiBold.ttf";
import interBold from "../commune/polices/Inter-Bold.ttf";
import kalamBold from "../commune/polices/Kalam-Bold.ttf";

export const FAMILLE_ARCHIVO_BLACK = "Axion Archivo Black";

let chargementArchivoBlack: Promise<void> | null = null;

export function chargerPoliceArchivoBlack(): void {
  if (chargementArchivoBlack || typeof document === "undefined") return;
  const attente = delayRender("Police Archivo Black", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const face = new FontFace(FAMILLE_ARCHIVO_BLACK, `url(${archivoBlack})`, { weight: "400" });
  chargementArchivoBlack = face.load().then(
    (f) => {
      document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Archivo Black illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementArchivoBlack.catch(() => undefined);
}

/** Promesse du chargement de la police (lance le chargement si besoin) : sert à l'attendre, sans sonder `document.fonts`. */
export function policeArchivoBlackPrete(): Promise<void> {
  chargerPoliceArchivoBlack();
  return chargementArchivoBlack ?? Promise.resolve();
}

export const FAMILLE_INTER = "Axion Inter";

/** Graisses d'Inter chargées : Medium (500), SemiBold (600, texte courant), Bold (700, étiquettes). Un fichier par graisse. */
const GRAISSES_INTER = [
  { poids: "500", url: interMedium },
  { poids: "600", url: interSemiBold },
  { poids: "700", url: interBold },
] as const;

let chargementInter: Promise<void> | null = null;

export function chargerPoliceInter(): void {
  if (chargementInter || typeof document === "undefined") return;
  const attente = delayRender("Police Inter", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const faces = GRAISSES_INTER.map(({ poids, url }) => new FontFace(FAMILLE_INTER, `url(${url})`, { weight: poids }));
  chargementInter = Promise.all(faces.map((face) => face.load())).then(
    (chargees) => {
      for (const f of chargees) document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Inter illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementInter.catch(() => undefined);
}

/** Promesse du chargement des trois graisses (lance le chargement si besoin) : sert à l'attendre, sans sonder `document.fonts`. */
export function policeInterPrete(): Promise<void> {
  chargerPoliceInter();
  return chargementInter ?? Promise.resolve();
}

export const FAMILLE_KALAM = "Axion Kalam";

let chargementKalam: Promise<void> | null = null;

/** Kalam Bold : annotations manuscrites des gabarits L9 (jamais un titre, jamais un texte courant). */
export function chargerPoliceKalam(): void {
  if (chargementKalam || typeof document === "undefined") return;
  const attente = delayRender("Police Kalam", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const face = new FontFace(FAMILLE_KALAM, `url(${kalamBold})`, { weight: "700" });
  chargementKalam = face.load().then(
    (f) => {
      document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Kalam illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementKalam.catch(() => undefined);
}

/** Promesse du chargement de Kalam, ou `undefined` si la page ne l'a pas demandée (aucune attente inutile). */
export function policeKalamPrete(): Promise<void> | undefined {
  return chargementKalam ?? undefined;
}
