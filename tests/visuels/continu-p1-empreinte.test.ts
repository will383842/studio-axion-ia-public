import { describe, expect, it } from "vitest";
import { empreinteToile } from "../../src/domaine/visuels/continu/empreinte";
import type { ToileSpecType } from "../../src/domaine/visuels/continu/schema-toile";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords";

const ex = (type: string) => GABARITS.find((g) => g.type === type)!.exemple;
const toile = () => ({ version: "toile/1", format: "4:5", pages: [ex("X00"), ex("PX1"), ex("PX2"), ex("PX3"), ex("X02")], raccords: [{ type: "R01", couture: 1, y: 600 }] }) as unknown as ToileSpecType;

/** Change la version d'une entrée de registre le temps d'un appel. */
function avecVersion<T extends { version: number }>(entree: T, valeur: number, f: () => string): string {
  const avant = entree.version;
  entree.version = valeur;
  try {
    return f();
  } finally {
    entree.version = avant;
  }
}

describe("continu P1 : empreinte de la toile", () => {
  it("est un sha256 hexadécimal stable", () => {
    expect(empreinteToile(toile())).toMatch(/^[0-9a-f]{64}$/);
    expect(empreinteToile(toile())).toBe(empreinteToile(toile()));
  });
  it("ne dépend pas de l'ordre des clés", () => {
    const t = toile();
    const renverse = { raccords: t.raccords.map((r) => Object.fromEntries(Object.entries(r).reverse())), pages: t.pages.map((p) => Object.fromEntries(Object.entries(p).reverse())), format: t.format, version: t.version } as unknown as ToileSpecType;
    expect(empreinteToile(renverse)).toBe(empreinteToile(t));
  });
  it("change avec le contenu", () => {
    const t = toile();
    t.pages[0] = { ...t.pages[0], titre: "Autre titre" };
    expect(empreinteToile(t)).not.toBe(empreinteToile(toile()));
  });
  it("change avec la version d'un gabarit utilisé, d'un parcours ou d'un raccord", () => {
    const base = empreinteToile(toile());
    expect(avecVersion(GABARITS.find((g) => g.type === "X00")!, 2, () => empreinteToile(toile()))).not.toBe(base);
    expect(avecVersion(PARCOURS.find((p) => p.id === "PX")!, 2, () => empreinteToile(toile()))).not.toBe(base);
    expect(avecVersion(RACCORDS.find((r) => r.type === "R01")!, 2, () => empreinteToile(toile()))).not.toBe(base);
  });
  it("ne change pas avec la version d'un gabarit absent de la toile", () => {
    expect(avecVersion(GABARITS.find((g) => g.type === "X01")!, 2, () => empreinteToile(toile()))).toBe(empreinteToile(toile()));
  });
});
