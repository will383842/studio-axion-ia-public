/**
 * RÉSOLUTION D'UN LOGO D'OUTIL (C8-L01) — lue par le rendu. PURE, ne lève jamais.
 * La table est passée en argument. `null` = repli en texte seul.
 */
import type { DessinLogo } from "./types";

export function resoudreLogo(id: unknown, table: Readonly<Record<string, DessinLogo>> | null | undefined): DessinLogo | null {
  try {
    if (typeof id !== "string" || id === "" || table === null || typeof table !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(table, id)) return null;
    return table[id] ?? null;
  } catch {
    return null;
  }
}
