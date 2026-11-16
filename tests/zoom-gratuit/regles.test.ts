/**
 * Fiche C8-Z03 : garde-fous purs du zoom gratuit. Le Studio calcule les fenêtres, le rendu ne fait que les appliquer.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fenetresPermises } from "@/briques/zoom-gratuit/regles";
import type { Exclusion, FenetreZoom, OptionsZoom } from "@/briques/zoom-gratuit/types";

const options: OptionsZoom = {
  facteurMax: 1.08,
  dureeMinSec: 1,
  dureeMaxSec: 4,
  parMinuteMax: 3,
  ecartMinSec: 5,
  centre: { x: 0.5, y: 0.35 },
};
const fen = (debutSec: number, finSec: number, facteur = 1.05, type: FenetreZoom["type"] = "lent"): FenetreZoom => ({
  debutSec, finSec, facteur, type,
});

describe("fenetresPermises (zoom gratuit, garde-fous)", () => {
  it("borne le facteur demandé 1,2 à 1,08", () => {
    const r = fenetresPermises([fen(10, 13, 1.2)], [], 60, options);
    expect(r).toHaveLength(1);
    expect(r[0].facteur).toBe(1.08);
  });

  it("ne dépasse jamais 1,08 même si facteurMax est plus grand", () => {
    const r = fenetresPermises([fen(10, 13, 1.5)], [], 60, { ...options, facteurMax: 2 });
    expect(r[0].facteur).toBe(1.08);
  });

  it("retire une fenêtre qui tombe entièrement sur une plaquette", () => {
    const ex: Exclusion[] = [{ debutSec: 8, finSec: 20, raison: "plaquette" }];
    expect(fenetresPermises([fen(10, 13)], ex, 60, options)).toEqual([]);
  });

  it("coupe une fenêtre qui chevauche une exclusion", () => {
    const ex: Exclusion[] = [{ debutSec: 12, finSec: 20, raison: "transition" }];
    const r = fenetresPermises([fen(10, 14)], ex, 60, { ...options, dureeMinSec: 1.5 });
    expect(r).toEqual([fen(10, 12)]);
  });

  it("exclut les 0,8 premières secondes et la dernière seconde", () => {
    const debut = fenetresPermises([fen(0, 3)], [], 60, options);
    expect(debut[0].debutSec).toBe(0.8);
    const fin = fenetresPermises([fen(56, 60)], [], 60, options);
    expect(fin[0].finSec).toBe(59);
    expect(fenetresPermises([fen(0, 0.8)], [], 60, options)).toEqual([]);
    expect(fenetresPermises([fen(59, 60)], [], 60, options)).toEqual([]);
  });

  it("respecte la durée minimale et maximale", () => {
    expect(fenetresPermises([fen(10, 10.5)], [], 60, options)).toEqual([]);
    const r = fenetresPermises([fen(10, 20)], [], 60, options);
    expect(r[0].finSec - r[0].debutSec).toBe(4);
  });

  it("applique le plafond par minute", () => {
    const demandes = [fen(5, 7), fen(15, 17), fen(25, 27), fen(35, 37), fen(45, 47)];
    const r = fenetresPermises(demandes, [], 120, options);
    expect(r.map((f) => f.debutSec)).toEqual([5, 15, 25]);
    const apres = fenetresPermises([...demandes, fen(70, 72)], [], 120, options);
    expect(apres.map((f) => f.debutSec)).toEqual([5, 15, 25, 70]);
  });

  it("respecte l'écart minimal entre deux fenêtres", () => {
    const r = fenetresPermises([fen(10, 12), fen(14, 16), fen(17, 19)], [], 60, options);
    expect(r.map((f) => f.debutSec)).toEqual([10, 17]);
  });

  it("même entrée = même sortie, quel que soit l'ordre des demandes", () => {
    const demandes = [fen(30, 32), fen(10, 12), fen(50, 52)];
    const a = fenetresPermises(demandes, [], 60, options);
    const b = fenetresPermises([...demandes].reverse(), [], 60, options);
    expect(a).toEqual(b);
    expect(fenetresPermises(demandes, [], 60, options)).toEqual(a);
  });

  it("ne modifie pas ses entrées", () => {
    const demandes = [fen(0, 30, 1.2)];
    const copie = JSON.stringify(demandes);
    fenetresPermises(demandes, [], 60, options);
    expect(JSON.stringify(demandes)).toBe(copie);
  });

  it("demandes vides = []", () => {
    expect(fenetresPermises([], [], 60, options)).toEqual([]);
  });

  it("aucun import de ce dossier depuis studio-rendu/ ni ailleurs en production", () => {
    const racine = resolve(__dirname, "../..");
    const trouves: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        if (nom === "node_modules" || nom === ".next") continue;
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) {
          if (chemin.endsWith(join("src", "briques", "zoom-gratuit"))) continue;
          parcourir(chemin);
        } else if (/\.(ts|tsx)$/.test(nom) && readFileSync(chemin, "utf8").includes("zoom-gratuit")) {
          trouves.push(chemin);
        }
      }
    };
    parcourir(join(racine, "studio-rendu"));
    expect(trouves).toEqual([]);
  });
});
