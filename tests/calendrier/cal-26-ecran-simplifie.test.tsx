/** CAL-26 : écran du calendrier simplifié. Services doublés, aucun appel réel. */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const listerCalendrier = vi.fn(async (...args: string[]) => (void args, [] as unknown[]));
const listerAProgrammer = vi.fn(async () => [] as unknown[]);
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: (d: string, f: string) => listerCalendrier(d, f), listerAProgrammer: () => listerAProgrammer() }));

const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
const { EnTeteCalendrier } = await import("@/components/calendrier/EnTeteCalendrier");
const { PanneauAFaire, repartirAFaire } = await import("@/components/calendrier/PanneauAFaire");
const { ReserveAPlacer } = await import("@/components/calendrier/ReserveAPlacer");
const rendre = async (params: Record<string, string> = {}) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
beforeEach(() => {
  listerCalendrier.mockReset().mockResolvedValue([]);
  listerAProgrammer.mockReset().mockResolvedValue([]);
});

const liens = { precedent: "/p", suivant: "/s", aujourdhui: "/a", semaine: "/se", mois: "/m" };

describe("CAL-26 : en-tête à six commandes", () => {
  it("contient la période et ses flèches, Aujourd'hui, Semaine/Mois, Filtrer, + Ajouter et les pastilles des réseaux", () => {
    const h = renderToStaticMarkup(<EnTeteCalendrier vue="semaine" periode="Cette semaine" liens={liens} reseauxActifs={["linkedin", "instagram", "facebook", "tiktok"]} lienReseau={() => "/x"} lienTout="/t" lienAjouter="/calendrier?vue=jour" />);
    expect(h).toContain("Cette semaine");
    for (const l of ["Période précédente", "Période suivante", "Revenir à aujourd&#x27;hui", "Afficher la semaine", "Afficher le mois"]) expect(h).toContain(l);
    expect(h).toContain("Filtrer");
    expect(h).toContain("+ Ajouter");
    expect(h.match(/<a [^>]*data-reseau="/g)).toHaveLength(4);
    expect(h).not.toContain("Idées de l");
  });
});

describe("CAL-26 : panneau « À faire »", () => {
  const entrees = [
    { cle: "publication:1|linkedin", etat: "a_corriger", titre: "Un", href: "/videos/1" },
    { cle: "publication:2|instagram", etat: "a_valider", titre: "Deux", href: "/videos/2" },
    { cle: "publication:3|facebook", etat: "brouillon", titre: "Trois", href: "/videos/3" },
    { cle: "publication:4|tiktok", etat: "programme", titre: "Quatre", href: "/videos/4" },
  ];
  it("répartit À corriger, À valider, Brouillons à compléter et ignore le reste", () => {
    const r = repartirAFaire(entrees);
    expect(r.aCorriger.map((e) => e.titre)).toEqual(["Un"]);
    expect(r.aValider.map((e) => e.titre)).toEqual(["Deux"]);
    expect(r.brouillons.map((e) => e.titre)).toEqual(["Trois"]);
  });
  it("chaque ligne ouvre la bonne publication", () => {
    const h = renderToStaticMarkup(<PanneauAFaire entrees={entrees} />);
    expect(h).toContain("À faire");
    expect(h).toContain("À corriger");
    expect(h).toContain("À valider");
    expect(h).toContain("Brouillons à compléter");
    expect(h).toContain('href="/videos/2"');
    expect(h).not.toContain("Quatre");
  });
  it("rien à faire : une phrase calme", () => {
    expect(renderToStaticMarkup(<PanneauAFaire entrees={[]} />)).toContain("Rien à faire");
  });
});

describe("CAL-26 : réserve « À placer »", () => {
  it("montre les contenus prêts sans date, chacun menant à sa fiche", () => {
    const h = renderToStaticMarkup(<ReserveAPlacer contenus={[{ id: "v1", titre: "Ma vidéo", vignette: null }]} />);
    expect(h).toContain("À placer");
    expect(h).toContain("Ma vidéo");
    expect(h).toContain('href="/videos/v1"');
  });
  it("vide : rien n'est affiché", () => {
    expect(renderToStaticMarkup(<ReserveAPlacer contenus={[]} />)).toBe("");
  });
});

describe("CAL-26 : la page", () => {
  it("dit « Réponses aux commentaires : à la main » et ne montre pas « Idées de l'IA »", async () => {
    const h = await rendre();
    expect(h).toContain("Réponses aux commentaires : à la main");
    expect(h).not.toMatch(/Idées de l.IA/);
  });
  it("alimente le panneau « À faire » et la réserve « À placer »", async () => {
    const auj = new Date().toISOString();
    listerCalendrier.mockResolvedValue([{ jour: auj.slice(0, 10), publications: [{ id: "p1", videoId: "v1", via: "buffer", reseau: "linkedin", statut: "a_valider", date: auj, texte: "t", video: { titre: "Vidéo A", vignette: null, video: null } }] }]);
    listerAProgrammer.mockResolvedValue([{ id: "v9", titre: "Prête" }]);
    const h = await rendre({ date: auj.slice(0, 10) });
    expect(h).toContain("À faire");
    expect(h).toContain("Vidéo A");
    expect(h).toContain("À placer");
  });
});

describe("CAL-26 : bandeau « Annuler » importé, jamais recréé", () => {
  it("les nouveaux fichiers importent BandeauAnnuler de @/components/ui et n'en définissent pas", () => {
    const src = ["PanneauAFaire", "ReserveAPlacer", "EnTeteCalendrier"].map((f) => readFileSync(join(process.cwd(), "src/components/calendrier", `${f}.tsx`), "utf8")).join("\n");
    expect(src).toMatch(/import \{[^}]*BandeauAnnuler[^}]*\} from "@\/components\/ui\/BandeauAnnuler"|from "@\/components\/ui"/);
    expect(src).not.toMatch(/function BandeauAnnuler|const BandeauAnnuler/);
  });
});

describe("CAL-26 : bandeau de départ", () => {
  it("3 lignes, un bouton pour le fermer, mémoire sans plantage", async () => {
    const { BandeauDepart } = await import("@/components/calendrier/PanneauAFaire");
    const h = renderToStaticMarkup(<BandeauDepart />);
    expect(h.match(/<li>/g)).toHaveLength(3);
    expect(h).toContain("Compris");
    expect(h).toContain("Réponses aux commentaires : à la main");
  });
});
