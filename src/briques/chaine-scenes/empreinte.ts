/**
 * Empreinte des entrées d'une étape d'une chaîne par scènes : JSON aux clés triées, puis sha256 (32 caractères).
 * Même calcul que celui de la chaîne par scènes existante (copie, sans import : brique commune).
 */
import { createHash } from "node:crypto";

/** JSON aux clés triées (les fonctions et les `undefined` sont ignorés) : base des empreintes. */
export function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return typeof v === "function" || v === undefined ? "null" : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined && typeof o[k] !== "function")
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}

/** Empreinte (sha256 hexadécimal, 32 caractères) d'un ensemble d'entrées ; la version de la chaîne en fait partie. */
export function empreinteStable(version: string, ...parts: unknown[]): string {
  return createHash("sha256").update(stable([version, ...parts])).digest("hex").slice(0, 32);
}
