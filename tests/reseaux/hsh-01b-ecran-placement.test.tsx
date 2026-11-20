/** HSH-01b · écran du placement des hashtags : un choix par réseau, repli, « hypothèse », vouvoiement, aucun prix. */
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
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
  it("TikTok affiche la phrase de repli ; Instagram (second outil) n'en a plus, il transmet le premier commentaire (ZRN-01)", () => {
    expect(html).toContain("TikTok n&#x27;accepte pas de premier commentaire");
    expect(html).not.toContain("Le premier commentaire n&#x27;est pas transmis sur Instagram");
  });
  it("pas de repli quand le choix est « texte »", () => {
    expect(renderToStaticMarkup(<PlacementHashtags reseaux={infos("texte")} />)).not.toContain("n&#x27;accepte pas");
  });
  it("règle sans source : « hypothèse » ; règle sourcée : la source et la date", () => {
    expect(html).toContain("Hypothèse");
    expect(html).toContain("Source :");
    expect(html).toContain("03/10/2026");
  });
  it("aucune mention de l'outil par son nom, aucun prix, pas de tutoiement", () => {
    expect(html).not.toMatch(/buffer/i);
    expect(html).not.toMatch(/€|\$|prix|tarif/i);
    expect(html).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
  });
  it("source en français simple : ni code interne, ni mot technique, ni date au format ISO", () => {
    const jargon = infos("texte").map((i) => ({
      ...i,
      diffuseurs: i.diffuseurs.map((d) => (d.source.niveau === "sourcé" ? { ...d, source: { ...d.source, texte: "Schéma de l'outil (hors relevé L8-01)" } } : d)),
    }));
    const h = renderToStaticMarkup(<PlacementHashtags reseaux={jargon} />);
    expect(h).toContain("Source : documentation de l&#x27;outil, vérifiée le 03/10/2026.");
    expect(h).toContain("Hypothèse");
    expect(h).not.toMatch(/L8-01|Schéma|\d{4}-\d{2}-\d{2}/);
  });
  it("TikTok : la phrase de repli identique n'apparaît qu'une fois", () => {
    const tiktok = infos("premier-commentaire").filter((i) => i.reseau === "tiktok");
    const h = renderToStaticMarkup(<PlacementHashtags reseaux={tiktok} />);
    expect(h.match(/TikTok n&#x27;accepte pas de premier commentaire/g) ?? []).toHaveLength(1);
  });
  it("page.tsx : le commentaire de PageReglages est juste au-dessus de la fonction", () => {
    const src = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
    const doc = src.indexOf("RÉGLAGES — cinq rubriques");
    expect(src.indexOf("const NOMS_PLACEMENT")).toBeLessThan(doc);
    expect(src.indexOf("function infosPlacement")).toBeLessThan(doc);
    expect(src.slice(doc, src.indexOf("export default async function PageReglages"))).not.toMatch(/NOMS_PLACEMENT|OUTILS_PLACEMENT|infosPlacement/);
  });
});
