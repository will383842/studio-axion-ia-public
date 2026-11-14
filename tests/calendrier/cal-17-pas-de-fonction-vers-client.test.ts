import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/app/(studio)/calendrier/page.tsx", "utf8");
const agenda = readFileSync("src/components/calendrier/VueAgenda.tsx", "utf8");

describe("CAL-17 : la page serveur ne passe aucune fonction à VueAgenda (composant client)", () => {
  it("VueAgenda est un composant client", () => {
    expect(agenda.startsWith('"use client"')).toBe(true);
  });

  it("la page passe suiteJour (une chaîne) et non lienJour (une fonction) à VueAgenda", () => {
    const balise = page.slice(page.indexOf("<VueAgenda"), page.indexOf("/>", page.indexOf("<VueAgenda")) + 2);
    expect(balise).toContain("suiteJour={suite}");
    expect(balise).not.toMatch(/lienJour=|=\{\(?[a-z]*\)?\s*=>/);
  });

  it("le lien du jour garde la même adresse avec suiteJour", () => {
    expect(agenda).toContain("adresseVueJour(jour, suiteJour)");
  });
});
