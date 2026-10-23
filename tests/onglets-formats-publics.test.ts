/**
 * Relecture PR #338 (bloquant) : « Mes vidéos » ne doit pas montrer l'onglet d'un format actif qui n'est pas dans la
 * liste publique (`listerFormats()`, ex. face caméra animée réservée à Will), sauf s'il a des vidéos ou s'il est l'onglet courant.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/formats", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/formats")>();
  const prive = { ...reel.obtenirFormat("avocat"), id: "face-privee", nom: "Face privée", nomCourt: "Face privée", statut: "actif" as const };
  return {
    ...reel,
    // Simule un format actif hors liste publique : présent seulement avec `inclureMasques`.
    listerFormats: (options: { inclureMasques?: boolean } = {}) => (options.inclureMasques ? [...reel.listerFormats(options), prive] : reel.listerFormats(options)),
  };
});

const { OngletsMesVideos } = await import("@/components/videos/OngletsMesVideos");

const rendre = (compteParFormat: Record<string, number>, actif = "toutes") =>
  renderToStaticMarkup(createElement(OngletsMesVideos, { actif, compteParFormat, nbToutes: 1, nbBrouillons: 0, nbArchivees: 0 }));

describe("OngletsMesVideos : format actif hors liste publique", () => {
  it("sans vidéo : pas d'onglet", () => {
    expect(rendre({})).not.toContain('href="/formats/face-privee"');
  });
  it("avec une vidéo : l'onglet est là", () => {
    expect(rendre({ "face-privee": 1 })).toContain('href="/formats/face-privee"');
  });
  it("onglet courant : il reste affiché", () => {
    expect(rendre({}, "face-privee")).toContain('href="/formats/face-privee"');
  });
  it("un format actif public garde son onglet sans vidéo", () => {
    expect(rendre({})).toContain('href="/formats/avocat"');
  });
});
