/** SUI-B : tableau du suivi chiffré (sans DOM, crochets factices). Valeurs fictives. */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (o) => ({
  ...(await o<typeof import("react")>()),
  ...(await import("../aides/crochets-factices")).crochets,
}));

const { monter, trouver, texteDe } = await import("../aides/crochets-factices");
const { TableauSuiviMots } = await import("@/components/mots/TableauSuiviMots");
type TableauSuivi = import("@/components/mots/suivi-affichage").TableauSuivi;

const fen = (j7: number, j30: number, total: number) => ({ j7, j30, total });
const base = (siteDisponible: boolean, gagnees = 3): TableauSuivi => ({
  genereLe: "2026-01-01T00:00:00Z",
  siteDisponible,
  lignes: [
    {
      mot: "GUIDE",
      commentaires: fen(1, 5, 9),
      reponsesPubliques: fen(1, 4, 8),
      premiersMessages: fen(2, 6, 10),
      renvois: fen(0, 1, 2),
      formulaires: siteDisponible ? fen(0, 0, 0) : null,
      envoisEmail: siteDisponible ? fen(0, 0, 0) : null,
      clics: siteDisponible ? fen(0, 0, 0) : null,
      instagram: { reponsesOk: fen(0, 0, 0), dejaSuivi: fen(0, 0, 0), gagnees: fen(gagnees, gagnees + 1, gagnees + 2), sansSuivre: fen(0, 0, 0), inconnu: fen(0, 0, 0) },
      auMoinsGagnees: gagnees,
      parPublication: [{ post: "post-1", reseau: "instagram", commentaires: 1, premiersMessages: 2, formulaires: null, clics: null, auMoinsGagnees: gagnees }],
      formulations: [{ version: "A", envois: 4, clics: null }],
    },
  ],
});

const rendu = (s: TableauSuivi) => renderToStaticMarkup(<TableauSuiviMots suivi={s} />);

describe("TableauSuiviMots", () => {
  it("écrit « au moins 3 » et « aucune vue pour l'instant » pour 0", () => {
    expect(rendu(base(true, 3))).toContain("au moins 3");
    const zero = rendu(base(true, 0));
    expect(zero).toContain("aucune vue pour l&#x27;instant");
  });
  it("site indisponible : bandeau et « — » au lieu de 0", () => {
    const html = rendu(base(false));
    expect(html).toContain("Chiffres du site indisponibles pour l&#x27;instant");
    expect(html).toContain("<td>—</td>");
    expect(html).not.toContain("<td>0</td>");
    expect(rendu(base(true))).not.toContain("indisponibles");
  });
  it("tableau accessible : caption et th scope", () => {
    const html = rendu(base(true));
    expect(html).toContain("<caption>");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("<details");
  });
  it("changement de fenêtre : 7 jours, 30 jours, total", () => {
    const m = monter(TableauSuiviMots, { suivi: base(true) });
    const cellules = () => trouver(m.rendre(), (e) => e.type === "td").map((e) => texteDe(e));
    expect(cellules()[0]).toBe("1");
    const bouton = (t: string) => trouver(m.rendre(), (e) => e.type === "button" && texteDe(e) === t)[0];
    (bouton("30 jours").props.onClick as () => void)();
    expect(cellules()[0]).toBe("5");
    (bouton("Total").props.onClick as () => void)();
    expect(cellules()[0]).toBe("9");
  });
  it("la colonne des personnes gagnées suit la période choisie", () => {
    const m = monter(TableauSuiviMots, { suivi: base(true, 3) });
    const derniere = () => {
      const t = trouver(m.rendre(), (e) => e.type === "td").map((e) => texteDe(e));
      return t[t.length - 1];
    };
    const bouton = (t: string) => trouver(m.rendre(), (e) => e.type === "button" && texteDe(e) === t)[0];
    expect(derniere()).toBe("au moins 3");
    (bouton("30 jours").props.onClick as () => void)();
    expect(derniere()).toBe("au moins 4");
    (bouton("Total").props.onClick as () => void)();
    expect(derniere()).toBe("au moins 5");
  });
  it("ni le HTML rendu ni les sources ne contiennent le mot interdit", () => {
    const motif = new RegExp(["ab", "onn"].join(""), "i");
    expect(rendu(base(true))).not.toMatch(motif);
    expect(rendu(base(false))).not.toMatch(motif);
    expect(readFileSync("src/components/mots/TableauSuiviMots.tsx", "utf8")).not.toMatch(motif);
  });
});
