/**
 * Compare l'horodatage HeyGen (`word_timestamps`) à un alignement forcé WhisperX, phrase par phrase (plan B.5).
 * Décision : écart moyen ≤ 80 ms → horodatage HeyGen suffisant ; au-delà → construire `studio-aligneur` (lot à part).
 *
 * Usage : pnpm exec tsx outils/alignement/comparer.ts a.heygen.json a.whisperx.json [b.heygen.json b.whisperx.json …]
 * Un fichier HeyGen peut être la réponse brute (`{ data: { word_timestamps: [{ word, start, end }] } }`) ou la liste
 * déjà convertie (`[{ mot, debutSec, finSec }]`).
 */
import { readFileSync } from "node:fs";
import type { MotHorodate } from "../../src/domaine/types";
import { ecartMoyenMs } from "../../src/moteurs/montage-avocat/report";

export const SEUIL_ALIGNEUR_MS = 80;

type Brut = { word?: string; start?: number; end?: number; mot?: string; debutSec?: number; finSec?: number };

export function lireMots(json: unknown): MotHorodate[] {
  const j = json as { data?: { word_timestamps?: Brut[] }; word_timestamps?: Brut[] } | Brut[];
  const liste: Brut[] = Array.isArray(j) ? j : (j.data?.word_timestamps ?? j.word_timestamps ?? []);
  return liste.map((m) => ({ mot: m.mot ?? m.word ?? "", debutSec: m.debutSec ?? m.start ?? 0, finSec: m.finSec ?? m.end ?? 0 })).filter((m) => m.mot.trim());
}

if (process.argv.length >= 4) {
  const fichiers = process.argv.slice(2);
  const ecarts: number[] = [];
  for (let i = 0; i + 1 < fichiers.length; i += 2) {
    const heygen = lireMots(JSON.parse(readFileSync(fichiers[i], "utf8")));
    const reference = lireMots(JSON.parse(readFileSync(fichiers[i + 1], "utf8")));
    const e = ecartMoyenMs(heygen, reference);
    ecarts.push(e);
    console.log(`${fichiers[i]} : ${heygen.length} mots, écart moyen ${e} ms`);
  }
  const moyen = Math.round(ecarts.reduce((s, x) => s + x, 0) / Math.max(1, ecarts.length));
  console.log(`Écart moyen sur ${ecarts.length} phrase(s) : ${moyen} ms (cible < 40 ms, seuil ${SEUIL_ALIGNEUR_MS} ms).`);
  console.log(moyen > SEUIL_ALIGNEUR_MS ? "→ Construire studio-aligneur (lot à part, à signaler)." : "→ Horodatage HeyGen suffisant : aucun conteneur Python.");
}
