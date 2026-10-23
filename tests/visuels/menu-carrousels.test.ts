/**
 * Menu (18/10) : carrousels, infographies et vidéos sont trois familles distinctes. « Carrousels » est une entrée de premier
 * niveau, après « Mes vidéos » (et ses sous-entrées, qui sont les formats), avant « Calendrier ».
 */
import { describe, expect, it } from "vitest";
import { NAV_LATERALE, TUILES_PLUS, ONGLETS_BAS, estActif, navigationLaterale, tuilesPlusMobile } from "../../src/components/coquille/navigation";

describe("menu : entrée Carrousels", () => {
  const menu = navigationLaterale([], true);
  const libelles = menu.map((e) => e.libelle);

  it("existe en premier niveau, vers /carrousels", () => {
    const e = menu.find((x) => x.libelle === "Carrousels");
    expect(e?.href).toBe("/carrousels");
  });

  it("est placée après « Mes vidéos » et juste avant « Calendrier »", () => {
    const i = libelles.indexOf("Carrousels");
    expect(i).toBeGreaterThan(libelles.indexOf("Mes vidéos"));
    expect(libelles[i + 1]).toBe("Calendrier");
  });

  it("n'est pas rangée sous « Mes vidéos » : « Mes vidéos » ne s'allume pas sur /carrousels et inversement", () => {
    const videos = NAV_LATERALE.find((e) => e.libelle === "Mes vidéos")!;
    const carrousels = NAV_LATERALE.find((e) => e.libelle === "Carrousels")!;
    expect(videos.actifSur ?? []).not.toContain("/carrousels");
    expect(estActif("/carrousels", videos)).toBe(false);
    expect(estActif("/carrousels", carrousels)).toBe(true);
    expect(estActif("/carrousels/nouveau", carrousels)).toBe(true);
    expect(estActif("/carrousels/abc", carrousels)).toBe(true);
    expect(estActif("/reglages/carrousels", carrousels)).toBe(false);
    expect(estActif("/videos", carrousels)).toBe(false);
  });

  it("pas d'entrée Infographies (le générateur n'existe pas encore)", () => {
    expect(libelles.some((l) => /infographie/i.test(l))).toBe(false);
  });

  it("mobile : dans la feuille « Plus », jamais mélangée aux onglets Vidéos", () => {
    expect(tuilesPlusMobile(false).some((t) => t.href === "/carrousels")).toBe(true);
    expect(TUILES_PLUS.filter((t) => t.href === "/carrousels")).toHaveLength(1);
    const videos = ONGLETS_BAS.find((o) => o.href === "/videos")!;
    expect(videos.actifSur ?? []).not.toContain("/carrousels");
  });
});
