/** G3-04 — opérations pures de retouche des artefacts de la démo : zoom, surlignage, légende, style ; revalidation, remarques sans refus. */
import { describe, expect, it } from "vitest";
import { appliquerOperationsDemo, type OperationDemo } from "@/moteurs/montage-demo-facecam/operations";
import type { ArtefactsDemo } from "@/moteurs/montage-demo-facecam/artefacts";

const base = (): ArtefactsDemo => ({
  pistes: { zooms: [{ debutMs: 0, finMs: 1000, x: 10, y: 10, facteur: 1.5 }], clics: [{ ms: 5, x: 1, y: 2 }], surlignages: [], legendes: [] },
  styleSousTitres: { prononciations: [] },
});

describe("opérations de retouche de la démo", () => {
  it("sans opération : mêmes artefacts, sans remarque, entrée non modifiée", () => {
    const a = base();
    const copie = JSON.stringify(a);
    const r = appliquerOperationsDemo(a, []);
    expect(r.artefacts).toEqual(a);
    expect(r.remarques).toEqual([]);
    expect(JSON.stringify(a)).toBe(copie);
  });
  it("zoom : ajouté, facteur borné à 2,5, % bornés", () => {
    const r = appliquerOperationsDemo(base(), [{ type: "zoom", debutMs: 2000, finMs: 3000, x: 150, y: 50, facteur: 9 }]);
    expect(r.artefacts.pistes?.zooms).toHaveLength(2);
    expect(r.artefacts.pistes?.zooms[1]).toEqual({ debutMs: 2000, finMs: 3000, x: 100, y: 50, facteur: 2.5 });
    expect(r.remarques).toEqual([]);
  });
  it("zoom qui chevauche : écarté avec remarque, pas de refus", () => {
    const r = appliquerOperationsDemo(base(), [{ type: "zoom", debutMs: 500, finMs: 1500, x: 5, y: 5 }]);
    expect(r.artefacts.pistes?.zooms).toHaveLength(1);
    expect(r.remarques).toHaveLength(1);
  });
  it("surlignage et légende ajoutés ; légende rognée à 80 signes", () => {
    const r = appliquerOperationsDemo(base(), [
      { type: "surligne", debutMs: 0, finMs: 500, x: 10, y: 10, largeur: 20, hauteur: 5 },
      { type: "legende", debutMs: 0, finMs: 500, texte: "x".repeat(200) },
    ]);
    expect(r.artefacts.pistes?.surlignages).toHaveLength(1);
    expect(r.artefacts.pistes?.legendes[0].texte).toHaveLength(80);
  });
  it("opération mal formée ou inconnue : ignorée avec remarque, le reste s'applique", () => {
    const ops = [{ type: "legende", debutMs: 5, finMs: 1, texte: "a" }, { type: "inconnu" }, null, { type: "legende", debutMs: 0, finMs: 9, texte: "ok" }] as unknown as OperationDemo[];
    const r = appliquerOperationsDemo(base(), ops);
    expect(r.artefacts.pistes?.legendes).toEqual([{ debutMs: 0, finMs: 9, texte: "ok" }]);
    expect(r.remarques).toHaveLength(3);
  });
  it("retirer : par piste et indice ; indice hors borne = remarque", () => {
    const r = appliquerOperationsDemo(base(), [{ type: "retirer", piste: "zooms", index: 0 }, { type: "retirer", piste: "clics", index: 7 }]);
    expect(r.artefacts.pistes?.zooms).toEqual([]);
    expect(r.artefacts.pistes?.clics).toHaveLength(1);
    expect(r.remarques).toHaveLength(1);
  });
  it("style : change la base et l'intensité, garde les prononciations ; valeurs mal typées écartées", () => {
    const r = appliquerOperationsDemo(base(), [{ type: "style", base: "pop" as never, intensite: "fort" as never }]);
    expect(r.artefacts.styleSousTitres).toEqual({ prononciations: [], base: "pop", intensite: "fort" });
    const r2 = appliquerOperationsDemo(base(), [{ type: "style", base: 4 } as unknown as OperationDemo]);
    expect(r2.artefacts.styleSousTitres).toEqual({ prononciations: [] });
    expect(r2.remarques).toHaveLength(1);
  });
  it("artefacts absents ou mal formés : pas d'exception", () => {
    expect(() => appliquerOperationsDemo(undefined as never, [{ type: "legende", debutMs: 0, finMs: 5, texte: "a" }])).not.toThrow();
    expect(appliquerOperationsDemo({}, [{ type: "legende", debutMs: 0, finMs: 5, texte: "a" }]).artefacts.pistes?.legendes).toHaveLength(1);
  });
  it("l'opération « passage » n'existe pas ici : remarque, rien d'appliqué", () => {
    const r = appliquerOperationsDemo(base(), [{ type: "passage" } as unknown as OperationDemo]);
    expect(r.artefacts).toEqual(base());
    expect(r.remarques).toHaveLength(1);
  });
});
