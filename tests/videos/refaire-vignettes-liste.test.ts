/** Bouton « Refaire toutes les vignettes » de la liste des vidéos : un clic enchaîne les tours jusqu'à 0 restante. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockNavigation } from "../helpers/next-mocks";

vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => ({ refaireToutesLesVignettesAction: async () => ({ ok: true, donnees: { videos: 0, erreurs: 0, restantes: 0 } }) }));

const { enchainerVignettes, texteProgres, texteFinal } = await import("@/domaine/vignettes-en-serie");
const { RefaireToutesLesVignettes } = await import("@/components/videos/RefaireToutesLesVignettes");

type Tour = { videos: number; erreurs: number; restantes: number };
const ok = (donnees: Tour) => ({ ok: true as const, donnees });
const scenario = (tours: Array<ReturnType<typeof ok> | { ok: false; message: string }>) => {
  const appel = vi.fn(async () => tours.shift() ?? { ok: false as const, message: "plus de réponse" });
  return appel;
};

describe("enchaînement des vignettes", () => {
  it("enchaîne les tours jusqu'à restantes = 0 et cumule", async () => {
    const appel = scenario([ok({ videos: 20, erreurs: 0, restantes: 40 }), ok({ videos: 20, erreurs: 1, restantes: 20 }), ok({ videos: 19, erreurs: 0, restantes: 0 })]);
    const suivis: string[] = [];
    const r = await enchainerVignettes(appel, (p) => suivis.push(texteProgres(p)));
    expect(appel).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ etat: "termine", videos: 59, erreurs: 1, restantes: 0 });
    expect(suivis[0]).toBe("20 vidéos refaites, il en reste 40…");
    expect(texteFinal(r)).toBe("Vignettes refaites : 59 vidéos, 1 en échec");
  });

  it("s'arrête si le compteur ne baisse plus après 2 tours", async () => {
    const appel = scenario([ok({ videos: 20, erreurs: 0, restantes: 60 }), ok({ videos: 0, erreurs: 20, restantes: 60 }), ok({ videos: 0, erreurs: 20, restantes: 60 }), ok({ videos: 0, erreurs: 20, restantes: 60 })]);
    const r = await enchainerVignettes(appel, () => undefined);
    expect(appel).toHaveBeenCalledTimes(3);
    expect(r.etat).toBe("erreur");
    expect(r.restantes).toBe(60);
  });

  it("affiche l'erreur et s'arrête après une erreur répétée", async () => {
    const appel = scenario([ok({ videos: 20, erreurs: 0, restantes: 40 }), { ok: false, message: "Service indisponible" }, { ok: false, message: "Service indisponible" }]);
    const r = await enchainerVignettes(appel, () => undefined);
    expect(appel).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ etat: "erreur", message: "Service indisponible", videos: 20 });
  });

  it("une seule erreur isolée est retentée puis le travail continue", async () => {
    const appel = scenario([{ ok: false, message: "Coup de chaud" }, ok({ videos: 5, erreurs: 0, restantes: 0 })]);
    const r = await enchainerVignettes(appel, () => undefined);
    expect(r).toMatchObject({ etat: "termine", videos: 5 });
  });
});

describe("composant", () => {
  it("état normal : bouton actif, jetons de la charte uniquement", () => {
    const h = renderToStaticMarkup(createElement(RefaireToutesLesVignettes));
    expect(h).toContain("Refaire toutes les vignettes");
    expect(h).not.toMatch(/ disabled(=|>)/);
    expect(h).not.toMatch(/#[0-9a-fA-F]{3,6}|\[#/);
  });
});
