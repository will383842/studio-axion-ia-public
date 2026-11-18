import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { completerUids, creerUid } from "../../../src/briques/animation-element";

describe("animation-element : creerUid", () => {
  it("même graine, même uid, sur 8 caractères", () => {
    const a = creerUid("cas-1|e03");
    expect(creerUid("cas-1|e03")).toBe(a);
    expect(a).toMatch(/^[0-9a-z]{8}$/);
  });
  it("graines différentes : valeurs différentes sur 1 000 graines", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 1000; i++) vus.add(creerUid(`cas-1|e${i}`));
    expect(vus.size).toBe(1000);
  });
});

describe("animation-element : completerUids", () => {
  it("laisse intacts les uids existants et pose les manquants", () => {
    const els = [{ uid: "garde-moi", n: 1 }, { n: 2 }, { n: 3 }];
    const sortie = completerUids(els, (e) => `g${e.n}`);
    expect(sortie[0].uid).toBe("garde-moi");
    expect(sortie[1].uid).toBe(creerUid("g2"));
    expect(sortie[2].uid).toBe(creerUid("g3"));
    expect(els[1]).not.toHaveProperty("uid");
  });
  it("deux éléments de même graine reçoivent des uids distincts (-2, -3)", () => {
    const sortie = completerUids([{}, {}, {}], () => "meme");
    const base = creerUid("meme");
    expect(sortie.map((e) => e.uid)).toEqual([base, `${base}-2`, `${base}-3`]);
  });
  it("évite aussi les uids déjà portés par d'autres éléments", () => {
    const base = creerUid("x");
    const sortie = completerUids([{}, { uid: base }], () => "x");
    expect(sortie[0].uid).toBe(`${base}-2`);
    expect(sortie[1].uid).toBe(base);
  });
  it("un ancien plan sans uid reste valide (aucune exception, liste vide ok)", () => {
    expect(completerUids([], () => "x")).toEqual([]);
  });
});

describe("animation-element : pureté du dossier", () => {
  it("n'importe rien hors de zod et de lui-même", () => {
    const dossier = join(__dirname, "../../../src/briques/animation-element");
    const fichiers = readdirSync(dossier).filter((f) => f.endsWith(".ts"));
    expect(fichiers.length).toBeGreaterThanOrEqual(2);
    for (const f of fichiers) {
      const texte = readFileSync(join(dossier, f), "utf8");
      const sources = [...texte.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
      for (const s of sources) expect(s === "zod" || s.startsWith("./")).toBe(true);
    }
  });
});
