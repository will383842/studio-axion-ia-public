import { describe, expect, it } from "vitest";
import {
  MANIFESTE_LOGOS,
  MENTION_MARQUES,
  controlerEntreeLogo,
  type EntreeLogoOutil,
} from "../../../src/briques/motion/logos-outils/manifeste";
import { resoudreLogo } from "../../../src/briques/motion/logos-outils/resoudre";
import type { DessinLogo } from "../../../src/briques/motion/logos-outils/types";

const modele: EntreeLogoOutil = {
  id: "exemple-outil",
  nature: "outil",
  outil: "Exemple",
  source: "Simple Icons",
  adresse: "https://example.org/logo",
  adresseCharte: "https://example.org/charte",
  dateRecuperation: "2026-11-15",
  versionSource: "1.0.0",
  licenceFichier: "outils/logos-outils/PREUVES/LICENCE-exemple.txt",
  reglesCharte: "Texte de la charte copié.",
  charte: { recoloration: false },
  preuve: "outils/logos-outils/PREUVES/exemple.md",
  empreinteSha256: "a".repeat(64),
  risque: "faible",
  statut: "a-valider",
};

describe("manifeste des logos d'outils", () => {
  it("est vide", () => {
    expect(MANIFESTE_LOGOS.length).toBe(0);
  });
  it("chaque entrée passe le contrôle", () => {
    for (const e of MANIFESTE_LOGOS) expect(controlerEntreeLogo(e)).toEqual([]);
  });
  it("accepte une entrée à valider correcte", () => {
    expect(controlerEntreeLogo(modele)).toEqual([]);
  });
  it("refuse valide sans validePar ou sans dateValidation", () => {
    expect(controlerEntreeLogo({ ...modele, statut: "valide" }).length).toBeGreaterThan(0);
    expect(controlerEntreeLogo({ ...modele, statut: "valide", validePar: "Humain" }).length).toBeGreaterThan(0);
    expect(controlerEntreeLogo({ ...modele, statut: "valide", dateValidation: "2026-11-15" }).length).toBeGreaterThan(0);
    expect(
      controlerEntreeLogo({ ...modele, statut: "valide", validePar: "Humain", dateValidation: "2026-11-15" }),
    ).toEqual([]);
  });
  it("refuse toute nature autre que outil (aucun id client)", () => {
    expect(controlerEntreeLogo({ ...modele, nature: "client" } as unknown as EntreeLogoOutil).length).toBeGreaterThan(0);
  });
  it("refuse un id hors ^[a-z0-9-]+$", () => {
    for (const id of ["", "Majuscule", "a_b", "a b", "é"]) {
      expect(controlerEntreeLogo({ ...modele, id }).length).toBeGreaterThan(0);
    }
  });
  it("la mention ne contient ni partenaire ni officiel", () => {
    expect(MENTION_MARQUES).not.toMatch(/partenaire|officiel/i);
  });
});

describe("resoudreLogo", () => {
  const dessin: DessinLogo = { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M0 0h24v24H0z" }]] };
  it("rend null sans lever pour entrées invalides", () => {
    expect(resoudreLogo(undefined as unknown as string, {})).toBeNull();
    expect(resoudreLogo("", { "": dessin })).toBeNull();
    expect(resoudreLogo(42 as unknown as string, { a: dessin })).toBeNull();
    expect(resoudreLogo("inconnu", { a: dessin })).toBeNull();
    expect(resoudreLogo("a", {})).toBeNull();
    expect(resoudreLogo("a", undefined as unknown as Record<string, DessinLogo>)).toBeNull();
    expect(resoudreLogo("toString", {})).toBeNull();
  });
  it("rend le dessin connu", () => {
    expect(resoudreLogo("a", { a: dessin })).toBe(dessin);
  });
});
