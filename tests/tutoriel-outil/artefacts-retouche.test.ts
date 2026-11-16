import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { artefactsTutoriel, avecArtefacts, lireArtefactsTutoriel, type CaptureGardee } from "@/moteurs/montage-tutoriel-outil/artefacts-retouche";
import { etapesTutoriel } from "@/moteurs/montage-tutoriel-outil/etapes-tutoriel";

const CHEMIN = "src/moteurs/montage-tutoriel-outil/artefacts-retouche.ts";
const script = "D'abord ouvrez l'outil. Ensuite cliquez sur Importer. Enfin exportez le fichier.";
const mots = script.split(/\s+/).map((mot, i) => ({ mot, debutSec: i, finSec: i + 0.5 }));
const sortie = etapesTutoriel({ script, mots, dureeSec: 60 });
const capture: CaptureGardee = {
  cle: "captures/a.png", largeur: 1920, hauteur: 1080, empreinte: "abc",
  zones: [{ sceneId: "s1", cadre: { x: 10, y: 20, largeur: 30, hauteur: 40 }, zoom: 2, curseur: [{ x: 5, y: 6 }] }, { sceneId: "s2" }],
};

describe("artefacts de retouche du tutoriel", () => {
  it("aller-retour sans perte", () => {
    const a = artefactsTutoriel(sortie, [capture]);
    a.pastilles = [{ etapeId: "1", texte: "Cliquez ici" }];
    const projet = avecArtefacts({ script: "x" }, a);
    expect(lireArtefactsTutoriel(JSON.parse(JSON.stringify(projet)))).toEqual(a);
    expect(projet.script).toBe("x");
  });
  it("copie profonde et aucune clé vide", () => {
    const a = artefactsTutoriel({ etapes: [], chapitres: [] }, []);
    expect(a).toEqual({});
    expect(Object.keys(a)).toEqual([]);
    const b = artefactsTutoriel(sortie);
    expect(b.etapes).toEqual(sortie.etapes);
    expect(b.etapes![0]).not.toBe(sortie.etapes[0]);
    expect("captures" in b).toBe(false);
  });
  it("données mal formées : ignorées ou bornées, aucune exception", () => {
    for (const v of [null, undefined, 3, "x", [], { etapes: "x", captures: null }]) expect(() => lireArtefactsTutoriel(v)).not.toThrow();
    expect(lireArtefactsTutoriel(null)).toEqual({});
    const r = lireArtefactsTutoriel({
      etapes: [null, { numero: "1" }, sortie.etapes[0]],
      chapitres: [{ titre: 3, debutSec: 0 }, { titre: "ok", debutSec: 2 }],
      captures: [{ cle: "c", largeur: "10", hauteur: 5, empreinte: "e", zones: [] }, {
        cle: "c", largeur: 10, hauteur: 5, empreinte: "e",
        zones: [{ sceneId: "s", zoom: 9, cadre: { x: 0, y: 0, largeur: 140, hauteur: -5 }, curseur: [{ x: 150, y: 1 }, null, { x: "a", y: 1 }] }, { zoom: 2 }],
      }],
      pastilles: [{ etapeId: 1, texte: "t" }, { etapeId: "1", texte: "t" }],
    });
    expect(r.etapes).toEqual([sortie.etapes[0]]);
    expect(r.chapitres).toEqual([{ titre: "ok", debutSec: 2 }]);
    expect(r.captures).toHaveLength(1);
    expect(r.captures![0].zones).toEqual([{ sceneId: "s", zoom: 3, cadre: { x: 0, y: 0, largeur: 100, hauteur: 0 }, curseur: [{ x: 100, y: 1 }] }]);
    expect(r.pastilles).toEqual([{ etapeId: "1", texte: "t" }]);
  });
  it("zoom sous le minimum ramené à 1", () => {
    const r = lireArtefactsTutoriel({ captures: [{ cle: "c", largeur: 1, hauteur: 1, empreinte: "e", zones: [{ sceneId: "s", zoom: 0.2 }] }] });
    expect(r.captures![0].zones[0].zoom).toBe(1);
  });
  it("artefacts vides : objet égal à l'entrée", () => {
    const p = { script: "s", plan: { plan: 1 } };
    const r = avecArtefacts(p, {});
    expect(r).toEqual(p);
    expect(JSON.stringify(r)).toBe(JSON.stringify(p));
    expect(r).not.toBe(p);
  });
  it("garde statique : ni service, ni server-only, ni @/", () => {
    const src = readFileSync(CHEMIN, "utf8");
    expect(src).not.toMatch(/server-only/);
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/services\//);
  });
});
