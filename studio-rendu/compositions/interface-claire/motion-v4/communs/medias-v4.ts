import { getInputProps, staticFile } from "remotion";

/**
 * ADRESSE D'UN MÉDIA des plaquettes v4 (polices, `sons/`, `broll/`, `marque/`, prise montée) — Lot I, 17/10/2026.
 *
 * En production, le service de rendu ne bâtit PAS de dossier public : il sert ces fichiers par HTTP (`servirDossier`, opération
 * `composition` en mode `facecam-v4`) et passe leur adresse dans les props de la composition (`mediasBase`, sans barre finale).
 * Sans `mediasBase` (studio Remotion, planches des lots, répétition `rendre-repetition.mjs`) : `staticFile`, comme avant.
 * `getInputProps` est lu à l'appel (il marche aussi au chargement du module : les polices de `briques-v4` sont chargées à l'import).
 */
function baseMedias(): unknown {
  try {
    return (getInputProps() as { mediasBase?: unknown } | undefined)?.mediasBase;
  } catch {
    return undefined;
  }
}

/** Vrai pour un rendu v4 de production (le service de rendu a passé `mediasBase`) : seul cas où une police manquante compte. */
export function rendu4DeProduction(): boolean {
  const base = baseMedias();
  return typeof base === "string" && !!base;
}

export function mediaV4(chemin: string): string {
  const base = baseMedias();
  if (typeof base !== "string" || !base) return staticFile(chemin);
  return `${base.replace(/\/+$/, "")}/${chemin.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`;
}

/** Décision de Will (17/10/2026) : la voix doit dominer. Tous les bruitages v4 sont baissés de 4 dB (multiplicateur de volume). */
export const BAISSE_BRUITAGES_DB = 4;
export const GAIN_BRUITAGES = Math.pow(10, -BAISSE_BRUITAGES_DB / 20);
