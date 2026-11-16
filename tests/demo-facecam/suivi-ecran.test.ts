import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pistesDepuisSuivi } from "@/moteurs/montage-demo-facecam/suivi-ecran";
import { FACTEUR_ZOOM_MAX } from "@/moteurs/montage-demo-facecam/mise-en-page";
import type { SuiviSourceEcran, ZoneSuivi } from "@/domaine/source-ecran";

const suivi = (clics: { tMs: number; x: number; y: number }[], zones: ZoneSuivi[] = []): SuiviSourceEcran => ({
  version: 1, origine: "navigateur", imagesParSeconde: 30, largeur: 1920, hauteur: 1080, curseur: [], clics, zones,
});

describe("pistesDepuisSuivi", () => {
  it("null (ou absent) → vide : comme aujourd'hui", () => {
    expect(pistesDepuisSuivi(null)).toEqual({ clics: [], zooms: [] });
    expect(pistesDepuisSuivi(undefined)).toEqual({ clics: [], zooms: [] });
    expect(pistesDepuisSuivi(suivi([]))).toEqual({ clics: [], zooms: [] });
  });
  it("3 clics espacés → 3 clics et 3 zooms bornés", () => {
    const r = pistesDepuisSuivi(suivi([{ tMs: 1000, x: 10, y: 20 }, { tMs: 8000, x: 50, y: 50 }, { tMs: 15000, x: 90, y: 80 }]));
    expect(r.clics).toEqual([{ ms: 1000, x: 10, y: 20 }, { ms: 8000, x: 50, y: 50 }, { ms: 15000, x: 90, y: 80 }]);
    expect(r.zooms).toHaveLength(3);
    for (const z of r.zooms) {
      expect(z.facteur).toBeGreaterThan(1);
      expect(z.facteur).toBeLessThanOrEqual(FACTEUR_ZOOM_MAX);
      expect(z.finMs).toBeGreaterThan(z.debutMs);
      expect(z.debutMs).toBeGreaterThanOrEqual(0);
    }
    expect(r.zooms[1]).toMatchObject({ x: 50, y: 50 });
  });
  it("clics trop proches → zooms fusionnés, jamais de chevauchement", () => {
    const r = pistesDepuisSuivi(suivi([{ tMs: 5000, x: 40, y: 40 }, { tMs: 5500, x: 60, y: 60 }, { tMs: 6000, x: 50, y: 50 }]));
    expect(r.clics).toHaveLength(3);
    expect(r.zooms).toHaveLength(1);
    expect(r.zooms[0].x).toBeCloseTo(50);
    const nets = pistesDepuisSuivi(suivi([{ tMs: 2000, x: 1, y: 1 }, { tMs: 2600, x: 2, y: 2 }, { tMs: 20000, x: 3, y: 3 }, { tMs: 20300, x: 4, y: 4 }]));
    for (let i = 1; i < nets.zooms.length; i++) expect(nets.zooms[i].debutMs).toBeGreaterThanOrEqual(nets.zooms[i - 1].finMs);
  });
  it("coordonnées hors cadre → bornées 0-100", () => {
    const r = pistesDepuisSuivi(suivi([{ tMs: 3000, x: -20, y: 250 }]));
    expect(r.clics[0]).toEqual({ ms: 3000, x: 0, y: 100 });
    expect(r.zooms[0].x).toBe(0);
    expect(r.zooms[0].y).toBe(100);
  });
  it("décalage de synchro en option (ms), jamais sous 0", () => {
    const r = pistesDepuisSuivi(suivi([{ tMs: 1000, x: 10, y: 10 }, { tMs: 9000, x: 10, y: 10 }]), { decalageMs: -1500 });
    expect(r.clics.map((c) => c.ms)).toEqual([0, 7500]);
    expect(pistesDepuisSuivi(suivi([{ tMs: 1000, x: 10, y: 10 }]), { decalageMs: 250 }).clics[0].ms).toBe(1250);
  });
  it("facteur demandé trop grand → plafonné ; sans zoom → pas de zoom", () => {
    expect(pistesDepuisSuivi(suivi([{ tMs: 3000, x: 5, y: 5 }]), { facteur: 9 }).zooms[0].facteur).toBe(FACTEUR_ZOOM_MAX);
    expect(pistesDepuisSuivi(suivi([{ tMs: 3000, x: 5, y: 5 }]), { zoom: false }).zooms).toEqual([]);
  });
  it("aucun zoom sur une zone marquée privée (le clic reste)", () => {
    const zone: ZoneSuivi = { debutMs: 0, finMs: 10000, x: 30, y: 30, largeur: 20, hauteur: 20, motif: "mot de passe" };
    const r = pistesDepuisSuivi(suivi([{ tMs: 3000, x: 40, y: 40 }, { tMs: 12000, x: 40, y: 40 }], [zone]));
    expect(r.clics).toHaveLength(2);
    expect(r.zooms).toHaveLength(1);
    expect(r.zooms[0].debutMs).toBeGreaterThanOrEqual(10000);
  });
  it("ne modifie pas l'entrée ; clics non triés acceptés", () => {
    const s = suivi([{ tMs: 9000, x: 1, y: 1 }, { tMs: 1000, x: 2, y: 2 }]);
    const copie = JSON.parse(JSON.stringify(s));
    const r = pistesDepuisSuivi(s);
    expect(s).toEqual(copie);
    expect(r.clics.map((c) => c.ms)).toEqual([1000, 9000]);
  });
});

describe("garde statique : non câblé", () => {
  it("aucun autre fichier de src/ n'importe suivi-ecran", () => {
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) { if (n !== "node_modules") parcourir(p); }
        else if (/\.(ts|tsx)$/.test(n) && !p.endsWith("suivi-ecran.ts") && /suivi-ecran/.test(readFileSync(p, "utf8"))) trouves.push(p);
      }
    };
    parcourir("src");
    expect(trouves).toEqual([]);
  });
});
