import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { libelleReseauContenu } from "@/components/contenus/FiltresContenus";
import { LogoReseau } from "./LogoReseau";

describe("LogoReseau : réseau hors vidéo", () => {
  it("affiche Pinterest sans lever d'erreur", () => {
    const html = renderToStaticMarkup(<LogoReseau reseau="pinterest" taille="sm" />);
    expect(html).toContain("Pinterest");
    expect(html).toContain(">P<");
  });
  it("affiche toujours un réseau vidéo", () => {
    expect(renderToStaticMarkup(<LogoReseau reseau="tiktok" />)).toContain("TT");
  });
  it("libellé de contenu pour pinterest", () => {
    expect(libelleReseauContenu("pinterest")).toBe("Pinterest");
  });
});
