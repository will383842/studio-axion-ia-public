/** Lot M (08/11, Williams) : la carte d'une vidéo porte la pastille de son réseau. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CarteVideo } from "@/components/videos/CarteVideo";
import type { VueVideoCarte } from "@/services/vues";

const base: VueVideoCarte = {
  id: "v1", titre: "Ma vidéo", format: { id: "facecam", nom: "Face caméra", icone: "film", statut: "actif" }, statut: "prete", aVersionFinie: true,
  dureeCibleSec: 30, dureeSec: 30, dureeEstimee: false, ratios: ["9:16"], ratioPrincipal: "9:16", vignette: null, video: null,
  creeLe: "2026-11-01T10:00:00Z", modifieLe: "2026-11-01T10:00:00Z",
};
const html = (v: Partial<VueVideoCarte>) => renderToStaticMarkup(createElement(CarteVideo, { video: { ...base, ...v } }));

describe("CarteVideo : pastille du réseau", () => {
  it("affiche le réseau précis sous le titre", () => {
    const h = html({ reseaux: ["linkedin"], reseauxPrecis: true });
    expect(h).toContain('aria-label="Pour LinkedIn"');
    expect(h).toContain('data-precis="oui"');
  });
  it("réseaux par défaut : atténués", () => {
    expect(html({ reseaux: ["linkedin", "instagram"], reseauxPrecis: false })).toContain('data-precis="non"');
  });
  it("sans réseaux (autres écrans) : aucune pastille", () => {
    expect(html({})).not.toContain("Pour ");
  });
});
