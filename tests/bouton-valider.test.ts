/** Lot S (08/11, Williams) — « Valider » : les 4 étapes et le cas « pas prête » (rendu statique, pas de jsdom dans le dépôt). */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockNavigation } from "./helpers/next-mocks";

const rafraichir = vi.fn();
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: rafraichir, push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => ({ changerEtapeEditorialeAction: vi.fn(async () => ({ ok: true, donnees: undefined })) }));

const { BoutonValider } = await import("@/components/videos/BoutonValider");
const html = (p: Parameters<typeof BoutonValider>[0]) => renderToStaticMarkup(createElement(BoutonValider, p));

describe("BoutonValider", () => {
  it("prête et à relire : le bouton « Valider », actif", () => {
    const h = html({ videoId: "v1", prete: true, etape: "a_relire" });
    expect(h).toContain("Valider");
    expect(h).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(h).not.toContain("Remettre à relire");
  });

  it("prête sans étape : le bouton « Valider »", () => {
    expect(html({ videoId: "v1", prete: true })).toContain("Valider");
  });

  it("validée : la pastille « Validée » et « Remettre à relire »", () => {
    const h = html({ videoId: "v1", prete: true, etape: "validee" });
    expect(h).toContain("Validée");
    expect(h).toContain("Remettre à relire");
    expect(h).not.toMatch(/>Valider</);
  });

  it.each([
    ["programmee", "Programmée"],
    ["publiee", "Publiée"],
  ] as const)("%s : la pastille seule, aucun bouton", (etape, libelle) => {
    const h = html({ videoId: "v1", prete: true, etape });
    expect(h).toContain(libelle);
    expect(h).not.toContain("<button");
  });

  it("pas prête : rien, quelle que soit l'étape", () => {
    for (const etape of [undefined, "a_relire", "validee", "programmee", "publiee"] as const) expect(html({ videoId: "v1", prete: false, etape })).toBe("");
  });
});
