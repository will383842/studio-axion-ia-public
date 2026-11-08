/**
 * Polices des visuels de carrousels, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu) :
 * - Inter Display Black (SIL OFL 1.1, version optique d'Inter pour les grands corps) : titres en capitales (ART-1, style C + A) ;
 * - Inter (SIL OFL 1.1, trois graisses Medium / SemiBold / Bold) : texte courant, étiquettes et légendes ;
 * - Kalam Bold (SIL OFL 1.1, licence `../commune/polices/OFL-Kalam.txt`) : annotations manuscrites (L9), toujours à l'encre.
 * Sources : Inter et Inter Display, dépôt rsms/inter (Inter 4.1 pour Inter Display Black : sous-ensemble latin, crénage conservé)
 * (licences : OFL-*.txt, à côté des fichiers ; droits : `src/briques/droits/registre/police-inter.ts`).
 * L'espace fine insécable (U+202F, `typographie-francaise.ts`) manque à Inter Bold et à Kalam : une face limitée à U+202F (`unicodeRange`)
 * la prend dans Inter SemiBold, jamais dans une police de secours.
 * Le rendu attend le chargement (jamais une image avec une police de secours).
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import { DELAI_DELAYRENDER_MS } from "./commun/attente-police";
import interDisplayBlack from "../commune/polices/InterDisplay-Black.ttf";
import interMedium from "../commune/polices/Inter-Medium.ttf";
import interSemiBold from "../commune/polices/Inter-SemiBold.ttf";
import interBold from "../commune/polices/Inter-Bold.ttf";
import kalamBold from "../commune/polices/Kalam-Bold.ttf";

/** Espace fine insécable : absente d'Inter Bold et de Kalam, prise dans Inter SemiBold (même dessin, même chasse à un pixel près). */
const PLAGE_ESPACE_FINE = "U+202F";

export const FAMILLE_TITRE = "Axion Inter Display";

let chargementTitre: Promise<void> | null = null;

/** Inter Display Black (900) : titres en capitales, numéros de rang. */
export function chargerPoliceTitre(): void {
  if (chargementTitre || typeof document === "undefined") return;
  const attente = delayRender("Police Inter Display Black", { timeoutInMilliseconds: DELAI_DELAYRENDER_MS });
  const face = new FontFace(FAMILLE_TITRE, `url(${interDisplayBlack})`, { weight: "900" });
  chargementTitre = face.load().then(
    (f) => {
      document.fonts.add(f);
      continueRender(attente);
    },
    (e: unknown) => {
      const err = new Error(`Police Inter Display Black illisible : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
  chargementTitre.catch(() => undefined);
}

/** Promesse du chargement de la police des titres (lance le chargement si besoin) : sert à l'attendre, sans sonder `document.fonts`. */
export function policeTitrePrete(): Promise<void> {
  chargerPoliceTitre();
  return chargementTitre ?? Promise.resolve();
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
  const faces = [
    ...GRAISSES_INTER.map(({ poids, url }) => new FontFace(FAMILLE_INTER, `url(${url})`, { weight: poids })),
    new FontFace(FAMILLE_INTER, `url(${interSemiBold})`, { weight: "700", unicodeRange: PLAGE_ESPACE_FINE }),
  ];
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
  const faces = [new FontFace(FAMILLE_KALAM, `url(${kalamBold})`, { weight: "700" }), new FontFace(FAMILLE_KALAM, `url(${interSemiBold})`, { weight: "700", unicodeRange: PLAGE_ESPACE_FINE })];
  chargementKalam = Promise.all(faces.map((face) => face.load())).then(
    (chargees) => {
      for (const f of chargees) document.fonts.add(f);
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
