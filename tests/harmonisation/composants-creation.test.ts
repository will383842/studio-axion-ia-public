/** Harmonisation H0 : SuiviFabrication, RecentsGenerateur, SqueletteCreation (rendu seul, aucun fetch). */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/" }));

const { SuiviFabrication, progressionDeVue } = await import("@/components/creation/SuiviFabrication");
const { RecentsGenerateur } = await import("@/components/creation/RecentsGenerateur");
const { SqueletteCreation } = await import("@/components/creation/SqueletteCreation");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const etapes = [
  { cle: "voix", libelle: "Voix", etat: "faite" as const },
  { cle: "montage", libelle: "Montage", etat: "en-cours" as const },
  { cle: "fin", libelle: "Mise en ligne", etat: "a-venir" as const },
];

describe("SuiviFabrication", () => {
  it("en cours : étapes lisibles, progression selon les étapes faites, lien", () => {
    const vue = { etat: "en-cours" as const, etapes, resteSec: 120, lien: { href: "/videos/v1", libelle: "Voir la vidéo" } };
    expect(progressionDeVue(vue)).toBe(33);
    const html = renderToStaticMarkup(createElement(SuiviFabrication, { vue }));
    const t = texte(html);
    expect(t).toContain("Voix");
    expect(t).toContain("Montage");
    expect(t).toContain("encore 2 min");
    expect(html).toContain('href="/videos/v1"');
  });

  it("prête : 100 % et toutes les étapes faites", () => {
    const vue = { etat: "prete" as const, etapes };
    expect(progressionDeVue(vue)).toBe(100);
    expect(texte(renderToStaticMarkup(createElement(SuiviFabrication, { vue })))).not.toContain("encore");
  });

  it("arrêtée : le message lisible est dit", () => {
    const vue = { etat: "arretee" as const, etapes: [{ cle: "voix", libelle: "Voix", etat: "arretee" as const }], message: "La voix n'a pas abouti." };
    expect(texte(renderToStaticMarkup(createElement(SuiviFabrication, { vue })))).toContain("La voix n'a pas abouti.");
  });

  it("à relire : étape marquée « À relire », pas d'échec", () => {
    const vue = { etat: "a-relire" as const, etapes: [{ cle: "script", libelle: "Script", etat: "arretee" as const }] };
    const t = texte(renderToStaticMarkup(createElement(SuiviFabrication, { vue })));
    expect(t).toContain("À relire");
    expect(t).not.toContain("n'a pas abouti");
  });

  it("aucun champ de montant dans la vue ni dans le composant", () => {
    const src = readFileSync("src/components/creation/SuiviFabrication.tsx", "utf8");
    expect(src).not.toMatch(/Montant|montant|prix|centimes|coutReel/);
  });

  it("actions passées en propriété", () => {
    const vue = { etat: "en-cours" as const, etapes };
    expect(texte(renderToStaticMarkup(createElement(SuiviFabrication, { vue, actions: createElement("button", null, "Arrêter") })))).toContain("Arrêter");
  });
});

describe("RecentsGenerateur", () => {
  const el = [
    { id: "a", href: "/videos/a", titre: "Ma vidéo", etat: "prête", date: "2026-10-18T14:05:00", detail: "payé 1,20 €" },
    { id: "b", href: "/videos/b", titre: "Autre", etat: "écriture en cours" },
  ];

  it("liste : titre par défaut, état, date, détail, aria-current sur le courant", () => {
    const html = renderToStaticMarkup(createElement(RecentsGenerateur, { elements: el, courant: "b" }));
    const t = texte(html);
    expect(t).toContain("Vos vidéos récentes");
    expect(t).toContain("prête · 18 oct.");
    expect(t).toContain("payé 1,20 €");
    expect(html).toContain('href="/videos/a"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("titre personnalisé et groupes", () => {
    const html = renderToStaticMarkup(createElement(RecentsGenerateur, { groupes: [{ titre: "Vos lots", elements: [el[0]] }, { titre: "Vos vidéos", elements: [el[1]] }] }));
    const t = texte(html);
    expect(t.indexOf("Vos lots")).toBeGreaterThan(-1);
    expect(t.indexOf("Vos lots")).toBeLessThan(t.indexOf("Vos vidéos"));
  });

  it("vide : EtatVide compact ; null : rien", () => {
    expect(texte(renderToStaticMarkup(createElement(RecentsGenerateur, { elements: [], vide: { titre: "Aucune vidéo pour le moment" } })))).toContain("Aucune vidéo pour le moment");
    expect(renderToStaticMarkup(createElement(RecentsGenerateur, { elements: [], vide: null }))).toBe("");
  });
});

describe("SqueletteCreation", () => {
  it("annonce le chargement, sans texte technique", () => {
    const html = renderToStaticMarkup(createElement(SqueletteCreation, { avecEtapes: true }));
    expect(html).toContain('aria-label="Chargement"');
    expect(html).toContain('role="status"');
  });
});
