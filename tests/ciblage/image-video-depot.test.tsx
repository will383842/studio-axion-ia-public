/** Ciblage, lot F : DepotTexte propose la cible et le type, facultatifs (rendu serveur). */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/(studio)/image-video/actions", () => ({ deposerTexteImageVideoAction: vi.fn() }));

import { DepotTexte, ciblageDepose } from "@/components/formats/image-video/DepotTexte";

const base = { texte: "relancer une facture", onTexte: () => {}, reseaux: ["linkedin"] as never[], montant: 100, onRefus: () => {} };

describe("DepotTexte", () => {
  it("affiche le choix de cible et du type d'automatisation, sans les rendre obligatoires", () => {
    const html = renderToStaticMarkup(createElement(DepotTexte, base));
    expect(html).toContain("Qui visez-vous ?");
    expect(html).toContain("Quel type d&#x27;automatisation ?");
    expect(html).not.toMatch(/disabled=""[^>]*>Écrire le script/);
  });
  it("ciblageDepose : rien tant que la valeur est vide, sinon un ciblage saisi", () => {
    expect(ciblageDepose("metier", "  ")).toBeUndefined();
    expect(ciblageDepose("metier", "plombier")).toEqual({ niveau: "metier", libelle: "plombier", origine: "saisie" });
    expect(ciblageDepose("taille", "PME")?.niveau).toBe("taille");
  });
});
