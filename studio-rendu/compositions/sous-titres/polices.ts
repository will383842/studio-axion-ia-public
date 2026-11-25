/**
 * Polices des sous-titres, chargées EN LOCAL dans Remotion (aucune dépendance réseau au rendu, B.5) : les mêmes
 * fichiers que l'aperçu du navigateur (`src/briques/sous-titres/polices/`, licence SIL OFL 1.1).
 * Le rendu attend leur chargement (`delayRender`) : jamais une image avec une police de secours.
 */
import { cancelRender, continueRender, delayRender } from "remotion";
import type { NomPolice } from "../../../src/briques/sous-titres/mesure";
import manropeBold from "../../../src/briques/sous-titres/polices/Manrope-Bold.ttf";
import manropeExtraBold from "../../../src/briques/sous-titres/polices/Manrope-ExtraBold.ttf";
import manropeMedium from "../../../src/briques/sous-titres/polices/Manrope-Medium.ttf";
import manropeSemiBold from "../../../src/briques/sous-titres/polices/Manrope-SemiBold.ttf";
import manropeVariable from "../../../src/briques/sous-titres/polices/Manrope-Variable.ttf";

/** Nom CSS de chaque police dans le rendu (une famille par fichier : aucune synthèse de graisse). */
export const FAMILLES: Record<NomPolice, string> = {
  "Manrope Bold": "Axion Manrope Bold",
  "Manrope ExtraBold": "Axion Manrope ExtraBold",
  "Manrope Medium": "Axion Manrope Medium",
  "Manrope SemiBold": "Axion Manrope SemiBold",
};

const FICHIERS: Record<NomPolice, string> = {
  "Manrope Bold": manropeBold,
  "Manrope ExtraBold": manropeExtraBold,
  "Manrope Medium": manropeMedium,
  "Manrope SemiBold": manropeSemiBold,
};

/** Une promesse par police : une police déjà demandée n'est pas rechargée. */
const chargements = new Map<NomPolice, Promise<void>>();

/** Charge à la demande les graisses voulues (par défaut Medium et ExtraBold), une fois par page de rendu. */
export function chargerPolices(noms: readonly NomPolice[] = ["Manrope Medium", "Manrope ExtraBold"]): void {
  if (typeof document === "undefined") return;
  for (const nom of noms) {
    if (chargements.has(nom)) continue;
    const attente = delayRender(`Police des sous-titres : ${nom}`);
    chargements.set(
      nom,
      (async () => {
        const face = new FontFace(FAMILLES[nom], `url(${FICHIERS[nom]})`);
        await face.load();
        document.fonts.add(face);
      })().then(
        () => continueRender(attente),
        (e: unknown) => {
          const err = new Error(`Police illisible (${FAMILLES[nom]}) : ${e instanceof Error ? e.message : String(e)}`);
          cancelRender(err);
          throw err;
        },
      ),
    );
  }
}

/** BR-POIDS-VARIABLE-IV-a : famille CSS de Manrope Variable (axe de graisse 200 à 800), pour le mot qui s'épaissit. */
export const FAMILLE_VARIABLE = "Axion Manrope Variable";
let chargementVariable: Promise<void> | null = null;

/** Charge Manrope Variable une seule fois (même patron que `chargerPolices`) ; appelée seulement quand `poidsVariable` est posé. */
export function chargerPoliceVariable(): void {
  if (typeof document === "undefined" || chargementVariable) return;
  const attente = delayRender("Police des sous-titres : Manrope Variable");
  chargementVariable = (async () => {
    const face = new FontFace(FAMILLE_VARIABLE, `url(${manropeVariable})`, { weight: "200 800" });
    await face.load();
    document.fonts.add(face);
  })().then(
    () => continueRender(attente),
    (e: unknown) => {
      const err = new Error(`Police illisible (${FAMILLE_VARIABLE}) : ${e instanceof Error ? e.message : String(e)}`);
      cancelRender(err);
      throw err;
    },
  );
}
