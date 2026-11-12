/** L4-15 : liens de l'écran /calendrier (Semaine, Mois). Services doublés, aucun réseau. */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));
vi.mock("@/services/publications", () => ({ listerCalendrier: async () => [], listerAProgrammer: async () => [] }));

const { default: Page } = await import("../../src/app/(studio)/calendrier/page");

async function rendre(params: Record<string, string>): Promise<string> {
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(params) }));
}
function liens(html: string): string[] {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map((m) => `${m[1]}|${m[2].replace(/<[^>]*>/g, "")}`);
}

describe("liens de /calendrier", () => {
  for (const [nom, params] of [["semaine", {}], ["mois", { vue: "mois", date: "2026-12" }], ["semaine datée", { vue: "semaine", date: "2026-12-09" }]] as const) {
    it(`vue ${nom} : Semaine et Mois sont accessibles`, async () => {
      const l = liens(await rendre({ ...params }));
      expect(l.some((x) => x.startsWith("/calendrier|") && x.endsWith("|Semaine"))).toBe(true);
      expect(l.some((x) => x.startsWith("/calendrier?vue=mois") && x.endsWith("|Mois"))).toBe(true);
    });
    it(`vue ${nom} : ni Importer, ni À reprogrammer, ni Rythme sur l'écran principal`, async () => {
      const l = liens(await rendre({ ...params }));
      expect(l.filter((x) => /importer|reprogrammer|rythme/i.test(x))).toEqual([]);
    });
    it(`vue ${nom} : « Proposer la semaine » reste masqué en V1`, async () => {
      expect(await rendre({ ...params })).not.toMatch(/Proposer la semaine/i);
    });
  }
});
