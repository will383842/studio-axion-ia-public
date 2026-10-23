import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPACITE_CITATION, CAPACITE_PANNEAU, capaciteCarte, capaciteMotCarte, capaciteEtape, capaciteListe, PAGES, TYPES_PAGE } from "@/briques/visuels/registre-pages";
import { CONSIGNE_API } from "@/visuels/texte/api";
import { creerFournisseurSimulation } from "@/visuels/texte/simulation";

const consigne = readFileSync(join(process.cwd(), "scripts/visuels/consigne-session-carrousel.md"), "utf8");

describe("consigne de session", () => {
  it("annonce de 2 à 10 pages, couverture et T21 comprises", () => {
    expect(consigne).toContain("de 2 à 10 pages (couverture + ... + T21)");
  });

  it("écrit pour chaque type les budgets de titre du registre", () => {
    const lignes = consigne.split("\n").filter((l) => /^\| T\d/u.test(l));
    expect(lignes.length).toBeGreaterThan(0);
    for (const ligne of lignes) {
      const cellules = ligne.split("|").map((c) => c.trim());
      const types = cellules[1].split(",").map((t) => t.trim());
      const m = /titre(?: de page)? (\d+)/u.exec(cellules[3]);
      for (const t of types) {
        const max = PAGES[t as keyof typeof PAGES].titreMax;
        if (max === 0) expect(m, t).toBeNull();
        else expect(Number(m?.[1]), t).toBe(max);
      }
    }
  });

  it("écrit les budgets par élément du registre (cartes, points, panneaux, citation, étapes)", () => {
    const budgets = (t: string) => consigne.split("\n").find((l) => l.startsWith(`| ${t} |`))?.split("|")[3]?.trim() ?? "";
    // budgets réels (titre / corps) : « 2 cartes 48 / 130, 3 cartes 44 / 64 … 5 ou 6 cartes 12 / 20 »
    const attenduCartes = [2, 3, 4, 5].map((n) => {
      const c = capaciteCarte(n);
      return `${n === 5 ? "5 ou 6" : n} cartes ${c.titre} / ${c.corps}`;
    });
    expect(capaciteCarte(6)).toEqual(capaciteCarte(5));
    for (const a of attenduCartes) expect(budgets("T02"), a).toContain(a);
    expect(budgets("T02")).toContain(`aucun mot de plus de ${capaciteMotCarte(4)} signes dans un titre de carte à 4, 5 ou 6 cartes (${capaciteMotCarte(2)} à 2 ou 3 cartes)`);
    const attenduPoints = [3, 4].map((n) => `${n} points ${capaciteListe(n).texte}`);
    for (const a of attenduPoints) expect(budgets("T06"), a).toContain(a);
    expect(budgets("T08")).toContain(`chaque panneau ${CAPACITE_PANNEAU.texte}`);
    expect(budgets("T10")).toContain(`message ${CAPACITE_CITATION.message}`);
    expect(budgets("T10")).toContain(`légende ${CAPACITE_CITATION.legende}`);
    const attenduEtapes = [3, 4, 5].map((n) => {
      const e = capaciteEtape(n);
      return `${n} étapes ${e.titre} / ${e.corps}`;
    });
    for (const a of attenduEtapes) expect(budgets("T20"), a).toContain(a);
  });
});

describe("consigne de l'API et sujet maximal", () => {
  it("n'affiche aucun type sans titre", () => {
    expect(CONSIGNE_API).not.toMatch(/\(0\)/u);
    for (const t of TYPES_PAGE) if (PAGES[t].titreMax > 0) expect(CONSIGNE_API).toContain(`${t} (${PAGES[t].titreMax})`);
  });

  it("la simulation accepte 200 signes de sujet et refuse 201", async () => {
    const f = creerFournisseurSimulation();
    await expect(f.ecrire({ type: "sujet", sujet: "a".repeat(200) })).resolves.toMatchObject({ mode: "simulation" });
    await expect(f.ecrire({ type: "sujet", sujet: "a".repeat(201) })).rejects.toMatchObject({ code: "SUJET_INVALIDE" });
  });
});
