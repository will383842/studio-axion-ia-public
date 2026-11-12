/** S1.8 — Réglages → Sur le site : une ligne par format actif, le conseil affiché, tous les interrupteurs éteints. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }) }));
vi.mock("@/app/(studio)/reglages/actions-site", () => ({ definirSiteGenerateurAction: async () => ({ ok: true }), definirSiteAutoAction: async () => ({ ok: true }) }));

const site = await import("@/services/site-videos");
const { SurLeSite } = await import("@/components/reglages/SurLeSite");
const { listerFormatsActifs } = await import("@/formats");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(preparerBase);

describe("S1.8 carte « Sur le site »", () => {
  it("une ligne par format actif, le conseil affiché, tous les interrupteurs éteints", async () => {
    const lignes = await site.lireReglagesSite();
    const html = renderToStaticMarkup(createElement(SurLeSite, { lignes }));
    // Un interrupteur du générateur et un d'envoi automatique par ligne.
    expect((html.match(/role="switch"/g) ?? []).length).toBe(listerFormatsActifs().length * 2);
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain("Conseillé");
    expect(html).toContain("Au cas par cas");
    for (const l of lignes) expect(html).toContain(l.nom);
  });

  it("le conseil « non » s'écrit « Déconseillé »", () => {
    const html = renderToStaticMarkup(createElement(SurLeSite, { lignes: [{ formatId: "x", nom: "Essai", conseil: "non", generateur: false, auto: false }] }));
    expect(html).toContain("Déconseillé");
  });

  it("l'envoi automatique est grisé tant que le générateur est éteint", () => {
    const html = renderToStaticMarkup(createElement(SurLeSite, { lignes: [{ formatId: "x", nom: "Essai", conseil: "oui", generateur: false, auto: false }] }));
    const interrupteurs = html.match(/<button[^>]*role="switch"[^>]*>/g) ?? [];
    expect(interrupteurs).toHaveLength(2);
    expect(interrupteurs[0]).not.toContain('disabled=""');
    expect(interrupteurs[1]).toContain('disabled=""');
  });

  it("aucune ligne pour un format masqué", async () => {
    const lignes = await site.lireReglagesSite();
    expect(lignes.some((l) => l.formatId === "image-video")).toBe(false);
    const html = renderToStaticMarkup(createElement(SurLeSite, { lignes }));
    expect(html).not.toContain("image-video");
  });

  it("la page des Réglages a sa section « Sur le site » dans la rubrique « Publication »", () => {
    const page = readFileSync("src/app/(studio)/reglages/page.tsx", "utf8");
    const debut = page.indexOf('<Rubrique id="publication">');
    const fin = page.indexOf('<Rubrique id="services">');
    expect(debut).toBeGreaterThan(-1);
    expect(fin).toBeGreaterThan(debut);
    const rubrique = page.slice(debut, fin);
    expect(rubrique).toContain('id="sur-le-site"');
    expect(rubrique.indexOf('id="sur-le-site"')).toBeGreaterThan(rubrique.indexOf('id="envoi-programme"'));
    expect(page.match(/id="sur-le-site"/g)).toHaveLength(1);
  });
});
