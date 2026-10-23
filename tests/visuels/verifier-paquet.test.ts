import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { creerFournisseurSimulation } from "@/visuels/texte/simulation";

const SCRIPT = join(process.cwd(), "scripts/visuels/verifier-paquet.ts");

function lancer(contenu: string) {
  const dossier = mkdtempSync(join(tmpdir(), "paquet-"));
  const fichier = join(dossier, "paquet.json");
  writeFileSync(fichier, contenu);
  return spawnSync("npx", ["tsx", "--tsconfig", join(process.cwd(), "tsconfig.json"), SCRIPT, fichier], { encoding: "utf8", cwd: process.cwd(), shell: process.platform === "win32" });
}

async function paquetValide() {
  const sujet = "Ranger un atelier sans y passer la journée";
  const r = await creerFournisseurSimulation().ecrire({ type: "sujet", sujet });
  return { version: "paquet-session-carrousel/1", sujet, titre: r.titre, pourquoi: r.pourquoi, spec: r.spec };
}

describe("verifier-paquet (CLI)", () => {
  it("un paquet valide : rapport lisible, sortie 0", async () => {
    const r = lancer(JSON.stringify(await paquetValide()));
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/Verdict/);
  }, 60_000);

  it("un paquet rouge (chiffre écrit) : sortie 1 et phrase en français", async () => {
    const p = await paquetValide();
    (p.spec as { pages: { titre?: string }[] }).pages[0].titre = "Ranger en 5 minutes";
    const r = lancer(JSON.stringify(p));
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/chiffre/i);
  }, 60_000);

  it("un interdit de tous les écrivains (certification revendiquée) : sortie 1, jamais vert", async () => {
    const p = await paquetValide();
    (p.spec as { pages: { titre?: string }[] }).pages[0].titre = "Atelier certifié Certifexemple";
    const r = lancer(JSON.stringify(p));
    expect(r.status, r.stdout + r.stderr).toBe(1);
    expect(r.stdout).toMatch(/ROUGE/);
  }, 60_000);

  it("un JSON illisible : sortie 1 avec explication", () => {
    const r = lancer("{pas du json");
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toMatch(/JSON/);
  }, 60_000);
});
