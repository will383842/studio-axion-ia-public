import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { ID_VOLET, poserCapturesVolet } from "@/briques/plan-scenes/poser-captures-volet";

const CAP = { avant: "https://x/a.png", apres: "https://x/b.png" };
const scene = (id: string, piece: string, extra: Record<string, unknown> = {}) => ({ id, piece, parametres: { texte: id }, niveau: 1, empreinte: "0123456789abcdef", ...extra });
const plan = (scenes: unknown[]) => ({ version: "1", scenes }) as unknown as PlanValide;
const volet = (extra: Record<string, unknown> = {}) => scene("v", ID_VOLET, { parametres: { sens: "gauche-droite", etiquettes: true }, ...extra });
const lire = (p: unknown) => p as { scenes: { id: string; piece: string; parametres: Record<string, unknown>; niveau: number; calques?: { piece: string; parametres: Record<string, unknown> }[] }[] };

describe("poserCapturesVolet", () => {
  it("a) sans volet : même référence", () => {
    const p = plan([scene("a", "titre")]);
    expect(poserCapturesVolet(p, CAP)).toBe(p);
    expect(poserCapturesVolet(p, null)).toBe(p);
  });
  it("b) scène volet + captures : adresses posées, reste gardé", () => {
    const p = plan([scene("a", "titre"), volet()]);
    const r = lire(poserCapturesVolet(p, CAP));
    expect(r).not.toBe(p);
    expect(r.scenes[1].parametres).toEqual({ sens: "gauche-droite", etiquettes: true, ...CAP });
    expect(r.scenes[1].id).toBe("v");
    expect(r.scenes[0]).toEqual(lire(p).scenes[0]);
  });
  it("c) calque volet : adresses posées sur le calque", () => {
    const p = plan([scene("n2", "titre", { niveau: 2, calques: [{ piece: "titre", parametres: {} }, { piece: ID_VOLET, parametres: { sens: "droite-gauche" } }] })]);
    const r = lire(poserCapturesVolet(p, CAP));
    expect(r.scenes[0].calques![1].parametres).toEqual({ sens: "droite-gauche", ...CAP });
    expect(r.scenes[0].calques![0].parametres).toEqual({});
  });
  it("d) captures nulles : scène et calque volet retirés", () => {
    const n2 = scene("n2", "titre", { niveau: 2, calques: [{ piece: "titre", parametres: {} }, { piece: ID_VOLET, parametres: {} }] });
    const p = plan([scene("a", "titre"), volet(), n2]);
    const r = lire(poserCapturesVolet(p, null));
    expect(r.scenes.map((s) => s.id)).toEqual(["a", "n2"]);
    expect(r.scenes[1].calques).toHaveLength(1);
    const seul = lire(poserCapturesVolet(plan([scene("n2", "titre", { niveau: 2, calques: [{ piece: ID_VOLET, parametres: {} }] })]), null));
    expect(seul.scenes).toHaveLength(1);
    expect(seul.scenes[0].piece).toBe("titre");
    expect(seul.scenes[0].calques ?? []).toHaveLength(0);
  });
  it("e) captures invalides = nulles", () => {
    const p = plan([volet()]);
    for (const c of [{ avant: "", apres: "x" }, { avant: "x", apres: "x" }, { avant: 1, apres: "x" }, { avant: "x" }, "oui"]) {
      expect(lire(poserCapturesVolet(p, c as never)).scenes).toHaveLength(0);
    }
  });
  it("f) entrée jamais modifiée", () => {
    const n2 = scene("n2", "titre", { niveau: 2, calques: [{ piece: ID_VOLET, parametres: {} }] });
    for (const c of [CAP, null, { avant: "", apres: "" }]) {
      const p = plan([volet(), n2]);
      const avant = JSON.stringify(p);
      poserCapturesVolet(p, c);
      expect(JSON.stringify(p)).toBe(avant);
    }
  });
  it("g) jamais d'exemple", () => {
    const p = plan([volet(), scene("n2", "titre", { niveau: 2, calques: [{ piece: ID_VOLET, parametres: {} }] })]);
    for (const c of [CAP, null]) expect(JSON.stringify(poserCapturesVolet(p, c))).not.toContain("capture-avant.png");
  });
  it("h) entrée illisible : ne lève pas", () => {
    expect(() => poserCapturesVolet(null as never, CAP)).not.toThrow();
    expect(() => poserCapturesVolet({ scenes: "x" } as never, null)).not.toThrow();
    expect(() => poserCapturesVolet(plan([null, 3, volet()]), CAP)).not.toThrow();
  });
  it("i) garde statique", () => {
    const src = readFileSync("src/briques/plan-scenes/poser-captures-volet.ts", "utf8");
    const imports = src.match(/^\s*import .*$/gm) ?? [];
    expect(imports).toEqual(['import type { PlanValide } from "./schema";']);
    for (const m of ["@/", "validerPlan", "validateur", "lireParametre", "Date", "Math.random"]) expect(src).not.toContain(m);
  });
});
