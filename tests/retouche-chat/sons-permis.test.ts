/** N-13 : « changer un son » ne puise que dans les sons déjà présents et validés. Garde pure. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SONS } from "@/briques/sons";
import { sonPermisDansLeChat, sonsPermisDansLeChat } from "@/services/retouche-chat/sons-permis";

const PHRASE_INCONNU = "Ce son n'est pas dans la liste des sons déjà validés : le chat ne peut pas l'ajouter.";
const PHRASE_NON_PREVU = "Ce son n'est pas prévu pour cette vidéo.";

describe("sonPermisDansLeChat", () => {
  it("refuse un id inconnu avec une phrase claire", () => {
    const r = sonPermisDansLeChat("studio/nouveau-son", "demo-facecam");
    expect(r).toEqual({ ok: false, phrase: PHRASE_INCONNU });
    expect(sonPermisDansLeChat("studio/nouveau-son")).toEqual({ ok: false, phrase: PHRASE_INCONNU });
  });
  it("permet un son studio pour demo-facecam et sans générateur", () => {
    const r = sonPermisDansLeChat("studio/impact-1", "demo-facecam");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.son.id).toBe("studio/impact-1");
    expect(sonPermisDansLeChat("studio/impact-1").ok).toBe(true);
  });
  it("refuse un son interface-claire pour demo-facecam et sans générateur, le permet pour facecam-animee", () => {
    expect(sonPermisDansLeChat("interface-claire/whoosh-in", "demo-facecam")).toEqual({ ok: false, phrase: PHRASE_NON_PREVU });
    expect(sonPermisDansLeChat("interface-claire/whoosh-in")).toEqual({ ok: false, phrase: PHRASE_NON_PREVU });
    expect(sonPermisDansLeChat("interface-claire/whoosh-in", "facecam-animee").ok).toBe(true);
  });
});

describe("sonsPermisDansLeChat", () => {
  const ids = new Set(SONS.map((s) => s.id));
  it("ne renvoie que des ids du registre", () => {
    for (const g of [undefined, "demo-facecam", "facecam-animee"]) {
      for (const id of sonsPermisDansLeChat(g)) expect(ids.has(id)).toBe(true);
    }
  });
  it("demo-facecam : exactement les sons « * » du registre", () => {
    const attendu = SONS.filter((s) => s.posablePar.includes("*")).length;
    expect(sonsPermisDansLeChat("demo-facecam")).toHaveLength(attendu);
    expect(sonsPermisDansLeChat()).toHaveLength(attendu);
  });
  it("facecam-animee : sons « * » et facecam-animee-v4", () => {
    const attendu = SONS.filter((s) => s.posablePar.includes("*") || s.posablePar.includes("facecam-animee-v4")).length;
    expect(sonsPermisDansLeChat("facecam-animee")).toHaveLength(attendu);
  });
});

describe("garde statique", () => {
  it("n'importe que @/briques/sons, sans fs, fetch ni argent", () => {
    const src = readFileSync("src/services/retouche-chat/sons-permis.ts", "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["@/briques/sons"]);
    expect(src).not.toMatch(/\bfetch\(|node:fs|from "fs"|server-only|credits|budget/);
  });
});
