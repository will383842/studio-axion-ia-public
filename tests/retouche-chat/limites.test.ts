import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creerLimiteur, creerVerrouApplication } from "@/services/retouche-chat/limites";

describe("limiteur de débit", () => {
  it("accepte 5 demandes, refuse la 6e, puis accepte de nouveau après la fenêtre", () => {
    let t = 1000;
    const l = creerLimiteur({ maxParFenetre: 5, fenetreMs: 60_000, maintenant: () => t });
    for (let i = 0; i < 5; i++) expect(l.verifier("v1")).toEqual({ ok: true });
    const r = l.verifier("v1");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reessayerDansSec).toBeGreaterThan(0);
      expect(r.reessayerDansSec).toBeLessThanOrEqual(60);
      expect(r.phrase).not.toMatch(/€|euro|prix/i);
    }
    t += 60_001;
    expect(l.verifier("v1")).toEqual({ ok: true });
  });
  it("les clés sont indépendantes", () => {
    const l = creerLimiteur({ maxParFenetre: 1, fenetreMs: 1000, maintenant: () => 0 });
    expect(l.verifier("a").ok).toBe(true);
    expect(l.verifier("a").ok).toBe(false);
    expect(l.verifier("b").ok).toBe(true);
  });
  it("purge les vieilles entrées (mémoire bornée)", () => {
    let t = 0;
    const l = creerLimiteur({ maxParFenetre: 1, fenetreMs: 10, maintenant: () => t });
    for (let i = 0; i < 100; i++) l.verifier("k" + i);
    t = 1000;
    l.verifier("autre");
    expect(l.taille()).toBe(1);
  });
});

describe("verrou d'application", () => {
  it("deux appels concurrents sur la même vidéo : un seul fn", async () => {
    const v = creerVerrouApplication();
    let appels = 0;
    let libere!: () => void;
    const attente = new Promise<void>((r) => (libere = r));
    const p1 = v.sousVerrou("v1", async () => { appels++; await attente; return 1; });
    const r2 = await v.sousVerrou("v1", async () => { appels++; return 2; });
    expect(r2).toEqual({ ok: false, phrase: "Une retouche est déjà en cours sur cette vidéo : attendez qu'elle finisse." });
    libere();
    expect(await p1).toEqual({ ok: true, valeur: 1 });
    expect(appels).toBe(1);
  });
  it("vidéos différentes : les deux s'exécutent", async () => {
    const v = creerVerrouApplication();
    let libere!: () => void;
    const attente = new Promise<void>((r) => (libere = r));
    const p1 = v.sousVerrou("a", async () => { await attente; return "a"; });
    const r2 = await v.sousVerrou("b", async () => "b");
    expect(r2).toEqual({ ok: true, valeur: "b" });
    libere();
    expect(await p1).toEqual({ ok: true, valeur: "a" });
  });
  it("exception : verrou libéré", async () => {
    const v = creerVerrouApplication();
    await expect(v.sousVerrou("v", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await v.sousVerrou("v", async () => 3)).toEqual({ ok: true, valeur: 3 });
  });
});

describe("garde statique", () => {
  it("aucun import de fabrication, reglages ni argent", () => {
    const src = readFileSync("src/services/retouche-chat/limites.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(fabrication|reglages|argent|plafond|zernio|Date\.now)/i);
    expect(src).not.toMatch(/Date\.now\(/);
    expect(src).not.toMatch(/€|euro/i);
  });
});
