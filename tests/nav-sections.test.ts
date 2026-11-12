/**
 * Menu à 7 rubriques (12/11, refonte R2 : décision de Williams ; avant, 3 sections fixes, 08/11, Williams : « parfaitement compréhensible, avec une UI parfaite et sans friction »).
 * Règles tirées des bonnes pratiques 2026 : sections de 2 à 4 entrées, titres tirés du travail, réglages dans le pied,
 * une icône par entrée, libellés courts sans jargon, la même organisation sur ordinateur et sur mobile.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/reglages" }));

const { ACTION_CREER, NAV_PIED, ONGLETS_BAS, RUBRIQUES_NAV, rubriquesLaterales, entreesDeRubrique, sectionsPlusMobile, navigationLaterale } = await import("@/components/coquille/navigation");
const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");

const toutes = (surLeSite: boolean, aPublier: boolean) => [...rubriquesLaterales(surLeSite, aPublier).flatMap(entreesDeRubrique), ...NAV_PIED];

describe("structure du menu", () => {
  it("sept rubriques dans l'ordre de Williams (12/11), dont trois pliables : Mes contenus, Publier, Ressources", () => {
    expect(RUBRIQUES_NAV.map((r) => r.libelle)).toEqual(["Accueil", "Écrire", "Mes contenus", "Calendrier", "Publier", "Résultats", "Ressources"]);
    expect(RUBRIQUES_NAV.filter((r) => r.enfants).map((r) => r.id)).toEqual(["contenus", "publier", "ressources"]);
  });

  it("chaque rubrique pliable a de 1 à 4 sous-rubriques (4 au plus quand « Vidéos validées » et « Sur le site » sont allumés)", () => {
    for (const r of rubriquesLaterales(true, true).filter((x) => x.enfants)) {
      expect(r.enfants!.length).toBeGreaterThanOrEqual(1);
      expect(r.enfants!.length).toBeLessThanOrEqual(4);
    }
  });

  it("« Vidéos validées » (libellé gardé tant que la fiche AP-01 ne l'a pas renommé) et « Sur le site » ouvrent « Publier », avant « Réponses automatiques »", () => {
    const publier = rubriquesLaterales(true, true).find((r) => r.id === "publier")!;
    expect(publier.enfants!.map((e) => e.href)).toEqual(["/a-publier", "/sur-le-site", "/mots"]);
    expect(publier.enfants![0].libelle).toBe("Vidéos validées");
    expect(navigationLaterale([], false, false).some((e) => e.href === "/a-publier" || e.href === "/sur-le-site")).toBe(false);
  });

  it("Réglages (qui allume aussi /veille) est dans le pied, jamais dans une rubrique ; Veille et Outils motion sortent du menu", () => {
    expect(NAV_PIED.map((e) => e.href)).toEqual(["/reglages"]);
    expect(NAV_PIED[0].actifSur).toContain("/veille");
    for (const e of toutes(true, true)) expect(["/veille", "/outils-motion"]).not.toContain(e.href);
    for (const e of RUBRIQUES_NAV.flatMap(entreesDeRubrique)) expect(["/veille", "/reglages"]).not.toContain(e.href);
  });

  it("« Tous mes contenus » et « Mes modèles » ont quitté la barre (leurs pages restent)", () => {
    const hrefs = toutes(true, true).map((e) => e.href);
    expect(hrefs).not.toContain("/contenus");
    expect(hrefs).not.toContain("/modeles");
  });

  it("Nouvelle vidéo est un bouton d'action hors liste, jamais dans une rubrique", () => {
    expect(ACTION_CREER.href).toBe("/nouvelle");
    expect(RUBRIQUES_NAV.flatMap(entreesDeRubrique).map((e) => e.href)).not.toContain("/nouvelle");
  });

  it("aucune adresse en double ; icônes distinctes entre rubriques et entre sous-rubriques ; libellés courts, sans jargon technique", () => {
    const entrees = toutes(true, true);
    expect(new Set(entrees.map((e) => e.href)).size).toBe(entrees.length);
    expect(new Set(RUBRIQUES_NAV.map((r) => r.icone)).size).toBe(RUBRIQUES_NAV.length);
    expect(new Set(entrees.map((e) => e.icone)).size).toBe(entrees.length);
    for (const e of entrees) {
      expect(e.libelle.length).toBeLessThanOrEqual(22);
      expect(e.libelle).not.toMatch(/zernio|buffer|heygen|remotion|api|lut/i);
    }
  });
});

describe("mobile : même organisation que l'ordinateur", () => {
  it("la feuille « Plus » contient exactement le menu moins les onglets du bas (même contenu, rubriques regroupées)", () => {
    for (const [surLeSite, aPublier] of [[false, false], [true, true]] as const) {
      const dansOnglets = new Set(ONGLETS_BAS.map((o) => o.href));
      const attendu = toutes(surLeSite, aPublier).filter((e) => !dansOnglets.has(e.href)).map((e) => e.href);
      const obtenu = sectionsPlusMobile(surLeSite, aPublier).flatMap((s) => s.entrees.map((e) => e.href));
      expect([...obtenu].sort()).toEqual([...attendu].sort());
      expect(obtenu.at(-1)).toBe("/reglages");
    }
  });

  it("aucune section de la feuille « Plus » n'est vide ; seule la tête (liens simples) n'a pas de titre", () => {
    const sections = sectionsPlusMobile(true, true);
    for (const s of sections) expect(s.entrees.length).toBeGreaterThan(0);
    expect(sections.filter((s) => !s.titre)).toHaveLength(1);
    expect(sections[0].entrees.map((e) => e.href)).toEqual(["/calendrier", "/mesures"]);
  });
});

describe("rendu de la barre latérale", () => {
  const html = renderToStaticMarkup(createElement(BarreLaterale, { formats: [], actionDeconnexion: async () => undefined, surLeSite: true, aPublier: true }));

  it("les trois rubriques pliables portent aria-expanded et sont reliées à leur liste", () => {
    expect(html.match(/aria-expanded="(true|false)" aria-controls="/g)?.length).toBe(3 + 1); // 3 rubriques + le bouton de repli
    for (const m of html.matchAll(/aria-controls="([^"]+)"/g)) expect(html).toContain(`id="${m[1]}"`);
  });

  it("un seul repère de navigation, et l'entrée de la page en cours porte aria-current", () => {
    expect(html.match(/<nav/g)?.length).toBe(1);
    expect(html).not.toContain("<aside");
    const lien = html.match(/<a[^>]*href="\/reglages"[^>]*>/)?.[0] ?? "";
    expect(lien).toContain('aria-current="page"');
    expect(html.match(/aria-current="page"/g)?.length).toBe(1);
  });

  it("le pied (réglages) est hors de la zone qui défile", () => {
    const zoneDefilante = html.slice(html.indexOf("overflow-y-auto"), html.indexOf("shrink-0 border-t"));
    expect(zoneDefilante).not.toContain('href="/reglages"');
    expect(zoneDefilante).not.toContain('href="/veille"');
    expect(html).toContain('href="/reglages"');
  });
});

describe("« Vidéos » couvre toutes les adresses de création", () => {
  it("chaque adresseCreation du registre allume Vidéos (barre et onglets)", async () => {
    const { listerFormats } = await import("@/formats");
    const { estActif } = await import("@/components/coquille/navigation");
    const videos = RUBRIQUES_NAV.flatMap(entreesDeRubrique).find((e) => e.href === "/videos")!;
    const onglet = ONGLETS_BAS.find((o) => o.href === "/videos")!;
    for (const f of listerFormats({ inclureMasques: true, inclureReservesAWill: true })) {
      if (!f.adresseCreation) continue;
      expect(estActif(f.adresseCreation, videos), f.id).toBe(true);
      expect(estActif(f.adresseCreation, onglet), f.id).toBe(true);
    }
  });
});
