// [L0-17b] La garde compare à la base COMMUNE avec la branche cible à jour, pas au sommet figé. Dépôt git temporaire, sans réseau.
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const garde = path.resolve(__dirname, "../../outils/gardes/zone-interdite.mjs");
let dir = "";
const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t.invalid", ...a], { cwd: dir, encoding: "utf8" });
const ecrire = (f: string, c = "x\n") => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); };
const valider = (m: string) => { git("add", "-A"); git("commit", "-q", "-m", m); };
const lancer = (...args: string[]) => {
  try { return { code: 0, out: execFileSync("node", [garde, ...args], { cwd: dir, encoding: "utf8" }) }; }
  catch (e) { const x = e as { status: number; stdout: string }; return { code: x.status, out: x.stdout }; }
};

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "garde-base-"));
  git("init", "-q", "-b", "master");
  ecrire("README.md"); valider("init");
  // sommet de la cible à l'ouverture de la PR (celui qui serait « figé »)
  git("checkout", "-q", "-b", "usine/T-1");
  ecrire("src/propre.ts"); valider("travail de la branche");
  // une AUTRE session fusionne un fichier de zone interdite sur la cible
  git("checkout", "-q", "master");
  ecrire("src/services/parcours-autre.ts"); valider("autre session");
  git("checkout", "-q", "usine/T-1");
  fs.mkdirSync(path.join(dir, "liste"));
  fs.writeFileSync(path.join(dir, "liste/T-1.json"), JSON.stringify(["src/propre.ts", "src/services/parcours-propre.ts"]));
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("base commune", () => {
  it("1. un fichier de zone arrivé sur la cible après la création de la branche n'est pas refusé", () => {
    const r = lancer("--cible", "master", "--branche", "usine/T-1", "--listes", "liste");
    expect(r.out).not.toContain("parcours-autre");
    expect(r.code).toBe(0);
  });
  it("2. une branche qui modifie elle-même un fichier de zone reste refusée", () => {
    ecrire("src/services/parcours-propre.ts"); valider("zone interdite");
    const r = lancer("--cible", "master", "--branche", "usine/T-1", "--listes", "liste");
    expect(r.code).toBe(1);
    expect(r.out).toContain("ROUGE [zone-interdite] src/services/parcours-propre.ts");
    expect(r.out).not.toContain("parcours-autre");
  });
  it("sans --cible, --base reste utilisable", () => {
    const r = lancer("--base", "master", "--branche", "usine/T-1", "--listes", "liste");
    expect(r.code).toBe(1);
  });
});
