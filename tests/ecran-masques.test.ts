import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { masqueA, masquesEcran } from "@/lib/ecran-masques";
import { MAX_ZONES, type SuiviSourceEcran, type ZoneSuivi } from "@/domaine/source-ecran";

const suiviDe = (zones: ZoneSuivi[], attestation = true): SuiviSourceEcran => ({
  version: 1,
  origine: "navigateur",
  imagesParSeconde: 30,
  largeur: 1920,
  hauteur: 1080,
  curseur: [],
  clics: [],
  zones,
  ...(attestation ? { attestation: { texte: "Je confirme avoir contrôlé cette vidéo d'écran.", le: "2026-11-16" } } : {}),
});
const zone = (o: Partial<ZoneSuivi> = {}): ZoneSuivi => ({ debutMs: 1000, finMs: 2000, x: 10, y: 10, largeur: 20, hauteur: 20, ...o });

describe("masquesEcran", () => {
  it("refuse sans attestation", () => {
    const r = masquesEcran(suiviDe([zone()], false));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.phrase.length).toBeGreaterThan(10);
  });
  it("refuse une attestation vide", () => {
    const s = suiviDe([]);
    s.attestation = { texte: "  ", le: "" };
    expect(masquesEcran(s).ok).toBe(false);
  });
  it("refuse un suivi absent", () => {
    expect(masquesEcran(null).ok).toBe(false);
  });
  it("zone fixe : active sur toute la durée", () => {
    const r = masquesEcran(suiviDe([]), [{ x: 5, y: 5, largeur: 10, hauteur: 10 }]);
    if (!r.ok) throw new Error("refus inattendu");
    expect(masqueA(r.masques, 0)).toHaveLength(1);
    expect(masqueA(r.masques, 9_999_999)).toHaveLength(1);
  });
  it("zone par plage : active seulement dedans", () => {
    const r = masquesEcran(suiviDe([zone()]));
    if (!r.ok) throw new Error("refus inattendu");
    expect(masqueA(r.masques, 999)).toHaveLength(0);
    expect(masqueA(r.masques, 1000)).toHaveLength(1);
    expect(masqueA(r.masques, 1999)).toHaveLength(1);
    expect(masqueA(r.masques, 2000)).toHaveLength(0);
  });
  it("rectangles bornés 0-100 %", () => {
    const r = masquesEcran(suiviDe([]), [{ x: -10, y: 90, largeur: 500, hauteur: 50 }]);
    if (!r.ok) throw new Error("refus inattendu");
    const m = r.masques[0];
    expect(m.x).toBe(0);
    expect(m.largeur).toBe(100);
    expect(m.y + m.hauteur).toBeLessThanOrEqual(100);
  });
  it("écarte les zones ajoutées invalides avec remarque", () => {
    const r = masquesEcran(suiviDe([]), [{ x: 0, y: 0, largeur: 0, hauteur: 5 }, { x: Number.NaN, y: 0, largeur: 5, hauteur: 5 }]);
    if (!r.ok) throw new Error("refus inattendu");
    expect(r.masques).toHaveLength(0);
    expect(r.remarques.length).toBeGreaterThan(0);
  });
  it("plus de MAX_ZONES : tronqué avec remarque", () => {
    const zones = Array.from({ length: MAX_ZONES }, (_, i) => zone({ debutMs: i, finMs: i + 10 }));
    const r = masquesEcran(suiviDe(zones), [{ x: 1, y: 1, largeur: 5, hauteur: 5 }, { x: 2, y: 2, largeur: 5, hauteur: 5 }]);
    if (!r.ok) throw new Error("refus inattendu");
    expect(r.masques).toHaveLength(MAX_ZONES);
    expect(r.remarques.some((x) => x.includes("2"))).toBe(true);
  });
  it("pur : même entrée, même sortie, entrée non modifiée", () => {
    const s = suiviDe([zone()]);
    const avant = JSON.stringify(s);
    expect(masquesEcran(s)).toEqual(masquesEcran(s));
    expect(JSON.stringify(s)).toBe(avant);
  });
  it("source : aucun import de services, pas de Date", () => {
    const src = readFileSync("src/lib/ecran-masques.ts", "utf8");
    expect(src).not.toMatch(/@\/services/);
    expect(src).not.toMatch(/\bDate\b/);
  });
});
