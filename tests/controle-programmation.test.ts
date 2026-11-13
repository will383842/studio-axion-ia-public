/**
 * L7-12 : le contrôleur de texte branché à la programmation. Données fictives, aucun appel réel.
 * Le contrôle avertit, il n'empêche jamais un ajout manuel. Les mots interdits sont assemblés, jamais écrits en clair.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { controlerProgrammation, compterMotsDiese } from "@/services/controle-programmation";
import { FicheEntree, type EntreeFiche } from "@/components/calendrier/FicheEntree";

const J = (...p: string[]) => p.join("");
const INTERDIT = J("cert", "ifié");
const BASE = "Trois gestes simples pour ranger vos fichiers. Chacun prend une minute.";
const diese = (n: number) => Array.from({ length: n }, (_, i) => `#astuce${i + 1}`).join(" ");

describe("compterMotsDiese", () => {
  it("compte les mots-dièse, accents compris", () => {
    expect(compterMotsDiese("Bonjour #été #Qualité2 sans # seul")).toBe(2);
    expect(compterMotsDiese("")).toBe(0);
  });
});

describe("controlerProgrammation", () => {
  it("un texte conforme : voyant vert", () => {
    const r = controlerProgrammation({ reseau: "linkedin", texte: `${BASE}\n${diese(3)}`, auteur: "will" });
    expect(r.voyant).toBe("vert");
    expect(r.avertissements).toEqual([]);
  });

  it("6 mots-dièse sur LinkedIn : voyant orange, jamais bloquant", () => {
    const r = controlerProgrammation({ reseau: "linkedin", texte: `${BASE}\n${diese(6)}`, auteur: "will" });
    expect(r.voyant).toBe("orange");
    expect(r.bloque).toBe(false);
    expect(r.avertissements.join(" ")).toMatch(/6 mots-dièse/);
  });

  it("un mot interdit d'un ajout manuel avertit sans bloquer", () => {
    const r = controlerProgrammation({ reseau: "linkedin", texte: `${BASE} Vous êtes ${INTERDIT}. ${diese(3)}`, auteur: "will" });
    expect(r.voyant).toBe("orange");
    expect(r.bloque).toBe(false);
  });

  it("un texte trop long est rouge : format technique", () => {
    const r = controlerProgrammation({ reseau: "linkedin", texte: "a".repeat(4000), auteur: "will" });
    expect(r.voyant).toBe("rouge");
    expect(r.bloque).toBe(true);
  });

  it("ne cite aucun montant", () => {
    const r = controlerProgrammation({ reseau: "linkedin", texte: `${BASE}\n${diese(6)}`, auteur: "will" });
    expect(JSON.stringify(r)).not.toMatch(/€|\$|euro/i);
  });
});

describe("FicheEntree : voyant du contrôle", () => {
  const entree = (texte: string): EntreeFiche =>
    ({ cle: "creneau:c1|linkedin", reseau: "linkedin", type: "post", etat: "brouillon", jour: "2026-11-20", heure: "09:00", texte }) as unknown as EntreeFiche;
  const rendre = (texte: string) => renderToStaticMarkup(createElement(FicheEntree, { entree: entree(texte), aujourdhui: "2026-11-11", action: () => {} }));

  it("affiche le voyant orange pour 6 mots-dièse, sans retirer le bouton d'enregistrement", () => {
    const html = rendre(`${BASE}\n${diese(6)}`);
    expect(html).toContain('data-voyant-controle="orange"');
    expect(html).toContain("Enregistrer le texte");
  });

  it("affiche le voyant vert pour un texte conforme", () => {
    expect(rendre(`${BASE}\n${diese(3)}`)).toContain('data-voyant-controle="vert"');
  });
});
