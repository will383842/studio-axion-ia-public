/**
 * Noir et blanc narratif sur des plages de temps données (C10-05). PUR : aucun import `@/…` (lu par le rendu).
 * Écrit l'étape FFmpeg `hue=s=0` limitée par `enable`, comme les LUT. NON BRANCHÉ : aucun appelant ne la passe ;
 * l'allumage viendra par une fiche future, éteinte par défaut. Jamais la v4.
 */

/** Une plage [début, fin) en secondes. */
export type PlageNoirBlanc = [debutSec: number, finSec: number];

/** Trie, borne dans [0, durée], retire les plages vides ou invalides, fusionne les chevauchements. */
export function normaliserPlagesNoirBlanc(plages: PlageNoirBlanc[], dureeSec: number): PlageNoirBlanc[] {
  if (!Number.isFinite(dureeSec) || dureeSec <= 0) return [];
  const bornees: PlageNoirBlanc[] = [];
  for (const [a, b] of plages) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const d = Math.max(0, a);
    const f = Math.min(dureeSec, b);
    if (f > d) bornees.push([d, f]);
  }
  bornees.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const fusion: PlageNoirBlanc[] = [];
  for (const [d, f] of bornees) {
    const dernier = fusion[fusion.length - 1];
    if (dernier && d <= dernier[1]) dernier[1] = Math.max(dernier[1], f);
    else fusion.push([d, f]);
  }
  return fusion;
}

/** Étape FFmpeg `hue=s=0:enable='…'` (même forme d'expression que `expressionPlages` de `ffmpeg.ts`), ou `null`. */
export function etapeNoirBlanc(plages: PlageNoirBlanc[]): string | null {
  if (!plages.length) return null;
  const expr = plages.map(([a, b]) => `gte(t\\,${a.toFixed(3)})*lt(t\\,${b.toFixed(3)})`).join("+");
  return `hue=s=0:enable='${expr}'`;
}
