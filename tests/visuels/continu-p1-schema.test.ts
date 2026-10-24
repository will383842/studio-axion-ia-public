import { z } from "zod";
import { describe, expect, it } from "vitest";
import { construireSchemaToile, ToileSpec } from "../../src/domaine/visuels/continu/schema-toile";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords";
import type { DefinitionGabarit } from "../../src/briques/visuels/continu/registre-gabarits";

const ex = (type: string) => GABARITS.find((g) => g.type === type)!.exemple as Record<string, unknown>;
const page = (type: string) => ({ ...ex(type) });
const valide = () => ({
  version: "toile/1",
  format: "4:5",
  pages: [page("X00"), page("PX1"), page("PX2"), page("PX3"), page("X02")],
  raccords: [{ type: "R01", couture: 1, y: 600 }],
});

const PREFIXE = /^(la page \d+|le raccord \d+|la toile) : /;
const ANGLAIS = /\b(too|expected|invalid|unrecognized|received|string|number|object|must|required)\b/i;

function messages(brut: unknown, schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string }[] } } } = ToileSpec): string[] {
  const r = schema.safeParse(brut);
  return r.success ? [] : r.error!.issues.map((i) => i.message);
}

/** Gabarit d'essai supplémentaire, copié d'un gabarit existant. */
function clone(base: DefinitionGabarit, type: string, extra: Partial<DefinitionGabarit> = {}): DefinitionGabarit {
  return {
    ...base,
    type,
    schema: z.strictObject({ type: z.literal(type), alt: z.string().max(125), rubrique: z.string().optional(), titre: z.string(), texte: z.string() }),
    exemple: { ...(base.exemple as object), type },
    ...extra,
  };
}

describe("continu P1 : schéma de la toile", () => {
  it("une toile X00 + PX + appel valide passe", () => {
    expect(messages(valide())).toEqual([]);
  });

  it("refuse 2 pages : « au moins 3 »", () => {
    const deux = { ...valide(), pages: [page("X00"), page("X02")], raccords: [] };
    expect(messages(deux).join(" ")).toMatch(/au moins 3/);
  });

  it("refuse 11 pages de 11 types distincts : « au plus 10 »", () => {
    const base = GABARITS.find((g) => g.type === "X01")!;
    const clones = Array.from({ length: 11 }, (_, i) => clone(base, `Z${String(i).padStart(2, "0")}`));
    const schema = construireSchemaToile([...GABARITS, ...clones], PARCOURS, RACCORDS);
    const onze = { ...valide(), raccords: [], pages: clones.map((c) => ({ ...(c.exemple as object) })) };
    const msgs = messages(onze, schema);
    expect(msgs.some((m) => /au plus 10/.test(m)), msgs.join(" | ")).toBe(true);
    expect(msgs.some((m) => /déjà utilisée/.test(m))).toBe(false);
  });

  it("refuse une clé inconnue, un type inconnu, un lien, un format et un alt trop long", () => {
    expect(messages({ ...valide(), extra: 1 }).join(" ")).toMatch(/clé inconnue/);
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

  it("refuse une version de modèle absente ou différente", () => {
    const sans: Record<string, unknown> = valide();
    delete sans.version;
    expect(messages(sans).join(" ")).toMatch(/^la toile : version/);
    expect(messages({ ...valide(), version: "toile/2" }).join(" ")).toMatch(/^la toile : version/);
  });

  it("renvoie les données validées : le titre est rogné", () => {
    const brut = valide();
    brut.pages[0] = { ...page("X00"), titre: "  Titre  " };
    const r = ToileSpec.safeParse(brut);
    expect(r.success).toBe(true);
    expect((r.data!.pages[0] as unknown as { titre: string }).titre).toBe("Titre");
  });

  it("refuse les pages de parcours dans le désordre, incomplètes, ou deux parcours", () => {
    const desordre = { ...valide(), pages: [page("X00"), page("PX2"), page("PX1"), page("PX3"), page("X02")] };
    expect(messages(desordre).join(" ")).toMatch(/page 2.*parcours/);
    const incomplet = { ...valide(), raccords: [], pages: [page("X00"), page("PX1"), page("PX2"), page("X02")] };
    expect(messages(incomplet).join(" ")).toMatch(/page 3.*parcours|page 4.*parcours/);
  });

  it("refuse deux parcours dans la même toile", () => {
    const px = PARCOURS.find((p) => p.id === "PX")!;
    const copies = [1, 2, 3].map((i) => clone(GABARITS.find((x) => x.type === `PX${i}`)!, `PY${i}`));
    const schema = construireSchemaToile([...GABARITS, ...copies], [...PARCOURS, { ...px, id: "PY" as never, pagesTypes: ["PY1", "PY2", "PY3"] }], RACCORDS);
    const brut = { version: "toile/1", format: "4:5", raccords: [], pages: [page("X00"), page("PX1"), page("PX2"), page("PX3"), ...copies.map((c) => ({ ...(c.exemple as object) }))] };
    expect(messages(brut, schema).join(" ")).toMatch(/un seul parcours/);
  });

  it("refuse deux pages sombres de suite", () => {
    const sombres = GABARITS.map((g) => (g.type === "PX1" || g.type === "PX2" ? { ...g, sombre: true } : g));
    const schema = construireSchemaToile(sombres, PARCOURS, RACCORDS);
    expect(messages(valide(), schema).join(" ")).toMatch(/sombre/);
  });

  it("refuse deux pages sombres NON voisines : une seule page sombre au total", () => {
    const sombres = GABARITS.map((g) => (g.type === "X00" || g.type === "PX2" ? { ...g, sombre: true } : g));
    const schema = construireSchemaToile(sombres, PARCOURS, RACCORDS);
    expect(messages(valide(), schema)).toEqual(["la page 3 : une toile n'a qu'une seule page sombre (déjà la page 1)"]);
  });

  it("accepte une seule page sombre", () => {
    const sombres = GABARITS.map((g) => (g.type === "PX2" ? { ...g, sombre: true } : g));
    expect(messages(valide(), construireSchemaToile(sombres, PARCOURS, RACCORDS))).toEqual([]);
  });

  it("refuse la même plaquette deux fois", () => {
    const double = { ...valide(), raccords: [], pages: [page("X00"), page("X01"), page("X01"), page("X02")] };
    expect(messages(double).join(" ")).toMatch(/page 3.*déjà/);
  });

  it("refuse une dernière page qui n'est pas un appel", () => {
    const sans = { ...valide(), raccords: [], pages: [page("X00"), page("X01"), page("PX1"), page("PX2"), page("PX3")] };
    expect(messages(sans)).toEqual(["la page 5 : la dernière page doit être un appel (ou la fin d'un parcours qui termine)"]);
  });

  it("accepte une dernière page qui clôt un parcours qui termine", () => {
    const termine = PARCOURS.map((p) => (p.id === "PX" ? { ...p, termine: true } : p));
    const brut = { ...valide(), raccords: [], pages: [page("X00"), page("PX1"), page("PX2"), page("PX3")] };
    expect(messages(brut, construireSchemaToile(GABARITS, termine, RACCORDS))).toEqual([]);
    expect(messages(brut).join(" ")).toMatch(/page 4.*dernière page/);
  });

  it("refuse un raccord sur une couture interne au parcours, sur la couture 0 ou N", () => {
    const interne = { ...valide(), raccords: [{ type: "R01", couture: 2, y: 600 }] };
    expect(messages(interne).join(" ")).toMatch(/parcours/);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 0, y: 600 }] }).join(" ")).toMatch(/couture/);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 5, y: 600 }] }).join(" ")).toMatch(/couture/);
  });

  it("refuse un raccord plus bas que la toile (4:5 : y = 1400 > 1350)", () => {
    const bas = { ...valide(), raccords: [{ type: "R01", couture: 1, y: 1400 }] };
    expect(messages(bas).join(" ")).toMatch(/^le raccord 1 : y .*1350/);
    expect(messages({ ...bas, format: "3:4" })).toEqual([]);
  });

  it("refuse une page 1 qui n'est pas une couverture quand le parcours ne commence pas", () => {
    const sans = { ...valide(), raccords: [], pages: [page("PX1"), page("PX2"), page("PX3"), page("X02")] };
    expect(messages(sans).join(" ")).toMatch(/page 1.*couverture/);
  });

  it("tous les messages sont en français et nomment la page, le raccord ou la toile", () => {
    const mauvais = { ...valide(), raccords: [], pages: [page("PX1"), page("X01"), page("X01"), page("PX3")] };
    const msgs = messages(mauvais);
    expect(msgs.length).toBeGreaterThan(0);
    for (const m of msgs) expect(m).toMatch(PREFIXE);
  });

  it("messages zod traduits : alt long, y hors borne, page non-objet, format, clés inconnues", () => {
    const long = valide();
    long.pages[3] = { ...page("PX3"), alt: "a".repeat(126) };
    expect(messages(long)).toEqual(["la page 4 : alt : ne doit pas dépasser 125 caractères"]);

    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 1, y: -1 }] })).toEqual(["le raccord 1 : y : doit être au moins 0"]);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 1, y: 5000 }] }).join(" ")).toMatch(/^le raccord 1 : y : /);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 1, y: "haut" }] })).toEqual(["le raccord 1 : y : doit être un nombre"]);
    expect(messages({ ...valide(), raccords: [{ type: "R01", couture: 1, y: 600, z: 1 }] })).toEqual(["le raccord 1 : clé inconnue : z"]);

    const nonObjet = valide();
    (nonObjet.pages as unknown[])[1] = 42;
    expect(messages(nonObjet)).toEqual(["la page 2 : doit être un objet"]);

    expect(messages({ ...valide(), format: "1:1" })).toEqual(["la toile : format : doit être « 4:5 » ou « 3:4 »"]);
    expect(messages({ ...valide(), extra: 1 })).toEqual(["la toile : clé inconnue : extra"]);
    const cle = valide();
    cle.pages[1] = { ...page("PX1"), zzz: 1 };
    expect(messages(cle)).toEqual(["la page 2 : clé inconnue : zzz"]);
    const vide = valide();
    vide.pages[0] = { ...page("X00"), titre: "" };
    expect(messages(vide)).toEqual(["la page 1 : titre : doit compter au moins 1 caractère"]);

    const lot = [long, { ...valide(), format: "1:1" }, nonObjet, { ...valide(), pages: "non" }, { ...valide(), raccords: "non" }, "texte", null];
    for (const brut of lot) {
      const msgs = messages(brut);
      expect(msgs.length).toBeGreaterThan(0);
      for (const m of msgs) {
        expect(m).toMatch(PREFIXE);
        expect(m).not.toMatch(ANGLAIS);
      }
    }
  });
});
