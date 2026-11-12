/**
 * CAL-05 (correctif) : la vue Mois de la PAGE utilise GrilleMois et adresseVueJour. Services doublés, aucun réseau.
 * Un jour vide est cliquable vers la vue Jour ; chaque réseau a son repère (picto, nom, nombre).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listerCalendrier = vi.fn(async (_d: string, _f: string) => [] as unknown[]);
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: (d: string, f: string) => listerCalendrier(d, f), listerAProgrammer: async () => [] }));

const { default: Page } = await import("../../src/app/(studio)/calendrier/page");
const rendre = async (params: Record<string, string>) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
beforeEach(() => listerCalendrier.mockReset().mockResolvedValue([]));

describe("CAL-05 : vue Mois de la page", () => {
  it("rend la grille du mois : 42 cases, chacune un lien vers la vue Jour, y compris un jour vide et un jour d'un mois voisin", async () => {
    const h = await rendre({ vue: "mois", date: "2026-12" });
    expect(h.match(/data-jour="/g)).toHaveLength(42);
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-12-15"'); // jour vide
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2026-11-30"'); // mois précédent
    expect(h).toContain('href="/calendrier?vue=jour&amp;date=2027-01-10"'); // mois suivant
    expect(h).not.toMatch(/vue=semaine&amp;date=2026-12-15/);
  });

  it("garde les filtres de réseaux dans le lien du jour", async () => {
    const h = await rendre({ vue: "mois", date: "2026-12", reseaux: "linkedin,tiktok" });
    expect(h).toMatch(/href="\/calendrier\?vue=jour&amp;date=2026-12-15&amp;reseaux=[^"]*linkedin/);
  });

  it("un repère par réseau, avec le picto et le nom : LinkedIn 2 et Instagram 1 le 10 décembre", async () => {
    listerCalendrier.mockResolvedValueOnce([
      { jour: "2026-12-10", publications: [
        { id: "p1", videoId: "v1", via: "buffer", reseau: "linkedin", statut: "programmee" },
        { id: "p2", videoId: "v1", via: "buffer", reseau: "linkedin", statut: "programmee" },
        { id: "p3", videoId: "v2", via: "buffer", reseau: "instagram", statut: "programmee" },
        { id: "p4", videoId: "v3", via: "simulation", reseau: "tiktok", statut: "programmee" },
      ] },
    ]);
    const h = await rendre({ vue: "mois", date: "2026-12" });
    const case10 = h.slice(h.indexOf('data-jour="2026-12-10"'), h.indexOf('data-jour="2026-12-11"'));
    expect(case10).toContain('data-reseau="linkedin"');
    expect(case10).toContain('data-reseau="instagram"');
    expect(case10).not.toContain('data-reseau="tiktok"'); // un essai n'est pas une publication
    expect(case10).toMatch(/LinkedIn 2/);
    expect(case10).toMatch(/Instagram 1/);
    expect(h).toContain("3 publications");
    expect(h).toContain("1 essai");
  });
});
