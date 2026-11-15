/** HSH-01b · écran du placement des hashtags : un choix par réseau, repli, « hypothèse », vouvoiement, aucun prix. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(studio)/reglages/actions", () => ({ definirPlacementAction: vi.fn() }));
import { PlacementHashtags, type InfoReseauPlacement } from "@/components/reglages/PlacementHashtags";
import { placerHashtags, premierCommentairePossible, REGLES_PLACEMENT, RESEAUX_PLACEMENT, type ReseauPlacement } from "@/reseaux/placement-hashtags";

function infos(choix: "texte" | "premier-commentaire"): InfoReseauPlacement[] {
  return RESEAUX_PLACEMENT.map((reseau: ReseauPlacement) => ({
    reseau,
    nom: reseau,
    placement: choix,
    diffuseurs: (["buffer", "zernio"] as const).map((id) => {
      const r = REGLES_PLACEMENT[reseau][id];
      return {
        nom: id === "buffer" ? "Outil principal" : "Second outil",
        possible: premierCommentairePossible(reseau, id),
        repli: placerHashtags({ reseau, outil: id, placement: "premier-commentaire", texte: "", motsDiese: ["#a"] }).repli,
        source: r.niveau === "sourcé" ? { niveau: "sourcé" as const, texte: r.source, date: r.date } : { niveau: "hypothèse" as const },
      };
    }),
  }));
}

describe("HSH-01b · écran du placement", () => {
  const html = renderToStaticMarkup(<PlacementHashtags reseaux={infos("premier-commentaire")} />);
  it("un choix (deux boutons) par réseau", () => {
    expect((html.match(/type="radio"/g) ?? []).length).toBe(RESEAUX_PLACEMENT.length * 2);
    expect(html).toContain("À la fin du texte");
    expect(html).toContain("Dans le premier commentaire");
  });
  it("TikTok et Instagram (second outil) affichent la phrase de repli", () => {
    expect(html).toContain("TikTok n&#x27;accepte pas de premier commentaire");
    expect(html).toContain("Le premier commentaire n&#x27;est pas transmis sur Instagram");
  });
  it("pas de repli quand le choix est « texte »", () => {
    expect(renderToStaticMarkup(<PlacementHashtags reseaux={infos("texte")} />)).not.toContain("n&#x27;accepte pas");
  });
  it("règle sans source : « hypothèse » ; règle sourcée : la source et la date", () => {
    expect(html).toContain("Hypothèse");
    expect(html).toContain("Source :");
    expect(html).toContain("2026-10-03");
  });
  it("aucune mention de l'outil par son nom, aucun prix, pas de tutoiement", () => {
    expect(html).not.toMatch(/buffer/i);
    expect(html).not.toMatch(/€|\$|prix|tarif/i);
    expect(html).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
  });
});
