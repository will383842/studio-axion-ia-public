/** L4-05 : page /calendrier, vues semaine et mois. Services doublés, aucun réseau. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const listerCalendrier = vi.fn(async (_d: string, _f: string) => [] as unknown[]);
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: (d: string, f: string) => listerCalendrier(d, f), listerAProgrammer: async () => [] }));

const { default: Page } = await import("../src/app/(studio)/calendrier/page");

async function rendre(params: Record<string, string>): Promise<string> {
  const el = await Page({ searchParams: Promise.resolve(params) });
  return renderToStaticMarkup(el);
}
beforeEach(() => listerCalendrier.mockClear());

describe("page /calendrier", () => {
  it("?vue=mois&date=2026-12 affiche décembre 2026 (42 jours, bornes du mois)", async () => {
    const h = await rendre({ vue: "mois", date: "2026-12" });
    expect(h).toMatch(/décembre 2026/i);
    expect(h).toContain("/calendrier?vue=mois&amp;date=2026-11");
    expect(h).toContain("/calendrier?vue=mois&amp;date=2027-01");
    const [debut, fin] = listerCalendrier.mock.calls[0];
    expect(debut.slice(0, 10)).toBe("2026-11-29"); // lundi 30/11 minuit Paris = 29/11 23:00 UTC
    expect(fin.slice(0, 10)).toBe("2027-01-10");
  });
  it("?semaine=N fonctionne toujours (vue semaine par défaut)", async () => {
    const h = await rendre({ semaine: "1" });
    expect(h).toContain("Semaine prochaine");
    expect(h).toContain("/calendrier?semaine=2");
    expect(h).toContain("/calendrier?semaine=0");
  });
  it("?vue=semaine&date=2026-12-09 affiche la semaine du 7 au 13 décembre", async () => {
    await rendre({ vue: "semaine", date: "2026-12-09" });
    expect(listerCalendrier.mock.calls[0][0].slice(0, 10)).toBe("2026-12-06");
  });
  it("valeurs invalides : retombe sur la semaine courante sans planter", async () => {
    expect(await rendre({ vue: "x", date: "n'importe quoi" })).toContain("Cette semaine");
  });
  it("propose le choix Semaine / Mois", async () => {
    const h = await rendre({});
    expect(h).toContain("vue=mois");
    expect(h).toContain(">Semaine<");
    expect(h).toContain(">Mois<");
  });

  it("vue mois : un jour avec un seul essai n'est pas compté comme publication (case et en-tête)", async () => {
    listerCalendrier.mockResolvedValueOnce([{ jour: "2026-12-10", publications: [{ videoId: "v1", via: "simulation" }] }]);
    const h = await rendre({ vue: "mois", date: "2026-12" });
    expect(h).toContain("0 publication");
    expect(h).toContain("1 essai");
    expect(h).not.toMatch(/>1 (<!-- -->)?<span class="sr-only">/);
  });
  it("vue mois : une vraie publication et un essai le même jour → « 1 » et « 1 essai »", async () => {
    listerCalendrier.mockResolvedValueOnce([{ jour: "2026-12-10", publications: [{ videoId: "v1", via: "buffer", reseau: "linkedin" }, { videoId: "v2", via: "simulation", reseau: "linkedin" }] }]);
    const h = await rendre({ vue: "mois", date: "2026-12" });
    expect(h).toContain("1 publication");
    expect(h).toMatch(/data-jour="2026-12-10"[^>]*aria-label="[^"]*1 publication : LinkedIn 1"/); // CAL-05 : la grille du mois donne le repère par réseau
    expect(h).toContain("1 essai");
  });
  it("?date= très lointaine : « Semaine précédente » reste sur la semaine voisine (pas de saut)", async () => {
    const h = await rendre({ vue: "semaine", date: "2040-06-06" });
    expect(h).toContain("date=2040-05-28"); // lundi 4 juin 2040 − 7 jours
    expect(h).toContain("date=2040-06-11");
    expect(h).not.toContain("semaine=5");
  });
  describe("lundi entre 0 h et 2 h à Paris (le serveur est encore dimanche en UTC)", () => {
    afterEach(() => vi.useRealTimers());
    it("?semaine=0 affiche la semaine qui commence ce lundi (Paris)", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-12-06T23:30:00Z")); // lundi 7/12 00:30 à Paris
      await rendre({});
      expect(listerCalendrier.mock.calls[0][0].slice(0, 10)).toBe("2026-12-06");
    });
    it("?date=2026-12-07 affiche la semaine du 7 au 13 même à cette heure", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-12-06T23:30:00Z"));
      await rendre({ date: "2026-12-07" });
      expect(listerCalendrier.mock.calls[0][0].slice(0, 10)).toBe("2026-12-06");
      expect(listerCalendrier.mock.calls[0][1].slice(0, 10)).toBe("2026-12-13");
    });
  });
});
