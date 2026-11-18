/**
 * L7-17b : l'interrupteur de « À traiter » arrive jusqu'à la barre et aux onglets du bas.
 * Rendu serveur seulement (jsdom n'est pas installé). Aucune donnée réelle.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

let chemin = "/";
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => chemin }));

const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");
const { OngletsBas } = await import("@/components/coquille/OngletsBas");

const props = { formats: [], actionDeconnexion: async () => undefined };
const barre = (c: string, o: { aTraiter?: boolean } = {}) => ((chemin = c), renderToStaticMarkup(createElement(BarreLaterale, { ...props, ...o })));
const onglets = (c: string, o: { aTraiter?: boolean } = {}) => ((chemin = c), renderToStaticMarkup(createElement(OngletsBas, { ...props, ...o })));
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
    const html = barre("/mots", { aTraiter: true, aPublier: true } as never);
    expect(html).toContain('href="/a-traiter"');
    expect(html.indexOf(">Réponses automatiques<")).toBeLessThan(html.indexOf(">À traiter<"));
    expect(html.indexOf(">À traiter<")).toBeLessThan(html.indexOf(">Résultats<"));
  });
  it("la feuille « Plus » (fermée au rendu statique) reçoit « À traiter » : l'onglet « Plus » porte la page en cours", () => {
    expect(onglets("/a-traiter", { aTraiter: true })).toContain("contient la page en cours");
    expect(onglets("/a-traiter")).not.toContain("contient la page en cours");
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
