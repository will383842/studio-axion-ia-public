import { createHash } from "node:crypto";

/** Clé d'un média déjà écrite par le rendu : elle est gardée telle quelle (on n'invente aucune clé). */
export function cleMediaRendu(cle: string): string {
  if (typeof cle !== "string" || cle === "" || cle.startsWith("/") || cle.includes("\\") || cle.split("/").some((s) => s === "" || s === "." || s === "..")) {
    throw new Error("Clé de média invalide.");
  }
  return cle;
}

/** Identifiant de Fichier fixé par la clé : la même clé redonne le même identifiant, donc un rejeu ne duplique rien. */
export function idFichierDeCle(cle: string): string {
  return `f-${createHash("sha256").update(cleMediaRendu(cle)).digest("hex").slice(0, 32)}`;
}

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf", mp4: "video/mp4" };

export function typeMimeDeCle(cle: string): string {
  const ext = cle.split("/").pop()?.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}
