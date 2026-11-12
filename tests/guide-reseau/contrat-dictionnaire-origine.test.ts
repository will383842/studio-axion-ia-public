/** Contrat v3 : le dictionnaire d'origine et la charge de test sont des COPIES EXACTES de celles du site. Si l'une diverge, ce test échoue. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { construireOrigineV3, detailDansDictionnaire, familleDansDictionnaire } from "@/domaine/guide-reseau/origine-v3";

const lire = (nom: string) => readFileSync(new URL(`../../contrats/${nom}`, import.meta.url));
const empreinte = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// Empreintes SHA-256 des fichiers bruts. Les changer exige de les changer AUSSI sur le site et au CRM (lecteurs d'abord).
const EMPREINTE_DICTIONNAIRE = "8be422516ace6e0500ba2884a0a97cd6d4bc725dbe7d0865a1fd4edaee320c4e";
const EMPREINTE_CHARGE_V3 = "90cf20e7fc950b9233119dec7f59f1f0afb98e14ce5131c6a51c9f3680ab4cc6";

describe("copies du contrat", () => {
  it("le dictionnaire est identique à celui du site (empreinte)", () => {
    expect(empreinte(lire("dictionnaire-origine.v1.json"))).toBe(EMPREINTE_DICTIONNAIRE);
  });
  it("la charge v3 de test est identique à celle du site (empreinte)", () => {
    expect(empreinte(lire("charge-crm-v3.json"))).toBe(EMPREINTE_CHARGE_V3);
  });
  it("le dictionnaire est public : clés ASCII minuscules, autre_non_classe dans chaque famille", () => {
    const d = JSON.parse(lire("dictionnaire-origine.v1.json").toString("utf8")) as { familles: Record<string, { details: Record<string, unknown> }> };
    for (const [f, v] of Object.entries(d.familles)) {
      expect(f).toMatch(/^[a-z0-9_]{2,40}$/);
      expect(Object.keys(v.details)).toContain("autre_non_classe");
    }
  });
});

describe("vérification famille / détail contre le dictionnaire", () => {
  const o = { reseau: "instagram", prefixesComptes: [] as string[] };
  it("accepte une paire du dictionnaire", () => {
    expect(familleDansDictionnaire("guide_reseau")).toBe(true);
    expect(detailDansDictionnaire("guide_reseau", "guide_ia")).toBe(true);
    expect(construireOrigineV3({ famille: "guide_reseau", detail: "guide_ia" }, o)).toEqual({ ok: true, origine: { famille: "guide_reseau", detail: "guide_ia" } });
    expect(construireOrigineV3({ famille: "video" }, o).ok).toBe(true);
  });
  it("refuse une famille de bonne forme mais absente du dictionnaire", () => {
    expect(construireOrigineV3({ famille: "inconnue_test" }, o)).toEqual({ ok: false, code: "famille_invalide" });
  });
  it("refuse un détail absent de SA famille (même s'il existe ailleurs)", () => {
    expect(construireOrigineV3({ famille: "video", detail: "guide_ia" }, o)).toEqual({ ok: false, code: "detail_invalide" });
    expect(construireOrigineV3({ famille: "guide_reseau", detail: "nexiste_pas" }, o)).toEqual({ ok: false, code: "detail_invalide" });
  });
  it("refuse un détail sans famille (non vérifiable)", () => {
    expect(construireOrigineV3({ detail: "autre_non_classe" }, o)).toEqual({ ok: false, code: "detail_invalide" });
  });
  it("refuse les clés héritées de l'objet (__proto__, constructor)", () => {
    expect(familleDansDictionnaire("constructor")).toBe(false);
    expect(familleDansDictionnaire("__proto__")).toBe(false);
    expect(detailDansDictionnaire("video", "constructor")).toBe(false);
  });
  it("chaque paire du dictionnaire est acceptée", () => {
    const d = JSON.parse(lire("dictionnaire-origine.v1.json").toString("utf8")) as { familles: Record<string, { details: Record<string, unknown> }> };
    for (const [f, v] of Object.entries(d.familles)) for (const det of Object.keys(v.details)) expect(construireOrigineV3({ famille: f, detail: det }, o).ok, `${f}/${det}`).toBe(true);
  });
});
