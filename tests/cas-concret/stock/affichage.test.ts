/** Affichage du stock des cas : phrase de synthèse, pastilles, prix seulement s'il existe, idées vides. Rendu serveur, rien d'autre. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { jourMois, StockDesCas } from "@/components/formats/cas-concret/stock/StockDesCas";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { construireStockCas } from "@/services/cas-concret-stock";
import type { Video } from "@/domaine/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("@/app/(studio)/cas-concret/actions", () => ({ remettreEnStockAction: vi.fn() }));

const rendu = (montants?: Record<string, number>, videos: Video[] = []) =>
  renderToStaticMarkup(createElement(StockDesCas, { lignes: construireStockCas({ scripts: {}, videos, montants }), idees: [] }));

describe("StockDesCas", () => {
  it("montre la synthèse, une carte par cas et les pastilles de statut", () => {
    const html = rendu();
    expect(html).toContain(`${CATALOGUE_TS.length} cas · `);
    expect(html).toContain("Script validé");
    expect(html).toContain("Script à valider");
    expect(html.match(/<li /g)?.length).toBe(CATALOGUE_TS.length);
    expect(html).toContain("0 vidéo faite");
  });

  it("n'affiche aucun prix quand il n'existe pas, et « au plus » quand il existe", () => {
    expect(rendu()).not.toContain("au plus");
    expect(rendu({ [CATALOGUE[0]!.id]: 61 })).toContain("au plus");
  });

  it("montre la date de la dernière vidéo en jj/mm et ne met aucun lien vers « Mes vidéos »", () => {
    const v = { id: "a", formatId: "cas-concret", statut: "prete", modifieLe: "2026-10-09T08:00:00.000Z", creeLe: "2026-10-01T00:00:00.000Z", entrees: { casConcret: { casId: CATALOGUE[0]!.id } } } as unknown as Video;
    const html = rendu(undefined, [v]);
    expect(html).toContain("Dernière le 09/10");
    expect(html).not.toContain("<a ");
  });

  it("« Idées à venir (0) » avec une phrase vide propre", () => {
    const html = rendu();
    expect(html).toContain("Idées à venir (0)");
    expect(html).toContain("Aucune idée pour le moment.");
  });

  it("jourMois : vide si la date est illisible", () => {
    expect(jourMois(undefined)).toBe("");
    expect(jourMois("n'importe quoi")).toBe("");
  });

  it("n'écrit ni « Villeexemple » ni « Aucun gain garanti »", () => {
    expect(rendu()).not.toMatch(/Villeexemple|Aucun gain garanti/);
  });

  it("« Déjà traités » : la liste détaillée est sur la page « Déjà faits » ; ici seulement le compteur du bandeau et le lien", () => {
    const [a, b] = CATALOGUE;
    const lignes = construireStockCas({
      scripts: {},
      videos: [],
      traites: new Map([
        [a!.id, { videoId: "v-fini", titre: "Fini", le: "2026-10-09T08:00:00.000Z" }],
        [b!.id, { titre: "Supprimée", le: "2026-10-08T08:00:00.000Z" }],
      ]),
    });
    const html = renderToStaticMarkup(createElement(StockDesCas, { lignes, idees: [] }));
    expect(html).toContain("2 cas déjà faits");
    expect(html).toContain('href="/cas-concret/deja-faits"');
    expect(html).not.toContain("Remettre en stock");
    expect(html).not.toContain('href="/videos/v-fini"');
    expect(renderToStaticMarkup(createElement(StockDesCas, { lignes, idees: [], ouvert: true }))).toMatch(/<details[^>]* open/);
    expect(rendu()).not.toContain("deja-faits");
  });
});
