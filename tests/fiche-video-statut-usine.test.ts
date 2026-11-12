import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockNavigation } from "./helpers/next-mocks";

vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/videos/v1", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: vi.fn(), push: () => undefined, replace: () => undefined }) }));
vi.mock("@/app/(studio)/videos/actions", () => ({
  archiverVideosAction: vi.fn(),
  changerEtapeEditorialeAction: vi.fn(),
  desarchiverVideosAction: vi.fn(),
  enregistrerCommeModeleAction: vi.fn(),
  renommerVideoAction: vi.fn(),
  mettreALaCorbeilleAction: vi.fn(),
  viderCorbeilleAction: vi.fn(),
}));

const { statutUsineDeEtape, statutUsineDeVideo } = await import("@/components/videos/statut-usine-video");
const { EnTeteVideo } = await import("@/components/videos/EnTeteVideo");

// Refonte RA2 (maquette M2, fiche d'une vidéo) : la fiche parle avec les 9 statuts de l'usine.
describe("statuts de la fiche d'une vidéo", () => {
  it.each([
    ["a_relire", "valider"],
    ["validee", "accepte"],
    ["programmee", "programme"],
    ["publiee", "publie"],
  ] as const)("étape éditoriale %s → %s", (etape, attendu) => {
    expect(statutUsineDeEtape(etape)).toBe(attendu);
  });

  it.each([
    ["brouillon", "brouillon"],
    ["maquette", "brouillon"],
    ["en_file", "fabrication"],
    ["en_fabrication", "fabrication"],
    ["prete", "valider"],
    ["echec", "corriger"],
    ["annulee", null],
    ["archivee", null],
  ] as const)("statut de vidéo %s → %s (null : pastille d'origine)", (statut, attendu) => {
    expect(statutUsineDeVideo(statut)).toBe(attendu);
  });
});

describe("en-tête de la fiche : un seul bouton orange", () => {
  it("« Valider » reste principal (orange) quand la vidéo n'est pas publiable (aucune barre Publier)", () => {
    const h = renderToStaticMarkup(
      createElement(EnTeteVideo, {
        videoId: "v1",
        titre: "Titre",
        statut: "prete",
        etapeEditoriale: "a_relire",
        format: { id: "facecam", nom: "Face caméra", icone: "video" },
        actions: createElement("span", null, "actions"),
      }),
    );
    expect(h).toMatch(/<button[^>]*bg-orange[^>]*>(?:(?!<\/button>).)*Valider/s);
  });

  it("l'aria-label de la pastille reprend le libellé visible", () => {
    const h = renderToStaticMarkup(
      createElement(EnTeteVideo, { videoId: "v1", titre: "T", statut: "prete", etapeEditoriale: "publiee", format: { id: "facecam", nom: "Face caméra", icone: "video" } }),
    );
    expect(h).toContain('aria-label="Publié, changer l&#x27;étape"');
  });
});
