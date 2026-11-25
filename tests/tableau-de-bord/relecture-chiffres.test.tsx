import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RelectureChiffres } from "../../src/components/formats/tableau-de-bord/RelectureChiffres";
import type { ChiffreARelire, DecisionChiffre } from "../../src/briques/donnees-video/relecture-chiffres";

const chiffres: ChiffreARelire[] = [
  { cle: "indicateur:a", libelle: "Visites", valeur: 1200.5, unite: "visites" },
  { cle: "indicateur:b", libelle: "Appels", valeur: 30, unite: "appels" },
  { cle: "indicateur:c", libelle: "Délai", valeur: 4, unite: "jours" },
];
const rendre = (decisions: Record<string, DecisionChiffre>, desactive?: boolean) =>
  renderToStaticMarkup(<RelectureChiffres chiffres={chiffres} decisions={decisions} onDecider={() => {}} desactive={desactive} />);
const compter = (html: string, mot: string) => html.split(`>${mot}<`).length - 1;

describe("RelectureChiffres", () => {
  it("sans décision : compteur à zéro et trois gestes par ligne", () => {
    const html = rendre({});
    expect(html).toContain("0 chiffres relus sur 3");
    for (const geste of ["Valider", "Corriger", "Refuser"]) expect(compter(html, geste)).toBe(3);
    expect(html).toContain("Visites");
    expect(html).toContain("visites");
  });

  it("une ligne validée, une corrigée, une refusée", () => {
    const html = rendre({ "indicateur:a": { type: "valide" }, "indicateur:b": { type: "corrige", valeur: 42 }, "indicateur:c": { type: "refuse" } });
    expect(html).toContain("Validé");
    expect(html).toContain("Corrigé : 42");
    expect(html).toContain("Refusé");
    expect(html).toContain("3 chiffres relus sur 3");
  });

  it("désactivé : tous les gestes sont désactivés", () => {
    const html = rendre({}, true);
    const boutons = html.match(/<button[^>]*>/g) ?? [];
    expect(boutons.length).toBe(9);
    for (const b of boutons) expect(b).toContain("disabled");
  });

  it("garde : rien dans src/app ni src/components (hors le fichier) ne l'importe", () => {
    const SRC = join(__dirname, "..", "..", "src");
    const trouves: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx?$/.test(nom) && !chemin.endsWith("RelectureChiffres.tsx") && /RelectureChiffres/.test(readFileSync(chemin, "utf8"))) trouves.push(chemin);
      }
    };
    parcourir(join(SRC, "app"));
    parcourir(join(SRC, "components"));
    expect(trouves).toEqual([join(SRC, "components", "formats", "tableau-de-bord", "EcranRelectureTableau.tsx")]);
  });
});
