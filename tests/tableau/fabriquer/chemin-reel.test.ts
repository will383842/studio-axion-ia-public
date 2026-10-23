/**
 * Essai réel du 11/10 : `--reel` plantait au chargement hors de Next (`credits` → `auth` → `next/navigation`,
 * « _react.default.createContext is not a function »). Le chemin réel est chargé ici pour de vrai, dans un processus
 * `tsx --conditions=react-server` (la commande documentée), jusqu'aux imports : aucun appel, aucun réseau.
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, it } from "vitest";

const RACINE = join(__dirname, "../../..");

it("le chemin --reel se charge hors de Next (bouchons de next/* posés par le lanceur)", () => {
  const env = { ...process.env, DATABASE_URL: "", STUDIO_RENDU_URL: "", HEYGEN_API_KEY: "" };
  const r = spawnSync(join(RACINE, "node_modules/.bin/tsx"), ["--conditions=react-server", join(__dirname, "charger-reel.ts")], { cwd: RACINE, env, encoding: "utf8", timeout: 55_000 });
  expect(r.stderr).not.toContain("createContext");
  expect(r.stdout).toContain("CHARGE");
  expect(r.stdout).toContain("credits");
  expect(r.status).toBe(0);
}, 60_000);
