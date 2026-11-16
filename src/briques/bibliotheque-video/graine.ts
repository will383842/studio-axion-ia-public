/**
 * Graine et départage (C1-U4) : tout est dérivé d'un sha256, jamais d'un hasard ni d'une horloge.
 * Module côté Studio seulement : jamais importé par `studio-rendu/**`.
 */
import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Graine stable : même parties, même graine. */
export function graineDe(...parties: string[]): string {
  return sha256(parties.join("|"));
}

/** Rang de départage d'une clé sous une graine : ordre total (comparer les chaînes). */
export function rangGraine(graine: string, cle: string): string {
  return sha256(graine + ":" + cle);
}
