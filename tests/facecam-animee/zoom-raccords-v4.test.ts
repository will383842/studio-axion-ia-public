import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/briques/zoom-gratuit/regles", async (importOriginal) => {
  const reel = await importOriginal<typeof import("../../src/briques/zoom-gratuit/regles")>();
  const espion = vi.fn();
  return {
    ...reel,
    fenetresPermises: (...a: Parameters<typeof reel.fenetresPermises>) => {
      espion(...a);
      return reel.fenetresPermises(...a);
    },
    __espion: espion,
  };
});

import * as regles from "../../src/briques/zoom-gratuit/regles";
import {
  RACCORD_ZOOM_V4,
  demandesRaccordsV4,
  zoomsPriseV4,
} from "../../src/moteurs/montage-facecam-animee/zoom-gratuit-v4";

const gardes = [
  { debutSec: 0, finSec: 4 },
  { debutSec: 5, finSec: 9 },
  { debutSec: 10, finSec: 13 },
  { debutSec: 14, finSec: 20 },
];

const espion = (regles as unknown as { __espion: ReturnType<typeof vi.fn> }).__espion;
beforeEach(() => espion.mockClear());

describe("demandesRaccordsV4", () => {
  it("un raccord sur deux, dans le temps de la prise montée", () => {
    // raccords montés à 4, 8, 11 -> demandes à 4 et 11
    const d = demandesRaccordsV4(gardes);
    expect(d).toEqual([
      { debutSec: 4, finSec: 6, facteur: 1.05, type: "punch-in" },
      { debutSec: 11, finSec: 13, facteur: 1.05, type: "punch-in" },
    ]);
    expect(RACCORD_ZOOM_V4).toEqual({ dureeSec: 2, facteur: 1.05, unSurDeux: true });
  });
  it("0 ou 1 garde : aucune demande", () => {
    expect(demandesRaccordsV4([])).toEqual([]);
    expect(demandesRaccordsV4([{ debutSec: 2, finSec: 9 }])).toEqual([]);
  });
  it("arrondi au millième, entrées intactes et déterministe", () => {
    const g = Object.freeze([
      Object.freeze({ debutSec: 0.1234, finSec: 3.3333 }),
      Object.freeze({ debutSec: 5, finSec: 8 }),
    ]);
    const a = demandesRaccordsV4(g);
    expect(a[0].debutSec).toBe(3.21);
    expect(a[0].finSec).toBe(5.21);
    expect(demandesRaccordsV4(g)).toEqual(a);
    expect(g[0]).toEqual({ debutSec: 0.1234, finSec: 3.3333 });
  });
});

describe("zoomsPriseV4", () => {
  const base = { plan: {}, gardes, dureeSec: 20, largeur: 1080, hauteur: 1920 };

  it("éteint : undefined et fenetresPermises jamais appelée", () => {
    for (const actif of [false, undefined, "true", 1, null]) {
      expect(zoomsPriseV4({ ...base, actif })).toBeUndefined();
    }
    expect(espion).not.toHaveBeenCalled();
  });

  it("allumé : forme { debutSec, finSec, facteur } seulement, facteur ≤ 1,06", () => {
    const r = zoomsPriseV4({ ...base, actif: true });
    expect(r).toBeDefined();
    expect(espion).toHaveBeenCalledTimes(1);
    expect(r!.largeur).toBe(1080);
    expect(r!.hauteur).toBe(1920);
    expect(r!.fenetres.length).toBeGreaterThan(0);
    for (const f of r!.fenetres) {
      expect(Object.keys(f).sort()).toEqual(["debutSec", "facteur", "finSec"]);
      expect(f.facteur).toBeLessThanOrEqual(1.06);
    }
  });

  it("jamais pendant une plaquette (marge 0,3 s), ni au début, ni à la fin", () => {
    const r = zoomsPriseV4({ ...base, actif: true, plan: { elementsV4: [{ debut: 3.5, fin: 6 }] } });
    // la demande à 4 s tombe dans [3,2 ; 6,3] : seule celle de 11 s reste
    expect(r).toBeDefined();
    for (const f of r!.fenetres) {
      expect(f.finSec <= 3.2 || f.debutSec >= 6.3).toBe(true);
      expect(f.debutSec).toBeGreaterThanOrEqual(0.8);
      expect(f.finSec).toBeLessThanOrEqual(19);
    }
  });

  it("au plus 4 par minute", () => {
    const longues = Array.from({ length: 30 }, (_, i) => ({ debutSec: i * 6, finSec: i * 6 + 5 }));
    const r = zoomsPriseV4({ ...base, actif: true, gardes: longues, dureeSec: 150 });
    expect(r).toBeDefined();
    for (const f of r!.fenetres) {
      const dansLaMinute = r!.fenetres.filter((g) => g.debutSec >= f.debutSec && g.debutSec < f.debutSec + 60);
      expect(dansLaMinute.length).toBeLessThanOrEqual(4);
    }
  });

  it("dimensions absentes, impaires, non entières ou ≤ 0 : undefined", () => {
    const sans = { actif: true, plan: {}, gardes, dureeSec: 20 };
    expect(zoomsPriseV4(sans)).toBeUndefined();
    expect(zoomsPriseV4({ ...sans, largeur: 1080 })).toBeUndefined();
    expect(zoomsPriseV4({ ...sans, largeur: 1081, hauteur: 1920 })).toBeUndefined();
    expect(zoomsPriseV4({ ...sans, largeur: 1080, hauteur: 1920.5 })).toBeUndefined();
    expect(zoomsPriseV4({ ...sans, largeur: 0, hauteur: 1920 })).toBeUndefined();
    expect(zoomsPriseV4({ ...sans, largeur: -2, hauteur: 1920 })).toBeUndefined();
  });

  it("aucune fenêtre permise : undefined", () => {
    expect(zoomsPriseV4({ ...base, actif: true, gardes: [{ debutSec: 0, finSec: 20 }] })).toBeUndefined();
    expect(zoomsPriseV4({ ...base, actif: true, plan: { elementsV4: [{ debut: 0, fin: 20 }] } })).toBeUndefined();
  });

  it("entrées non modifiées, même entrée = même sortie", () => {
    const g = gardes.map((x) => Object.freeze({ ...x }));
    const e = { ...base, actif: true, gardes: g };
    expect(zoomsPriseV4(e)).toEqual(zoomsPriseV4(e));
  });
});

describe("garde d'isolement", () => {
  const fichier = join(process.cwd(), "src/moteurs/montage-facecam-animee/zoom-gratuit-v4.ts");

  it("n'importe rien de studio-rendu ni de @/services/", () => {
    const imports = readFileSync(fichier, "utf8")
      .split("\n")
      .filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const l of imports) {
      expect(l).not.toMatch(/studio-rendu/);
      expect(l).not.toMatch(/services\//);
    }
  });

  it("l'UNIQUE importeur dans src/ et studio-rendu/ est chaine-v4.ts (C8-Z09-v19b)", () => {
    const trouves: string[] = [];
    const parcourir = (dir: string) => {
      for (const nom of readdirSync(dir)) {
        if (nom === "node_modules" || nom.startsWith(".")) continue;
        const p = join(dir, nom);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx|mts)$/.test(nom) && p !== fichier && /zoom-gratuit-v4/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    for (const racine of ["src", "studio-rendu"]) parcourir(join(process.cwd(), racine));
    expect(trouves.map((t) => t.slice(process.cwd().length + 1).replace(/\\/g, "/"))).toEqual(["src/moteurs/montage-facecam-animee/chaine-v4.ts"]);
  });
});
