import { z } from "zod";
import { describe, expect, it } from "vitest";
import { construireSchemaToile, ToileSpec } from "../../src/domaine/visuels/continu/schema-toile";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords";
import type { DefinitionGabarit } from "../../src/briques/visuels/continu/registre-gabarits";

const ex = (type: string) => GABARITS.find((g) => g.type === type)!.exemple as Record<string, unknown>;
const page = (type: string) => ({ ...ex(type) });
const valide = () => ({ format: "4:5", pages: [page("X00"), page("PX1"), page("PX2"), page("PX3")], raccords: [{ type: "R01", couture: 1, y: 600 }] });

function messages(brut: unknown, schema = ToileSpec): string[] {
  const r = schema.safeParse(brut);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("continu P1 : schéma de la toile", () => {
  it("une toile X00 + PX valide passe", () => {
    expect(messages(valide())).toEqual([]);
  });

  it("refuse 2 pages et 11 pages", () => {
    const deux = { ...valide(), pages: [page("X00"), page("X02")], raccords: [] };
    expect(messages(deux).join(" ")).toMatch(/page/);
    const onze = { ...valide(), raccords: [], pages: Array.from({ length: 11 }, () => page("X01")) };
    expect(messages(onze).length).toBeGreaterThan(0);
  });

  it("refuse une clé inconnue, un type inconnu, un lien, un format et un alt trop long", () => {
    expect(messages({ ...valide(), extra: 1 }).join(" ")).toMatch(/clé inconnue/i);
    const inconnu = valide();
    inconnu.pages[1] = { ...page("PX1"), type: "Z99" };
    expect(messages(inconnu).join(" ")).toMatch(/page 2.*inconnu/);
    const lien = valide();
    lien.pages[0] = { ...page("X00"), texte: "Voir www.exemple.fr" };
    expect(messages(lien).join(" ")).toMatch(/page 1/);
    expect(messages({ ...valide(), format: "1:1" }).join(" ")).toMatch(/format/);
    const long = valide();
    long.pages[3] = { ...page("PX3"), alt: "a".repeat(126) };
    expect(messages(long).join(" ")).toMatch(/page 4/);
  });

  it("refuse les pages de parcours dans le désordre, incomplètes, ou deux parcours", () => {
    const desordre = { ...valide(), pages: [page("X00"), page("PX2"), page("PX1"), page("PX3")] };
    expect(messages(desordre).join(" ")).toMatch(/page 2.*parcours/);
    const incomplet = { ...valide(), pages: [page("X00"), page("PX1"), page("PX2"), page("X02")] };
    expect(messages(incomplet).join(" ")).toMatch(/page 3.*parcours|page 4.*parcours/);
  });

  it("refuse deux parcours dans la même toile", () => {
    const px = PARCOURS.find((p) => p.id === "PX")!;
    const copies = [1, 2, 3].map((i) => {
      const g = GABARITS.find((x) => x.type === `PX${i}`)!;
      return { ...g, type: `PY${i}`, schema: z.object({ type: z.literal(`PY${i}`), alt: z.string().max(125), rubrique: z.string().optional(), titre: z.string(), texte: z.string() }).strict(), exemple: { ...(g.exemple as object), type: `PY${i}` } };
    });
    const schema = construireSchemaToile([...GABARITS, ...copies], [...PARCOURS, { ...px, id: "PY" as never, pagesTypes: ["PY1", "PY2", "PY3"] }], RACCORDS);
    const brut = { format: "4:5", raccords: [], pages: [page("X00"), page("PX1"), page("PX2"), page("PX3"), ...copies.map((c) => ({ ...(c.exemple as object) }))] };
    expect(messages(brut, schema).join(" ")).toMatch(/un seul parcours/);
  });

  it("refuse deux pages sombres de suite et la même plaquette deux fois", () => {
    const sombres = GABARITS.map((g) => (g.type === "PX1" || g.type === "PX2" ? { ...g, sombre: true } : g));
    const schema = construireSchemaToile(sombres, PARCOURS, RACCORDS);
    expect(messages(valide(), schema).join(" ")).toMatch(/sombre/);
    const double = { ...valide(), raccords: [], pages: [page("X00"), page("X01"), page("X01"), page("X02")] };
    expect(messages(double).join(" ")).toMatch(/page 3.*déjà/);
  });

  it("refuse un raccord sur une couture interne au parcours, sur la couture 0 ou N", () => {
    const interne = { ...valide(), raccords: [{ type: "R01", couture: 2, y: 600 }] };
    expect(messages(interne).join(" ")).toMatch(/parcours/);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 0, y: 600 }] }).join(" ")).toMatch(/couture/);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 4, y: 600 }] }).join(" ")).toMatch(/couture/);
  });

  it("refuse une page 1 qui n'est pas une couverture quand le parcours ne commence pas", () => {
    const sans = { ...valide(), raccords: [], pages: [page("PX1"), page("PX2"), page("PX3")] };
    expect(messages(sans).join(" ")).toMatch(/page 1.*couverture/);
  });

  it("tous les messages sont en français et nomment la page", () => {
    const mauvais = { ...valide(), raccords: [], pages: [page("PX1"), page("X01"), page("X01"), page("X02")] };
    const msgs = messages(mauvais);
    expect(msgs.length).toBeGreaterThan(0);
    for (const m of msgs) expect(m).toMatch(/^(la page \d+|le raccord|la toile)/i);
  });
});
