/**
 * Chargement des CLÉS des essais réels du lot A2 depuis `~/.claude/secrets/studio.env` (hors dépôt), dans
 * l'environnement de CE processus seulement. Rien n'est affiché ni écrit : on ne dit que « présente / absente ».
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function chargerCles(noms: string[]): Record<string, boolean> {
  const chemin = process.env.STUDIO_SECRETS ?? join(homedir(), ".claude", "secrets", "studio.env");
  const presentes: Record<string, boolean> = {};
  if (existsSync(chemin)) {
    for (const ligne of readFileSync(chemin, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/.exec(ligne);
      if (m && noms.includes(m[1]) && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\s+/g, ""); // une clé n'a jamais d'espace (copier-coller coupé)
    }
  }
  for (const n of noms) presentes[n] = !!process.env[n];
  return presentes;
}
