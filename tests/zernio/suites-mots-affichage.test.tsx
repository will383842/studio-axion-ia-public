/** Petites suites des relectures PR 447 et PR 465 : jamais « au moins 0 », chiffres indisponibles rendus. Valeurs fictives, aucun réseau. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

const { TableauMots } = await import("@/components/mots/TableauMots");
const { EcranMots } = await import("@/components/mots/EcranMots");
type Ligne = import("@/domaine/guide-reseau/cibles-contrat").LigneTableauMot;
type Element = import("@/domaine/guide-reseau/cibles-contrat").ElementCatalogue;

const guide: Element = { code: "gde-modeles-01", type: "guide", titre: "Guide des modèles", actif: true, test: false };
const fen = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const ligne: Ligne = {
  mot: "DEVIS",
  reseau: "tous",
  cible: guide,
  source: "tous",
  cibleIntrouvable: false,
  divergent: false,
  actif: true,
  stats: { mot: "DEVIS", ecrits: fen(4, 10, 25), envoyes: fen(3, 8, 20), suivent: fen(0, 0, 0) },
};
const VUE_ECRAN = { interrupteurAllume: false, toutArrete: false, disjoncteur: { ouvert: false, raison: null, ouvertLe: null }, plafonds: { heureCompte: 600, jourMot: 1000 }, lignes: [], oppositions: 0 };
const lisible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("PR 447 · jamais « au moins 0 »", () => {
  it("zéro personne gagnée : 0 tout court", () => {
    const t = lisible(
      renderToStaticMarkup(
        <TableauMots vue={{ lignes: [ligne], ignores: 0, indisponible: false }} catalogue={[guide]} onChangerCible={vi.fn()} />,
      ),
    );
    expect(t).not.toContain("au moins 0");
  });
});

describe("PR 465 · écran /mots, suivi indisponible", () => {
  it("rend « Chiffres indisponibles pour l'instant »", () => {
    const html = renderToStaticMarkup(
      <EcranMots
        vue={VUE_ECRAN as never}
        services={{} as never}
        suiviIndisponible
      />,
    );
    expect(lisible(html)).toContain("Chiffres indisponibles pour l'instant");
  });
});
