/**
 * Menu en sections (08/11, Williams : « parfaitement compréhensible, avec une UI parfaite et sans friction »).
 * Règles tirées des bonnes pratiques 2026 : sections de 2 à 4 entrées, titres tirés du travail, réglages dans le pied,
 * une icône par entrée, libellés courts sans jargon, la même organisation sur ordinateur et sur mobile.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/reglages" }));

const { NAV_PIED, ONGLETS_BAS, SECTIONS_NAV, sectionsLaterales, sectionsPlusMobile, navigationLaterale } = await import("@/components/coquille/navigation");
const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");

const toutes = (surLeSite: boolean, aPublier: boolean) => [...sectionsLaterales(surLeSite, aPublier).flatMap((s) => s.entrees), ...NAV_PIED];

describe("structure du menu", () => {
  it("sections titrées : Contenus, Publier et mesurer, Ressources ; la tête n'a pas de titre", () => {
    expect(SECTIONS_NAV.map((s) => s.titre)).toEqual([null, "Contenus", "Publier et mesurer", "Ressources"]);
    expect(SECTIONS_NAV[0].entrees.map((e) => e.href)).toEqual(["/", "/nouvelle"]);
  });

  it("chaque section titrée a de 2 à 4 entrées (6 au plus quand « Vidéos validées » et « Sur le site » sont allumés)", () => {
    for (const s of SECTIONS_NAV.filter((x) => x.titre)) {
      expect(s.entrees.length).toBeGreaterThanOrEqual(2);
      expect(s.entrees.length).toBeLessThanOrEqual(4);
    }
    for (const s of sectionsLaterales(true, true)) expect(s.entrees.length).toBeLessThanOrEqual(6);
  });

  it("« Vidéos validées » (ex « À publier », décision de Williams du 08/11) et « Sur le site » se rangent juste après « Calendrier »", () => {
    const publier = sectionsLaterales(true, true).find((s) => s.titre === "Publier et mesurer")!;
    expect(publier.entrees.map((e) => e.href).slice(0, 3)).toEqual(["/calendrier", "/a-publier", "/sur-le-site"]);
    expect(publier.entrees[1].libelle).toBe("Vidéos validées");
    expect(navigationLaterale([], false, false).some((e) => e.href === "/a-publier" || e.href === "/sur-le-site")).toBe(false);
  });

  it("Réglages et la veille sont dans le pied, jamais dans une section", () => {
    expect(NAV_PIED.map((e) => e.href)).toEqual(["/veille", "/reglages"]);
    for (const s of SECTIONS_NAV) for (const e of s.entrees) expect(["/veille", "/reglages"]).not.toContain(e.href);
  });

  it("aucune adresse ni icône en double ; libellés courts, sans jargon technique", () => {
    const entrees = toutes(true, true);
    expect(new Set(entrees.map((e) => e.href)).size).toBe(entrees.length);
    expect(new Set(entrees.map((e) => e.icone)).size).toBe(entrees.length);
    for (const e of entrees) {
      expect(e.libelle.length).toBeLessThanOrEqual(22);
      expect(e.libelle).not.toMatch(/zernio|buffer|heygen|remotion|api|lut/i);
    }
  });
});

describe("mobile : même organisation que l'ordinateur", () => {
  it("la feuille « Plus » contient exactement le menu moins les onglets du bas, dans le même ordre", () => {
    for (const [surLeSite, aPublier] of [[false, false], [true, true]] as const) {
      const dansOnglets = new Set(ONGLETS_BAS.map((o) => o.href));
      const attendu = toutes(surLeSite, aPublier).filter((e) => !dansOnglets.has(e.href)).map((e) => e.href);
      expect(sectionsPlusMobile(surLeSite, aPublier).flatMap((s) => s.entrees.map((e) => e.href))).toEqual(attendu);
    }
  });

  it("chaque section de la feuille « Plus » a un titre, et aucune n'est vide", () => {
    for (const s of sectionsPlusMobile(true, true)) {
      expect(s.titre).toBeTruthy();
      expect(s.entrees.length).toBeGreaterThan(0);
    }
  });
});

describe("rendu de la barre latérale", () => {
  const html = renderToStaticMarkup(createElement(BarreLaterale, { formats: [], actionDeconnexion: async () => undefined, surLeSite: true, aPublier: true }));

  it("affiche les titres de section, reliés à leur liste", () => {
    for (const titre of ["Contenus", "Publier et mesurer", "Ressources"]) expect(html).toContain(`>${titre}</p>`);
    expect(html.match(/aria-labelledby="/g)?.length).toBe(3);
  });

  it("un seul repère de navigation, et l'entrée de la page en cours porte aria-current", () => {
    expect(html.match(/<nav/g)?.length).toBe(1);
    expect(html).not.toContain("<aside");
    const lien = html.match(/<a[^>]*href="\/reglages"[^>]*>/)?.[0] ?? "";
    expect(lien).toContain('aria-current="page"');
    expect(html.match(/aria-current="page"/g)?.length).toBe(1);
  });

  it("le pied (veille, réglages) est hors de la zone qui défile", () => {
    const zoneDefilante = html.slice(html.indexOf("overflow-y-auto"), html.indexOf("shrink-0 space-y-0.5 border-t"));
    expect(zoneDefilante).not.toContain('href="/reglages"');
    expect(zoneDefilante).not.toContain('href="/veille"');
    expect(html).toContain('href="/reglages"');
  });
});
