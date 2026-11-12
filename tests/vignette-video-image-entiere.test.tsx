/**
 * Liste « Mes vidéos » : la vignette montre l'image ENTIÈRE (09/11, Williams). Une vidéo 1:1 ou 4:5 dans un cadre 9:16
 * imposé par la grille n'est plus rognée (object-cover) : elle est contenue sur le fond uni de la charte.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VignetteVideo } from "@/components/ui/VignetteVideo";

const rendu = (ratio: "9:16" | "1:1" | "4:5" | "16:9", ratioImage: "9:16" | "1:1" | "4:5" | "16:9") =>
  renderToStaticMarkup(createElement(VignetteVideo, { src: "/m.jpg", titre: "T", ratio, ratioImage }));

describe("vignette de la liste", () => {
  it.each([
    ["9:16", "1:1"],
    ["9:16", "4:5"],
    ["9:16", "16:9"],
    ["16:9", "9:16"],
    ["1:1", "4:5"],
  ] as const)("cadre %s, image %s : image entière (object-contain), jamais rognée", (cadre, image) => {
    const html = rendu(cadre, image);
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain("blur-xl");
  });

  it("image au ratio du cadre : remplit le cadre", () => {
    expect(rendu("9:16", "9:16")).toContain("object-cover");
  });

  it("fond uni de la charte (jeton surface-2)", () => {
    expect(rendu("9:16", "1:1")).toContain("bg-surface-2");
  });
});
