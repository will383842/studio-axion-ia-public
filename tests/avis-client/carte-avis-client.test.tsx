/** C8-A04 : la carte d'avis client ne montre que de vrais avis ; filigrane seulement pour un exemple. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { AvisClient } from "@/domaine/avis-client/types";
import { CarteAvisClient, type AvisCarte } from "../../studio-rendu/compositions/avis-client/CarteAvisClient";

const avis: AvisCarte = { auteur: "Marie D.", note: 4, texte: "Un « super » accompagnement, très clair.", date: "2026-10-02" };
const rendre = (a: AvisCarte | null | undefined, ratio: "9:16" | "16:9" | "1:1" = "9:16"): string =>
  renderToStaticMarkup(createElement(CarteAvisClient, { avis: a, ratio }));

describe("CarteAvisClient", () => {
  it("un AvisClient du domaine est assignable aux props structurelles", () => {
    const reel: AvisClient = { id: "a1", auteur: "X", date: "2026-10-02", source: "google", note: 5, texte: "t", statut: "published", accordAuteur: { ecrit: true, date: "2026-10-01", forme: "mail" }, valideLe: "2026-10-03" };
    const props: AvisCarte = reel;
    expect(props.note).toBe(5);
  });
  it("sans avis, sans texte ou note invalide : rendu vide (null)", () => {
    expect(rendre(undefined)).toBe("");
    expect(rendre(null)).toBe("");
    expect(rendre({ ...avis, texte: "   " })).toBe("");
    expect(rendre({ ...avis, note: 0 })).toBe("");
    expect(rendre({ ...avis, note: 6 })).toBe("");
  });
  it("un avis réel montre le texte inchangé, l'auteur, la date et la note réelle", () => {
    const html = rendre(avis);
    expect(html).toContain("Un « super » accompagnement, très clair.");
    expect(html).toContain("Marie D.");
    expect(html).toContain("2026-10-02");
    expect(html.match(/data-etoile="pleine"/g)).toHaveLength(4);
    expect(html.match(/data-etoile="vide"/g)).toHaveLength(1);
    expect(html).not.toContain("EXEMPLE");
  });
  it("le filigrane n'apparaît que pour exemple === true", () => {
    expect(rendre({ ...avis, exemple: true })).toContain("EXEMPLE");
    expect(rendre({ ...avis, exemple: undefined })).not.toContain("EXEMPLE");
  });
});
