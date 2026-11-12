/** L4-05 : page /calendrier, vues semaine et mois. Services doublés, aucun réseau. */
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
