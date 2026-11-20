import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  MARGE_PLAQUETTE_ZOOM_V4_SEC,
  OPTIONS_ZOOM_V4,
  PARAM_ZOOM_GRATUIT_FA,
  exclusionsV4,
  fenetresZoomV4,
  zoomGratuitV4Actif,
} from "../../src/moteurs/montage-facecam-animee/zoom-gratuit-v4";
import type { FenetreZoom } from "../../src/briques/zoom-gratuit/types";

const plan = { elementsV4: [{ debut: 5, fin: 8 }, { debut: 20, fin: 23 }] };
const demandes: FenetreZoom[] = [
  { debutSec: 3, finSec: 6, facteur: 1.2, type: "lent" },
  { debutSec: 10, finSec: 13, facteur: 1.05, type: "punch-in" },
  { debutSec: 21, finSec: 22, facteur: 1.05, type: "lent" },
];

describe("zoomGratuitV4Actif", () => {
  it("seul true exact allume", async () => {
    expect(await zoomGratuitV4Actif(async () => true)).toBe(true);
    for (const v of [undefined, false, "true", 1, null]) expect(await zoomGratuitV4Actif(async () => v)).toBe(false);
  });
  it("lecture qui lève : éteint", async () => {
    expect(await zoomGratuitV4Actif(async () => { throw new Error("panne"); })).toBe(false);
  });
  it("une seule lecture, clé exacte", async () => {
    const lire = vi.fn(async () => true);
    await zoomGratuitV4Actif(lire);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lire).toHaveBeenCalledWith("facecamAnimee.zoomGratuit", false);
    expect(PARAM_ZOOM_GRATUIT_FA).toBe("facecamAnimee.zoomGratuit");
  });
});

describe("exclusionsV4", () => {
  it("marge bornée à 0 au début, triées", () => {
    const ex = exclusionsV4({ elementsV4: [{ debut: 20, fin: 23 }, { debut: 0.1, fin: 2 }] });
    expect(MARGE_PLAQUETTE_ZOOM_V4_SEC).toBe(0.3);
    expect(ex[0]).toEqual({ debutSec: 0, finSec: 2.3, raison: "plaquette" });
    expect(ex[1].debutSec).toBeCloseTo(19.7);
    expect(ex[1].finSec).toBeCloseTo(23.3);
  });
  it("plan sans éléments : vide", () => {
    expect(exclusionsV4({})).toEqual([]);
  });
});

describe("fenetresZoomV4", () => {
  it("éteint : []", () => {
    for (const actif of [false, undefined, "true"]) {
      expect(fenetresZoomV4({ actif, plan, dureeSec: 40, demandes })).toEqual([]);
    }
  });
  it("allumé : jamais sur une plaquette, bornes respectées, pur", () => {
    const entree = Object.freeze({ actif: true, plan: Object.freeze(plan), dureeSec: 40, demandes: Object.freeze(demandes) });
    const a = fenetresZoomV4(entree);
    expect(a.length).toBeGreaterThan(0);
    for (const f of a) {
      expect(f.finSec <= 4.7 || f.debutSec >= 8.3).toBe(true);
      expect(f.finSec <= 19.7 || f.debutSec >= 23.3).toBe(true);
      expect(f.facteur).toBeLessThanOrEqual(1.06);
      expect(f.debutSec).toBeGreaterThanOrEqual(0.8);
      expect(f.finSec).toBeLessThanOrEqual(39);
    }
    expect(fenetresZoomV4(entree)).toEqual(a);
    expect(OPTIONS_ZOOM_V4.facteurMax).toBe(1.06);
    expect(Object.isFrozen(OPTIONS_ZOOM_V4)).toBe(true);
  });
  it("centre facultatif transmis sans erreur", () => {
    expect(() => fenetresZoomV4({ actif: true, plan, dureeSec: 40, demandes, centre: { x: 0.4, y: 0.3 } })).not.toThrow();
  });
});

describe("garde d'isolement", () => {
  const src = readFileSync("src/moteurs/montage-facecam-animee/zoom-gratuit-v4.ts", "utf8");
  it("n'importe ni studio-rendu ni @/services/", () => {
    expect(src).not.toMatch(/from\s+["'][^"']*(studio-rendu|@\/services\/)/);
    expect(src).not.toContain("lireParametre");
  });
  it("l'UNIQUE importeur dans src/ et studio-rendu/ est chaine-v4.ts (C8-Z09-v19b)", () => {
    const vus: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (n === "node_modules" || n === ".next") continue;
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && !p.endsWith("zoom-gratuit-v4.ts") && readFileSync(p, "utf8").includes("zoom-gratuit-v4")) vus.push(p);
      }
    };
    parcourir("src");
    parcourir("studio-rendu");
    expect(vus.map((v) => v.replace(/\\/g, "/"))).toEqual(["src/moteurs/montage-facecam-animee/chaine-v4.ts"]);
  });
});
