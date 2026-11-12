/**
 * Page Réglages rangée en rubriques (Williams, 08/11) : les rubriques sont présentes dans l'ordre, la page les porte
 * toutes (ancres), « Avancé » est repliée, et aucun libellé visible ne dit zernio, buffer, api, simulation, $ ou €.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RUBRIQUES } from "@/app/(studio)/reglages/rubriques";

const PAGE = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
const INTERDIT = /zernio|buffer|\bapi\b|simulation|\$|€/i;

describe("Réglages : rubriques", () => {
  it("cinq rubriques, dans l'ordre d'usage, Avancé en dernier et repliée", () => {
    expect(RUBRIQUES.map((r) => r.libelle)).toEqual(["Votre compte", "Vidéos et voix", "Publication", "Services reliés", "Avancé"]);
    expect(RUBRIQUES.filter((r) => r.replie).map((r) => r.id)).toEqual(["avance"]);
  });

  it("la page porte chaque rubrique, dans le même ordre", () => {
    const places = RUBRIQUES.map((r) => PAGE.indexOf(`id="${r.id}"`));
    expect(places.every((p) => p > 0)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    // Maquette M6 et décision de Williams du 12/11 : les cartes sont pliables (le pli est dans CartePliante) ; Avancé n'a plus de pli global.
    expect(readFileSync("src/components/reglages/CartePliante.tsx", "utf8")).toContain("<details");
    expect(PAGE).toContain("CartePliante");
  });

  it("aucun libellé visible interdit : rubriques et titres de cartes", () => {
    for (const r of RUBRIQUES) expect(r.libelle).not.toMatch(INTERDIT);
    const titres = [...PAGE.matchAll(/titre="([^"]+)"/g)].map((m) => m[1] ?? "");
    expect(titres.length).toBeGreaterThanOrEqual(14);
    for (const t of titres) expect(t, t).not.toMatch(INTERDIT);
  });

  it("les pages liées ont un titre qui dit ce qu'elles font", () => {
    const carrousels = readFileSync("src/app/(studio)/reglages/carrousels/page.tsx", "utf8");
    expect(carrousels).toContain('titre="Réglages des carrousels"');
    expect(carrousels).not.toMatch(/API payante|simulation|0 \$/);
    const drive = readFileSync("src/app/(studio)/reglages/google-drive/page.tsx", "utf8");
    expect(drive).toContain('titre="Importer depuis Google Drive"');
  });
});

describe("Réglages : maquette M6 (12/11)", () => {
  it("contrôle de production, veille et aide du chat sont dans Avancé, la base de connaissances reste à part, Migration sans lien", () => {
    const avance = PAGE.slice(PAGE.indexOf('id="avance"'));
    for (const id of ["controle-production", "outils", "aide-chat", "entretien"]) expect(avance, id).toContain(`id="${id}"`);
    expect(PAGE).toContain('href="/reglages/base-connaissances"');
    expect(PAGE).not.toMatch(/href="\/reglages\/migration/);
    expect(PAGE).toContain('id="migration"');
    expect(PAGE).toContain('id="credits-claude"');
  });
});
