/** Page « Déjà faits » : liste, vide, vidéo supprimée, bouton ; lien avec compteur sur la page principale ; sans session, redirection. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined }),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ remettreEnStockAction: vi.fn() }));
const lireSession = vi.fn();
vi.mock("@/services/auth", () => ({ lireSession: () => lireSession() }));
const lireCasTraites = vi.fn();
vi.mock("@/services/cas-concret-traites", () => ({ lireCasTraites: () => lireCasTraites() }));

const reglages = { catalogueEtendu: false, stockMetiers: false };
vi.mock("@/services/cas-concret-reglages", () => ({
  REGLAGES_CAS_CONCRET: { catalogueEtendu: "catalogueEtendu", stockMetiers: "stockMetiers" },
  reglageAllume: async (k: "catalogueEtendu" | "stockMetiers") => reglages[k],
}));

import PageDejaFaits from "@/app/(studio)/cas-concret/deja-faits/page";
import { listerDejaFaits } from "@/components/formats/cas-concret/stock/deja-faits";
import { ListeDejaFaits } from "@/components/formats/cas-concret/stock/ListeDejaFaits";
import { StockDesCas } from "@/components/formats/cas-concret/stock/StockDesCas";
import { CATALOGUE, casVisibles } from "@/formats/cas-concret/catalogue";
import { CAS_STOCK, RANGEMENT } from "@/formats/cas-concret/stock-metiers";
import { construireStockCas } from "@/services/cas-concret-stock";

const esc = (s: string) => s.replace(/'/g, "&#x27;");
const [a, b] = CATALOGUE;
const traites = () =>
  new Map([
    [a!.id, { videoId: "v-fini", titre: "Fini", le: "2026-10-09T08:00:00.000Z" }],
    [b!.id, { titre: "Supprimée", le: "2026-10-12T08:00:00.000Z" }],
  ]);
const rendre = (m = traites()) => renderToStaticMarkup(createElement(ListeDejaFaits, { cas: listerDejaFaits(m) }));

describe("page « Déjà faits »", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reglages.catalogueEtendu = false;
    reglages.stockMetiers = false;
  });

  it("liste chaque cas : titre, date, lien « Voir la vidéo » avec aria-label, « Vidéo supprimée », bouton, plus récent d'abord", () => {
    const html = rendre();
    expect(html).toContain(esc(a!.titre));
    expect(html).toContain("Vidéo du 09/10/2026");
    expect(html).toContain('href="/videos/v-fini"');
    expect(html).toContain(`aria-label="Voir la vidéo : ${esc(a!.titre)}`);
    expect(html).toContain("Vidéo supprimée");
    expect(html.match(/Remettre en stock/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("2 cas faits");
    expect(html).toContain("min-h-11");
    expect(html.indexOf(esc(b!.titre))).toBeLessThan(html.indexOf(esc(a!.titre)));
    expect(html).not.toMatch(/Villeexemple|Aucun gain garanti/);
  });

  it("vide : « Aucun cas fait pour l'instant. » et aucun bouton", () => {
    const html = rendre(new Map());
    expect(html).toContain("Aucun cas fait pour l&#x27;instant.");
    expect(html).not.toContain("Remettre en stock");
  });

  it("la page rend la liste quand la session existe", async () => {
    lireSession.mockResolvedValue({ id: "s" });
    lireCasTraites.mockResolvedValue(traites());
    const html = renderToStaticMarkup(await PageDejaFaits());
    expect(html).toContain("Cas déjà faits");
    expect(html).toContain('href="/cas-concret"');
    expect(html).toContain(esc(a!.titre));
  });

  it("sans session : redirection vers /connexion, rien n'est lu", async () => {
    lireSession.mockResolvedValue(null);
    await expect(PageDejaFaits()).rejects.toThrow("REDIRECT:/connexion");
    expect(lireCasTraites).not.toHaveBeenCalled();
  });

  it("page principale : lien « N cas déjà faits » hors du bloc replié, sans liste détaillée dans le stock", () => {
    const lignes = construireStockCas({ scripts: {}, videos: [], traites: traites() });
    const html = renderToStaticMarkup(createElement(StockDesCas, { lignes, idees: [] }));
    const lien = html.indexOf('href="/cas-concret/deja-faits"');
    expect(lien).toBeGreaterThan(-1);
    expect(lien).toBeLessThan(html.indexOf("<details"));
    expect(html).toContain("2 cas déjà faits");
    expect(html).not.toContain("?stock=1#deja-traites");
    expect(html).not.toContain("Remettre en stock");
    expect(html).not.toContain("Vidéo supprimée");
    const un = renderToStaticMarkup(createElement(StockDesCas, { lignes: construireStockCas({ scripts: {}, videos: [], traites: new Map([[a!.id, { titre: "x", le: "2026-10-09T08:00:00.000Z" }]]) }), idees: [] }));
    expect(un).toContain("1 cas déjà fait<");
    const aucun = renderToStaticMarkup(createElement(StockDesCas, { lignes: construireStockCas({ scripts: {}, videos: [] }), idees: [] }));
    expect(aucun).not.toContain("deja-faits");
  });

  it("compteur et liste donnent le même nombre : cas du stock traité, stockMetiers éteint puis allumé", async () => {
    const stock = CAS_STOCK[0]!;
    const t = new Map([[stock.id, { videoId: "v-s", titre: "Stock", le: "2026-10-10T08:00:00.000Z" }]]);
    const lignes = construireStockCas({ scripts: {}, videos: [], traites: t, catalogue: casVisibles(CATALOGUE.map((cas) => ({ cas })), { catalogueEtendu: false, stockMetiers: false }).map((x) => x.cas) });
    expect(lignes.filter((l) => l.traite).length).toBe(0);
    expect(renderToStaticMarkup(createElement(StockDesCas, { lignes, idees: [] }))).not.toContain("deja-faits");
    expect(listerDejaFaits(t, { catalogueEtendu: false, stockMetiers: false })).toHaveLength(0);
    lireSession.mockResolvedValue({ id: "s" });
    lireCasTraites.mockResolvedValue(t);
    const vide = renderToStaticMarkup(await PageDejaFaits());
    expect(vide).toContain("Aucun cas fait pour l&#x27;instant.");
    reglages.stockMetiers = true;
    const lignes2 = construireStockCas({ scripts: {}, videos: [], traites: t, catalogue: casVisibles(CATALOGUE.map((cas) => ({ cas })), { catalogueEtendu: false, stockMetiers: true }).map((x) => x.cas) });
    const n = lignes2.filter((l) => l.traite).length;
    expect(n).toBe(1);
    expect(listerDejaFaits(t, { catalogueEtendu: false, stockMetiers: true })).toHaveLength(n);
    expect(renderToStaticMarkup(createElement(StockDesCas, { lignes: lignes2, idees: [] }))).toContain("1 cas déjà fait<");
    expect(renderToStaticMarkup(await PageDejaFaits())).toContain("1 cas fait");
  });

  it("cas absent du catalogue : listé sans bouton, avec la mention ; titre vide remplacé", () => {
    const html = rendre(new Map([["cas-inconnu", { titre: "", le: "2026-10-09T08:00:00.000Z" }]]));
    expect(html).toContain("cas-inconnu");
    expect(html).toContain("Ce cas n&#x27;existe plus dans le catalogue.");
    expect(html).not.toContain("Remettre en stock");
    expect(listerDejaFaits(new Map([["cas-inconnu", { titre: "Ancien", le: "2026-10-09T08:00:00.000Z" }]]))[0]!.titre).toBe("Ancien");
  });

  it("cas du stock : ligne « Secteur · Taille · Offre »", () => {
    const stock = CAS_STOCK.find((c) => RANGEMENT[c.id])!;
    const [ligne] = listerDejaFaits(new Map([[stock.id, { videoId: "v", titre: "x", le: "2026-10-09T08:00:00.000Z" }]]), { catalogueEtendu: false, stockMetiers: true });
    expect(ligne!.details.split(" · ")).toHaveLength(3);
    expect(ligne!.details).toContain(RANGEMENT[stock.id]!.taille);
    expect(renderToStaticMarkup(createElement(ListeDejaFaits, { cas: [ligne!] }))).toContain(ligne!.details);
  });
});
