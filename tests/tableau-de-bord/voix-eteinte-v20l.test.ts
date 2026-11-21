import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PLAFOND_VOIX_TDB_CENTIMES_PROPOSE, prixVoixCentimes, voixTableauDeBord } from "@/services/tableau-de-bord-voix";

const rendue = { audio: "a.mp3", dureeSec: 10, mots: [] };
const tarif = 0.03; // TARIF_VOIX_CENTIMES_PAR_CARACTERE (heygen 0,03 ¢/car, taux 1)
const texte = (n: number) => "a".repeat(n);
const faire = (o: { lecturesMax?: number; plafond?: number } = {}) => {
  const lire = vi.fn(async () => rendue);
  const reserver = vi.fn(async () => {});
  const voix = voixTableauDeBord({ lire, reserver, lecturesMax: o.lecturesMax ?? 3, plafondCentimes: o.plafond ?? 100, tarifCentimesParCaractere: tarif });
  return { lire, reserver, voix };
};

describe("voix du tableau de bord (G4-09c-a, éteinte)", () => {
  it("a) 156 mots × 7 caractères × 3 lectures = 99 centimes : passe, réservé UNE seule fois", async () => {
    const { lire, reserver, voix } = faire();
    const t = texte(156 * 7);
    expect(prixVoixCentimes(t.length, 3, tarif)).toBe(99);
    expect(await voix.lire(t)).toBe(rendue);
    await voix.lire(t); await voix.lire(t);
    expect(reserver).toHaveBeenCalledTimes(1);
    expect(reserver).toHaveBeenCalledWith({ caracteres: t.length * 3, lectures: 3, centimes: 99 });
    expect(lire).toHaveBeenCalledTimes(3);
  });

  it("b) 101 centimes (ou plus) : refusé AVANT toute lecture et toute réservation", async () => {
    const { lire, reserver, voix } = faire();
    const t = texte(1134 + 1); // ⌈1135 × 0,03⌉ = 35 → 105
    expect(prixVoixCentimes(t.length, 3, tarif)).toBeGreaterThan(100);
    await expect(voix.lire(t)).rejects.toThrow(/plafond/);
    expect(lire).not.toHaveBeenCalled();
    expect(reserver).not.toHaveBeenCalled();
    const { lire: l2, reserver: r2, voix: v2 } = faire({ plafond: 98 });
    await expect(v2.lire(texte(156 * 7))).rejects.toThrow(/plafond/);
    expect(l2).not.toHaveBeenCalled(); expect(r2).not.toHaveBeenCalled();
  });

  it("c) une lecture de plus que lecturesMax, ou un texte plus long que le réservé : refusé sans lecture", async () => {
    const { lire, voix } = faire({ lecturesMax: 2 });
    await voix.lire(texte(100)); await voix.lire(texte(100));
    await expect(voix.lire(texte(100))).rejects.toThrow(/2 lectures/);
    expect(lire).toHaveBeenCalledTimes(2);
    const b = faire();
    await b.voix.lire(texte(100));
    await expect(b.voix.lire(texte(101))).rejects.toThrow(/plus long/);
    expect(b.lire).toHaveBeenCalledTimes(1);
  });

  it("d) réservation refusée : aucune lecture", async () => {
    const lire = vi.fn(async () => rendue);
    const voix = voixTableauDeBord({ lire, reserver: async () => { throw new Error("non"); }, lecturesMax: 1, plafondCentimes: 100, tarifCentimesParCaractere: tarif });
    await expect(voix.lire("abc")).rejects.toThrow("non");
    expect(lire).not.toHaveBeenCalled();
  });

  it("e) plafond proposé : 100 centimes, marqué non accepté", () => {
    expect(PLAFOND_VOIX_TDB_CENTIMES_PROPOSE).toBe(100);
    const source = readFileSync(join(__dirname, "..", "..", "src", "services", "tableau-de-bord-voix.ts"), "utf8");
    expect(source).toMatch(/proposé, NON accepté/);
  });

  it("f) éteint : aucun importeur ; le module ne lit aucun réglage, ne cite ni crédits, ni porte d'argent, ni montage-donnees", () => {
    const racine = join(__dirname, "..", "..", "src");
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) parcourir(f); else if (/\.(ts|tsx)$/.test(n)) fichiers.push(f); } };
    parcourir(racine);
    expect(fichiers.filter((f) => !f.endsWith("tableau-de-bord-voix.ts") && readFileSync(f, "utf8").includes("tableau-de-bord-voix"))).toEqual([]);
    const source = readFileSync(join(racine, "services", "tableau-de-bord-voix.ts"), "utf8");
    expect(source).not.toMatch(/lireParametre|credits|verifierEtReserver|verifierBudget|depenser|montage-donnees/);
    expect(source).not.toMatch(/^\s*import /m);
  });
});
