/**
 * Police de l'encadré de titre et des incrustations (Inter Bold, SIL OFL 1.1), chargée EN LOCAL dans Remotion :
 * aucune dépendance réseau au rendu. Le rendu attend son chargement (jamais une image avec une police de secours).
 */
import { continueRender, delayRender } from "remotion";
import anton from "./polices/Anton-Regular.ttf";
import interBold from "./polices/Inter-Bold.ttf";
import interMedium from "./polices/Inter-Medium.ttf";
import interSemiBold from "./polices/Inter-SemiBold.ttf";
import montserratExtraBold from "./polices/Montserrat-ExtraBold.ttf";

export const FAMILLE_TITRE = "Axion Inter Bold";

let chargement: Promise<void> | null = null;

export function chargerPoliceTitre(): void {
  if (chargement || typeof document === "undefined") return;
  const attente = delayRender("Police de l'encadré");
  const face = new FontFace(FAMILLE_TITRE, `url(${interBold})`);
  chargement = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}

/** Montserrat ExtraBold (800, SIL OFL 1.1) : police des titres de la charte vidéo « tableau animé » (`charte-video/1`). */
export const FAMILLE_MONTSERRAT = "Axion Montserrat ExtraBold";

let chargementMontserrat: Promise<void> | null = null;

export function chargerPoliceMontserrat(): void {
  if (chargementMontserrat || typeof document === "undefined") return;
  const attente = delayRender("Police Montserrat");
  const face = new FontFace(FAMILLE_MONTSERRAT, `url(${montserratExtraBold})`, { weight: "800" });
  chargementMontserrat = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}

/** Anton Regular (SIL OFL 1.1) : police d'affiche de la charte `charte-duo/1` (format « Cas concret MD »). */
export const FAMILLE_ANTON = "Axion Anton";

let chargementAnton: Promise<void> | null = null;

export function chargerPoliceAnton(): void {
  if (chargementAnton || typeof document === "undefined") return;
  const attente = delayRender("Police Anton");
  const face = new FontFace(FAMILLE_ANTON, `url(${anton})`, { weight: "400" });
  chargementAnton = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}

/** Inter Medium (500, SIL OFL 1.1) : détails et mentions du tableau « reference/3 » (charte Axion, 15/10/2026). */
export const FAMILLE_INTER_MEDIUM = "Axion Inter Medium";

let chargementInterMedium: Promise<void> | null = null;

export function chargerPoliceInterMedium(): void {
  if (chargementInterMedium || typeof document === "undefined") return;
  const attente = delayRender("Police Inter Medium");
  const face = new FontFace(FAMILLE_INTER_MEDIUM, `url(${interMedium})`, { weight: "500" });
  chargementInterMedium = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}

/** Inter SemiBold (600, SIL OFL 1.1) : noms des chapitres de la barre du tableau « reference/3 » (choix de Will, 15/10/2026). */
export const FAMILLE_INTER_SEMIBOLD = "Axion Inter SemiBold";

let chargementInterSemiBold: Promise<void> | null = null;

export function chargerPoliceInterSemiBold(): void {
  if (chargementInterSemiBold || typeof document === "undefined") return;
  const attente = delayRender("Police Inter SemiBold");
  const face = new FontFace(FAMILLE_INTER_SEMIBOLD, `url(${interSemiBold})`, { weight: "600" });
  chargementInterSemiBold = face.load().then((f) => {
    document.fonts.add(f);
    continueRender(attente);
  });
}
