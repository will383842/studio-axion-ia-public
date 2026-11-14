/**
 * CAL-13d : « Filtrer » (types, états, mot cherché) lit l'adresse et filtre grille, mois, Agenda, vue Jour et compteur
 * (le panneau « À faire » garde tout) ; « Prêt à partir ? » apparaît dans le tiroir, sans rien inventer.
 * Tests de rendu de la page, sans DOM (crochets factices).
 */
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({ ...(await o<typeof import("react")>()), ...(await import("../aides/crochets-factices")).crochets }));
vi.mock("@/app/(studio)/calendrier/actions/decaler", () => ({ decalerEntree: vi.fn(async () => ({ ok: false, message: "doublure" })) }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
const listerCalendrier = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/publications", () => ({ listerCalendrier: () => listerCalendrier(), listerAProgrammer: async () => [] }));

const { monter } = await import("../aides/crochets-factices");
const { cleJour } = await import("@/lib/dates");
const { adresseAvecFiltres } = await import("@/components/calendrier/FiltresCalendrier");
const { suiteFiltres } = await import("@/components/calendrier/Filtres");
const { PretAPartir } = await import("@/components/calendrier/PretAPartir");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");

const PUBS = [
  { id: "v1", reseau: "linkedin", videoId: "vid1", video: { titre: "Alpha lancement", vignette: null, video: null }, via: "buffer", etatEnvoi: "refuse" },
  { id: "i1", reseau: "facebook", video: null, texte: "Bêta visuel" },
  { id: "y1", reseau: "youtube", videoId: "vid2", video: { titre: "Gamma youtube", vignette: null, video: null } },
];

async function pageAvec(params: Record<string, string>, pubs: Record<string, unknown>[] = PUBS): Promise<string> {
  monter(() => null, {}).rendre();
  listerCalendrier.mockResolvedValueOnce([
    { jour: cleJour(new Date()), publications: pubs.map((p) => ({ statut: "programmee", via: "manuel", date: new Date().toISOString(), texte: "Un texte", reseauNom: "Réseau", ...p })) },
  ]);
  const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
  return renderToStaticMarkup((await Page({ searchParams: Promise.resolve(params) })) as ReactElement);
}
const grille = (h: string) => h.slice(h.lastIndexOf("hidden min-[861px]:block"));
/** Les cartes de la grille ordinateur, par publication (data-carte). */
const cartes = (h: string) => [...grille(h).matchAll(/data-carte="publication:([^|"]+)\|/g)].map((m) => m[1]);
const compte = (h: string) => /· (\d+) publication/.exec(h)?.[1];

describe("CAL-13d — Filtrer lit l'adresse", () => {
  beforeEach(() => listerCalendrier.mockReset());

  it("sans filtre : tout est visible, YouTube compris, et « Filtrer » est là une seule fois", async () => {
    const h = await pageAvec({});
    expect(compte(h)).toBe("3");
    expect(cartes(h).sort()).toEqual(["i1", "v1", "y1"]);
    expect(h.match(/>Filtrer</g)).toHaveLength(1);
    expect(h).toContain('data-ft="video"');
    expect(h).toContain('data-fe="a_corriger"');
  });

  it("?types=video : l'image disparaît de la grille, de l'Agenda et du compteur", async () => {
    const h = await pageAvec({ types: "video" });
    expect(compte(h)).toBe("2");
    expect(cartes(h).sort()).toEqual(["v1", "y1"]);
    expect(h).toMatch(/data-ft="video"[^>]*checked/);
  });

  it("?etats=a_corriger : seul l'envoi refusé reste", async () => {
    const h = await pageAvec({ etats: "a_corriger" });
    expect(compte(h)).toBe("1");
    expect(cartes(h)).toEqual(["v1"]);
  });

  it("?q=gamma : le mot cherché ignore la casse", async () => {
    const h = await pageAvec({ q: "GAMMA" });
    expect(compte(h)).toBe("1");
    expect(cartes(h)).toEqual(["y1"]);
  });

  it("valeurs inconnues ignorées : rien n'est masqué", async () => {
    const h = await pageAvec({ types: "nimporte,quoi", etats: "zzz" });
    expect(compte(h)).toBe("3");
  });

  it("un filtre qui masque tout montre « filtre-vide »", async () => {
    const h = await pageAvec({ q: "introuvable" });
    expect(compte(h)).toBe("0");
    expect(h).toContain('data-etat="filtre-vide"');
    expect(h).toContain("Aucune publication ne correspond à ce filtre.");
    // Sans filtre, ce texte est absent.
    expect(await pageAvec({})).not.toContain("Aucune publication ne correspond à ce filtre.");
  });

  it("le panneau « À faire » garde tout, même filtré", async () => {
    const h = await pageAvec({ q: "introuvable" }, [{ id: "b1", reseau: "linkedin", statut: "brouillon", texte: "Brouillon à finir" }]);
    expect(h).toContain("Brouillon à finir");
  });

  it("les liens de la barre gardent les filtres et les réseaux", async () => {
    const h = await pageAvec({ types: "video", q: "alpha", reseaux: "linkedin,facebook" });
    expect(h).toMatch(/href="\/calendrier\?vue=mois&amp;reseaux=linkedin,facebook&amp;types=video&amp;q=alpha"/);
    expect(h).toContain("types=video");
  });

  it("vue mois : le compteur suit le filtre", async () => {
    const h = await pageAvec({ vue: "mois", types: "image" });
    expect(h).toMatch(/>1 publication</);
    const tout = await pageAvec({ vue: "mois" });
    expect(tout).toMatch(/>3 publications</);
  });

  it("vue jour : les entrées filtrées disparaissent", async () => {
    const h = await pageAvec({ vue: "jour", q: "bêta" });
    expect(h).toContain("Bêta visuel");
    expect(h).not.toContain("Alpha lancement");
  });
});

describe("CAL-13d — le pont d'adresse", () => {
  it("ajoute types, états et mot à l'adresse de la vue, sans toucher à la vue, la date, ni aux réseaux", () => {
    const c = { types: ["video" as const], etats: ["a_corriger"], motCle: "mot é" };
    expect(adresseAvecFiltres("/calendrier?vue=mois&date=2026-11&reseaux=linkedin", c)).toBe("/calendrier?vue=mois&date=2026-11&reseaux=linkedin&types=video&etats=a_corriger&q=mot%20%C3%A9");
    expect(adresseAvecFiltres("/calendrier", c)).toBe("/calendrier?types=video&etats=a_corriger&q=mot%20%C3%A9");
    expect(adresseAvecFiltres("/calendrier?vue=jour&date=2026-11-11", { types: [], etats: [], motCle: "" })).toBe("/calendrier?vue=jour&date=2026-11-11");
    expect(suiteFiltres({ types: [], etats: [] })).toBe("");
  });
});

describe("CAL-13d — Prêt à partir ? dans le tiroir", () => {
  const entree = { cle: "publication:p1|linkedin", jour: "2026-12-20", reseau: "linkedin" as const, type: "video" as const, etat: "programme", heure: "09:00", texte: "Un texte #astuce" };
  const tiroir = (e: Record<string, unknown>) => renderToStaticMarkup(ApercuPublication({ entree: { ...entree, ...e } as never, aujourdhui: "2026-11-11", onPrecedente: () => {}, onSuivante: () => {}, onFermer: () => {}, onChangerDate: () => {} }) as ReactElement);

  it("est affiché, et dit « à vérifier à la main » pour fichier et premier commentaire au lieu de l'inventer", () => {
    monter(() => null, {}).rendre();
    const h = tiroir({});
    expect(h).toContain("Prêt à partir ?");
    expect(h).toContain("Le fichier (vidéo, image ou PDF) est à vérifier à la main.");
    expect(h).toContain("Le premier commentaire est à vérifier à la main.");
    expect(h).not.toContain("Il manque le fichier");
    expect(h).not.toContain("Il manque le premier commentaire");
    expect(h).not.toContain("Il manque le texte");
    expect(h).not.toContain("Il manque les hashtags");
    expect(h).not.toContain("Tout est prêt");
  });
  it("dit ce qui manque vraiment : texte vide, hashtags absents", () => {
    monter(() => null, {}).rendre();
    const h = tiroir({ texte: "" });
    expect(h).toContain("Il manque le texte");
    expect(tiroir({ texte: "Sans dièse" })).toContain("Il manque les hashtags pour LinkedIn.");
  });
  it("un premier commentaire connu n'est plus « à vérifier »", () => {
    monter(() => null, {}).rendre();
    expect(tiroir({ premierCommentaire: "Voir le lien" })).not.toContain("Le premier commentaire est à vérifier à la main.");
  });
  it("le composant seul : sans averifier il garde ses phrases d'origine", () => {
    const h = renderToStaticMarkup(<PretAPartir publications={[{ reseau: "linkedin", texte: "t #a" }]} />);
    expect(h).toContain("Il manque le premier commentaire pour LinkedIn.");
    expect(h).toContain("Il manque le fichier");
  });
});
