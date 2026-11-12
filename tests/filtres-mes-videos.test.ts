/** Lot M (08/11, Williams) : « Mes vidéos », classer par réseau et par étape, dans l'adresse. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { compterParReseau, filtrerCartes, lienFiltres, lireFiltres } from "@/domaine/filtres-mes-videos";
import { FiltresMesVideos } from "@/components/videos/FiltresMesVideos";
import type { IdReseau } from "@/domaine/types";

const c = (id: string, reseaux: IdReseau[], etapeEditoriale?: "a_relire" | "validee" | "programmee" | "publiee", format = "facecam") => ({ id, reseaux, etapeEditoriale, format: { id: format } });
const CARTES = [
  c("a", ["linkedin"], "validee"),
  c("b", ["linkedin", "instagram"], "a_relire"),
  c("c", ["instagram"], "validee", "avocat"),
  c("d", ["tiktok"], undefined),
];

describe("lireFiltres", () => {
  it("lit réseau, étape et format ; ignore les valeurs inconnues", () => {
    expect(lireFiltres({ reseau: "linkedin", etape: "validee", format: "avocat" })).toEqual({ reseau: "linkedin", etape: "validee", format: "avocat" });
    expect(lireFiltres({ reseau: "myspace", etape: "nimporte" })).toEqual({});
    expect(lireFiltres({ reseau: ["linkedin", "tiktok"] })).toEqual({ reseau: "linkedin" });
    expect(lireFiltres({})).toEqual({});
  });
});

describe("filtrerCartes", () => {
  it("réseau et étape se cumulent", () => {
    expect(filtrerCartes(CARTES, { reseau: "linkedin", etape: "validee" }).map((x) => x.id)).toEqual(["a"]);
    expect(filtrerCartes(CARTES, { reseau: "instagram" }).map((x) => x.id)).toEqual(["b", "c"]);
    expect(filtrerCartes(CARTES, { etape: "a_relire" }).map((x) => x.id)).toEqual(["b"]);
    expect(filtrerCartes(CARTES, { format: "avocat" }).map((x) => x.id)).toEqual(["c"]);
  });
  it("sans filtre tout passe ; une carte sans réseau ne passe pas un filtre réseau", () => {
    expect(filtrerCartes(CARTES, {})).toHaveLength(4);
    expect(filtrerCartes([{ id: "x", format: { id: "f" } }], { reseau: "linkedin" })).toEqual([]);
  });
});

describe("compterParReseau", () => {
  it("seulement les réseaux présents, dans l'ordre du registre, avec leur nombre", () => {
    expect(compterParReseau(CARTES)).toEqual([
      { reseau: "linkedin", nombre: 2 },
      { reseau: "instagram", nombre: 2 },
      { reseau: "tiktok", nombre: 1 },
    ]);
    expect(compterParReseau([])).toEqual([]);
  });
});

describe("lienFiltres", () => {
  it("garde les autres paramètres ; « Tous » retire le paramètre", () => {
    expect(lienFiltres("/videos", { vue: "brouillons", etape: "validee" }, { reseau: "linkedin" })).toBe("/videos?vue=brouillons&etape=validee&reseau=linkedin");
    expect(lienFiltres("/videos", { reseau: "linkedin", etape: "validee" }, { reseau: undefined })).toBe("/videos?etape=validee");
    expect(lienFiltres("/videos", { reseau: "linkedin" }, { reseau: undefined })).toBe("/videos");
    expect(lienFiltres("/formats/avocat", { etape: "a_relire" }, { reseau: "tiktok" })).toBe("/formats/avocat?etape=a_relire&reseau=tiktok");
  });
});

describe("FiltresMesVideos", () => {
  const rendu = (filtres: Parameters<typeof FiltresMesVideos>[0]["filtres"], params = {}) =>
    renderToStaticMarkup(createElement(FiltresMesVideos, { base: "/videos", params, filtres, reseaux: compterParReseau(CARTES) }));

  it("deux rangées de liens, puce active marquée, réseaux présents seulement", () => {
    const h = rendu({ reseau: "linkedin", etape: "validee" }, { reseau: "linkedin", etape: "validee" });
    for (const t of ["Réseau", "Étape", "Toutes", "À relire", "Validées", "Programmées", "Publiées", "LinkedIn", "Instagram"]) expect(h).toContain(t);
    expect(h).not.toContain("Facebook");
    expect((h.match(/aria-current="true"/g) ?? []).length).toBe(2);
    expect(h).toContain('href="/videos?etape=validee"');
    expect(h).toContain('href="/videos?reseau=linkedin&amp;etape=a_relire"');
  });

  it("sans filtre, « Tous » et « Toutes » sont actives", () => {
    expect((rendu({}).match(/aria-current="true"/g) ?? []).length).toBe(2);
  });

  it("défilement horizontal sans barre sur mobile", () => {
    expect(rendu({})).toContain("overflow-x-auto");
    expect(rendu({})).toContain("sans-barre");
  });
});
