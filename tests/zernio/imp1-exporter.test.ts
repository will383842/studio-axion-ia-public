import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = new URL("../../", import.meta.url).pathname;
const ENV = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } as unknown as NodeJS.ProcessEnv;
const SCRIPT = join(RACINE, "outils/import-buffer/exporter.mts");

describe("IMP-1 exporter.mts", () => {
  it("le script ne touche ni fichier ni R2 sans --ecrire (mode à blanc) et journalise « lu » sans --medias", () => {
    const src = readFileSync(SCRIPT, "utf8");
    // écritures et R2 uniquement derrière --ecrire / --medias
    expect(src).toMatch(/if \(veutMedias && aBlanc\) throw/);
    expect(src).toMatch(/if \(dossier\) \{[\s\S]*writeFileSync/);
    expect(src.indexOf("writeFileSync(join")).toBeGreaterThan(src.indexOf("if (dossier) {"));
    expect(src).toMatch(/if \(!veutMedias\) \{[\s\S]*etat: "lu"/);
    expect(src).toMatch(/\} else \{[\s\S]*configR2\(\)/);
  });

  it("exécution réelle à blanc : cle absente -> échec propre, aucun fichier créé", () => {
    const cwd = mkdtempSync(join(tmpdir(), "imp1-"));
    writeFileSync(join(cwd, ".garde"), "");
    const r = spawnSync("pnpm", ["exec", "tsx", SCRIPT], { cwd: RACINE, env: ENV, encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(existsSync(join(RACINE, "rapport.txt"))).toBe(false);
    expect(readdirSync(cwd)).toEqual([".garde"]);
  });

  it("--medias sans --ecrire est refusé", () => {
    const r = spawnSync("pnpm", ["exec", "tsx", SCRIPT, "--medias"], { cwd: RACINE, env: ENV, encoding: "utf8" });
    expect(r.status).not.toBe(0);
    expect(`${r.stderr}${r.stdout}`).toContain("--medias exige --ecrire");
  });
});
