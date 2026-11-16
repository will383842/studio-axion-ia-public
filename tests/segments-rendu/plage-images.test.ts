import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { optionsPlage } from "../../studio-rendu/src/operations/plage-images";

const base = { mode: "plage", composition: "TutorielOutil", proprietes: { a: 1, b: "x" }, debut: 188, fin: 192 };

describe("optionsPlage (fonction pure)", () => {
  it("plage valide : composition, propriétés complètes, frameRange, codec h264", () => {
    const r = optionsPlage(base, { durationInFrames: 300 });
    expect(r).toEqual({ ok: true, options: { compositionId: "TutorielOutil", proprietes: { a: 1, b: "x" }, frameRange: [188, 192], codec: "h264", crf: undefined } });
  });
  it("une seule image (début = fin) est valide", () => {
    const r = optionsPlage({ ...base, debut: 190, fin: 190 }, { durationInFrames: 300 });
    expect(r.ok && r.options.frameRange).toEqual([190, 190]);
  });
  it("crf borné 0-51 et arrondi", () => {
    const r = optionsPlage({ ...base, crf: 99.4 }, { durationInFrames: 300 });
    expect(r.ok && r.options.crf).toBe(51);
  });
  it("plage inversée : refus lisible", () => {
    const r = optionsPlage({ ...base, debut: 200, fin: 10 }, { durationInFrames: 300 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/inversée|vide/i);
  });
  it("hors durée : refus lisible", () => {
    const r = optionsPlage({ ...base, fin: 300 }, { durationInFrames: 300 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/durée/i);
  });
  it("bornes non entières ou négatives : refus", () => {
    expect(optionsPlage({ ...base, debut: -1 }, { durationInFrames: 300 }).ok).toBe(false);
    expect(optionsPlage({ ...base, fin: 1.5 }, { durationInFrames: 300 }).ok).toBe(false);
    expect(optionsPlage({ ...base, debut: undefined }, { durationInFrames: 300 }).ok).toBe(false);
  });
  it("composition absente du paramètre : refus", () => {
    expect(optionsPlage({ ...base, composition: undefined }).ok).toBe(false);
    expect(optionsPlage({ ...base, composition: "" }).ok).toBe(false);
  });
  it("composition inconnue du paquet (null) : refus", () => {
    const r = optionsPlage(base, null);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/introuvable|inconnue/i);
  });
  it("sans durée connue, seules les bornes sont contrôlées", () => {
    expect(optionsPlage(base).ok).toBe(true);
  });
});

describe("gardes statiques", () => {
  it("plage-images.ts n'importe jamais remotion-lambda (jamais Lambda)", () => {
    const src = readFileSync("studio-rendu/src/operations/plage-images.ts", "utf8");
    expect(src).not.toMatch(/from\s+"[^"]*remotion-lambda/);
    expect(src).not.toMatch(/configLambda|rendreSurLambda/);
  });
  it("composition.ts : une seule ligne de dispatch plage, placée avec facecam-v4", () => {
    const src = readFileSync("studio-rendu/src/operations/composition.ts", "utf8");
    expect(src.match(/=== "plage"/g)).toHaveLength(1);
    expect(src).toMatch(/compositionPlage\(demande, contexte\)/);
  });
});
