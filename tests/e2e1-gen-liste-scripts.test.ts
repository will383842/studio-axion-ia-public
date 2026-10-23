/**
 * Vérification E2E n° 1 de la console, point n° 7 : sur Écrire › Scripts, « Aucun sujet — Une idée suffit pour
 * commencer » s'affichait en grand alors que 9 scripts dormaient repliés dans « Sans sujet · 9 », et deux boutons
 * « Nouveau sujet » se superposaient. Les scripts existants sont visibles d'emblée ; l'état vide n'apparaît que s'il n'y
 * a vraiment rien ; le seul « Nouveau sujet » est celui de la barre du bas (page).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined, push: () => undefined, refresh: () => undefined }),
  usePathname: () => "/ecrire",
  useSearchParams: () => new URLSearchParams(),
  redirect: () => undefined,
  notFound: () => undefined,
}));

const { ListeSujets } = await import("@/components/generateur/ListeSujets");

const base = { sujets: [], formats: [], nombres: {}, codes: {}, piliers: [], series: [] };
const NEUF = Array.from({ length: 9 }, (_, i) => ({ id: `scr-${i}`, titre: `Script ancien ${i + 1}` }));

describe("E2E-1 console n° 7 · Écrire › Scripts", () => {
  it("9 scripts sans sujet : visibles d'emblée (non repliés), sans état vide ni second « Nouveau sujet »", () => {
    const html = renderToStaticMarkup(createElement(ListeSujets, { ...base, sansSujet: NEUF } as never));
    expect(html).not.toContain("Aucun sujet");
    expect(html).not.toContain("Une idée suffit pour commencer");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Nouveau sujet");
    for (const t of NEUF) expect(html).toContain(t.titre);
    expect(html).toContain("Scripts sans sujet · 9");
  });

  it("vraiment rien : l'état vide s'affiche, toujours sans second « Nouveau sujet »", () => {
    const html = renderToStaticMarkup(createElement(ListeSujets, { ...base, sansSujet: [] } as never));
    expect(html).toContain("Aucun sujet");
    expect(html).not.toContain("Nouveau sujet");
  });
});
