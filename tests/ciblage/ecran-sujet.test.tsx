/** Lot C3 : sur l'écran Sujet, « À qui ? » est hors du bloc « Je choisis », avant le bouton ; le bouton attend la cible. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boutonSujetActif, ciblageSaisi } from "@/components/generateur/cible-sujet";

const ecran = readFileSync(join(__dirname, "../../src/components/generateur/EcranSujet.tsx"), "utf8");
const fiche = readFileSync(join(__dirname, "../../src/components/generateur/FicheSujet.tsx"), "utf8");

describe("bouton « Écrire » : inactif tant que la cible manque", () => {
  it("inactif sans cible, actif une fois la cible choisie", () => {
    expect(boutonSujetActif(true, undefined, undefined)).toBe(false);
    expect(boutonSujetActif(true, undefined, ciblageSaisi("metier", "Plombier"))).toBe(true);
  });
  it("reste inactif si l'idée n'est pas prête ou si un refus attend un choix", () => {
    expect(boutonSujetActif(false, undefined, ciblageSaisi("taille", "TPE"))).toBe(false);
  });
  it("une valeur vide ou trop longue n'est pas une cible", () => {
    expect(ciblageSaisi("metier", "  ")).toBeUndefined();
    expect(ciblageSaisi("secteur", "x".repeat(81))).toBeUndefined();
    expect(ciblageSaisi("metier", " Plombier ")).toEqual({ niveau: "metier", libelle: "Plombier", origine: "saisie" });
  });
});

describe("écran Sujet : place de la cible", () => {
  it("ChoixCible et ChoixTypeAutomatisation sont sur l'écran, et ChoixCible vient avant le bouton", () => {
    expect(ecran).toContain("<ChoixCible");
    expect(ecran).toContain("<ChoixTypeAutomatisation");
    expect(ecran.indexOf("<ChoixCible")).toBeLessThan(ecran.indexOf("<BarreActionCollee>"));
  });
  it("« À qui ? » n'est plus dans le bloc « Je choisis »", () => {
    const bloc = ecran.slice(ecran.indexOf("Je choisis"), ecran.indexOf("</details>"));
    expect(bloc).not.toContain("À qui ?");
    expect(bloc).toContain("Mot cherché");
  });
  it("la cible est demandée aussi en mode « plusieurs » (pas masquée par !plusieurs)", () => {
    expect(ecran).not.toMatch(/\{!plusieurs && \(\s*<ChoixCible/);
    expect(ecran).toMatch(/disabled=\{!pret\}[^>]*setSerieOuverte|boutonSujetActif/);
  });
});

describe("fiche du sujet", () => {
  it("affiche la cible et le type d'automatisation", () => {
    expect(fiche).toContain("ciblage");
    expect(fiche).toContain("typeAutomatisation");
  });
});
