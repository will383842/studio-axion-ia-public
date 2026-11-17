/**
 * FACE CAMÉRA ANIMÉE v4 — GARDER LE RENDU BRUT (G11-09a). Pièce pure, non branchée : réglage, nom du fichier, garde-fou de taille.
 * Aucun appel réseau, aucun service.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alerteTailleMaster, garderMasterActif, nomMasterV4, PARAM_GARDER_MASTER_FA, SEUIL_ALERTE_MASTER_OCTETS } from "@/moteurs/montage-facecam-animee/master-v4";

describe("garderMasterActif", () => {
  it("lit le bon réglage", async () => {
    const vus: string[] = [];
    await garderMasterActif(async (id) => { vus.push(id); return true; });
    expect(vus).toEqual([PARAM_GARDER_MASTER_FA]);
    expect(PARAM_GARDER_MASTER_FA).toBe("facecamAnimee.garderMaster");
  });
  it("n'allume que sur true exact", async () => {
    expect(await garderMasterActif(async () => true)).toBe(true);
  });
  it.each([[undefined], [false], ["true"], [1], [{}], [null]])("éteint pour %s", async (v) => {
    expect(await garderMasterActif(async () => v)).toBe(false);
  });
  it("éteint si la lecture lève", async () => {
    expect(await garderMasterActif(async () => { throw new Error("panne"); })).toBe(false);
  });
});

describe("nomMasterV4", () => {
  it("construit le nom", () => {
    expect(nomMasterV4("fa4-v1")).toBe("fa4-v1-master.mp4");
  });
  it("refuse vide ou avec /", () => {
    expect(() => nomMasterV4("")).toThrow();
    expect(() => nomMasterV4("a/b")).toThrow();
  });
});

describe("alerteTailleMaster", () => {
  it("rien sous ou au seuil", () => {
    expect(SEUIL_ALERTE_MASTER_OCTETS).toBe(400_000_000);
    expect(alerteTailleMaster(300_000_000)).toBeNull();
    expect(alerteTailleMaster(400_000_000)).toBeNull();
  });
  it("info au-delà du seuil", () => {
    const a = alerteTailleMaster(450_000_000);
    expect(a).not.toBeNull();
    expect(a?.code).toBe("montant");
    expect(a?.gravite).toBe("info");
    expect(a?.message).toContain("0,4 Go");
    expect(a?.message).toContain("Williams");
    expect(a?.message).toContain("0,45 Go");
  });
  it("rien si la taille est invalide", () => {
    expect(alerteTailleMaster(Number.NaN)).toBeNull();
    expect(alerteTailleMaster(-1)).toBeNull();
    expect(alerteTailleMaster(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("garde statique", () => {
  it("n'importe ni service ni studio-rendu", () => {
    const src = readFileSync(join(process.cwd(), "src/moteurs/montage-facecam-animee/master-v4.ts"), "utf8");
    expect(src).not.toMatch(/@\/services\//);
    expect(src).not.toMatch(/studio-rendu/);
  });
});
