/**
 * L7-17b : l'interrupteur de « À traiter » arrive jusqu'à la barre et aux onglets du bas.
 * Rendu serveur seulement (jsdom n'est pas installé). Aucune donnée réelle.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

let chemin = "/";
vi.mock("next/headers", () => mockHeaders);
// La feuille est fermée au rendu statique : on la rend toujours ouverte pour lire son contenu (même modèle que new-arg-01).
vi.mock("@/components/ui/FeuilleBas", () => ({
  FeuilleBas: ({ titre, pied, children }: { titre: string; pied?: ReactNode; children: ReactNode }) => createElement("section", null, createElement("h2", null, titre), children, pied),
}));
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => chemin }));

const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");
const { OngletsBas } = await import("@/components/coquille/OngletsBas");

type Options = { aTraiter?: boolean; aPublier?: boolean; surLeSite?: boolean };
const props = { formats: [], actionDeconnexion: async () => undefined };
const barre = (c: string, o: Options = {}) => ((chemin = c), renderToStaticMarkup(createElement(BarreLaterale, { ...props, ...o })));
const onglets = (c: string, o: Options = {}) => ((chemin = c), renderToStaticMarkup(createElement(OngletsBas, { ...props, ...o })));
const nbCourant = (html: string) => html.match(/aria-current="page"/g)?.length ?? 0;

describe("interrupteur éteint : rien ne change", () => {
  it("barre et feuille « Plus » identiques sans la prop, avec false", () => {
    for (const c of ["/", "/mots", "/a-traiter"]) {
      expect(barre(c, { aTraiter: false })).toBe(barre(c));
      expect(onglets(c, { aTraiter: false })).toBe(onglets(c));
    }
  });
  it("« À traiter » absent", () => {
    expect(barre("/mots")).not.toContain("À traiter");
    expect(onglets("/mots")).not.toContain("À traiter");
  });
});

describe("interrupteur allumé", () => {
  it("la barre montre « À traiter » en dernier sous Publier", () => {
    const html = barre("/mots", { aTraiter: true, aPublier: true });
    expect(html).toContain('href="/a-traiter"');
    expect(html.indexOf(">Réponses automatiques<")).toBeLessThan(html.indexOf(">À traiter<"));
    expect(html.indexOf(">À traiter<")).toBeLessThan(html.indexOf(">Résultats<"));
  });
  it("l'onglet « Plus » porte la page en cours sur /a-traiter", () => {
    expect(onglets("/a-traiter", { aTraiter: true })).toContain("contient la page en cours");
    expect(onglets("/a-traiter")).not.toContain("contient la page en cours");
  });
  it("la feuille « Plus » : « À traiter » en dernier dans la section Publier, avant Compte", () => {
    const html = onglets("/mots", { aTraiter: true, aPublier: true, surLeSite: true });
    const feuille = html.slice(html.indexOf(">Plus</h2>"));
    const i = (t: string) => feuille.indexOf(t);
    expect(i('href="/a-traiter"')).toBeGreaterThan(i(">Publier<"));
    expect(i('href="/a-traiter"')).toBeGreaterThan(i(">Réponses automatiques<"));
    expect(i('href="/a-traiter"')).toBeLessThan(i(">Compte<"));
    const publier = feuille.slice(i(">Publier<"), i(">Compte<"));
    expect(publier.indexOf(">Ressources<") === -1 || publier.indexOf('href="/a-traiter"') < publier.indexOf(">Ressources<")).toBe(true);
    const lien = feuille.match(/<a[^>]*href="\/a-traiter"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    expect(lien.replace(/<[^>]*>/g, "").trim()).toBe("À traiter");
  });
  it("éteinte, la feuille « Plus » n'a pas « À traiter » et reste identique", () => {
    const html = onglets("/mots", { aPublier: true });
    expect(html).not.toContain("/a-traiter");
    expect(onglets("/mots", { aPublier: true, aTraiter: false })).toBe(html);
  });
  it("sur /a-traiter : une seule page en cours, Publier ouvert", () => {
    const html = barre("/a-traiter", { aTraiter: true });
    expect(nbCourant(html)).toBe(1);
    expect(html).toMatch(/aria-expanded="true"[^>]*aria-label="Fermer Publier"/);
  });
  it("aucun compteur ni pastille dans le menu", () => {
    const html = barre("/mots", { aTraiter: true });
    const lien = html.match(/<a[^>]*href="\/a-traiter"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    expect(lien.replace(/<[^>]*>/g, "")).toBe("À traiter");
    expect(lien.match(/<span/g)?.length).toBe(1);
  });
});
