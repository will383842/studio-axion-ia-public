/**
 * ENCODAGE FINAL UNIQUE 8 BITS (plan v4 B.8) : une seule compression 8 bits, à la composition finale. 1080 × 1920,
 * H.264 High, 16 à 20 Mb/s, `aq-mode=3`, tramage léger (diffusion d'erreur à la descente 10 → 8 bits, grain de la
 * recette). Les étapes avant (passe image, assemblage, master) restent en 10 bits quasi sans perte (`source10bits`).
 * Contrôle : aucune bande visible sur le fond.
 */
import type { ParametresExport } from "../composition/scene";

export const ENCODAGE_FACECAM = { debitMbps: [16, 20] as const, crf: 17, fps: 25 } as const;

/** Paramètres d'export face caméra (l'opération `composition` existante ; `source10bits` facultatif). */
export function exportFacecam(base?: Partial<Pick<ParametresExport, "audioKbps" | "audioHz">>): ParametresExport {
  const [min, max] = ENCODAGE_FACECAM.debitMbps;
  return {
    fps: ENCODAGE_FACECAM.fps,
    debitKbps: Math.round(((min + max) / 2) * 1000),
    debitMaxKbps: max * 1000,
    mode: "crf",
    crf: ENCODAGE_FACECAM.crf,
    audioKbps: base?.audioKbps ?? 256,
    audioHz: base?.audioHz ?? 48000,
    source10bits: true,
  };
}
