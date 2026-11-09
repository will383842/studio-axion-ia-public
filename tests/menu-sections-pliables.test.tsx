/**
 * Note : jsdom n'est pas installé (et on n'en ajoute pas) : le rendu est serveur seulement (renderToStaticMarkup),
 * donc le clic et le localStorage ne sont pas testés ; on teste les règles pures exportées.
 *
 * Menu : chaque section se plie et se déplie (09/11, Williams). Rendu statique : tout ouvert par défaut ;
 * la règle d'ouverture est testée à part (section courante toujours ouverte, barre en icônes sans repli).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, usePathname: () => "/carrousels" }));

const { BarreLaterale, sectionOuverte, sectionContientPageCourante } = await import("@/components/coquille/BarreLaterale");

const html = renderToStaticMarkup(createElement(BarreLaterale, { formats: [], actionDeconnexion: async () => undefined }));
const boutons = html.match(/<button[^>]*aria-expanded[^>]*>/g) ?? [];

describe("titres de section en boutons", () => {
  it("un bouton par section titrée, avec aria-expanded, aria-controls et libellé français", () => {
    expect(boutons.length).toBe(3);
    for (const b of boutons) {
      expect(b).toContain('aria-expanded="true"');
      expect(b).toMatch(/aria-controls="[^"]+"/);
    }
    for (const t of ["Contenus", "Publier et mesurer", "Ressources"]) expect(html).toContain(`aria-label="Replier la section ${t}"`);
  });

  it("chaque bouton pointe une liste existante, visible par défaut", () => {
    for (const b of boutons) {
      const id = b.match(/aria-controls="([^"]+)"/)![1];
      const ul = html.match(new RegExp(`<ul id="${id.replace(/[:]/g, "\\$&")}"[^>]*>`))?.[0] ?? "";
      expect(ul).not.toBe("");
      expect(ul).not.toContain("hidden");
    }
  });

  it("la tête du menu (Accueil, Nouvelle vidéo) n'a pas de bouton", () => {
    const tete = html.slice(html.indexOf("<nav"), html.indexOf("aria-expanded"));
    expect(tete).toContain('href="/nouvelle"');
    expect(tete.replace(/<button[^>]*$/, "")).not.toContain("<button");
  });
});

describe("règle d'ouverture", () => {
  const base = { memoriseeRepliee: false, contientPageCourante: false, barreRepliee: false };
  it("ouverte par défaut, repliée si mémorisée", () => {
    expect(sectionOuverte(base)).toBe(true);
    expect(sectionOuverte({ ...base, memoriseeRepliee: true })).toBe(false);
  });
  it("la section de la page courante reste ouverte même mémorisée repliée", () => {
    expect(sectionOuverte({ ...base, memoriseeRepliee: true, contientPageCourante: true })).toBe(true);
  });
  it("barre en icônes : aucune section repliée", () => {
    expect(sectionOuverte({ ...base, memoriseeRepliee: true, barreRepliee: true })).toBe(true);
  });
});

describe("section contenant la page courante", () => {
  const entrees = [{ href: "/videos", libelle: "Mes vidéos", icone: "film" }] as never[];
  const formats = [{ id: "cas-concret", statut: "actif", adresseCreation: "/cas-concret" }] as never[];
  it("une adresse de création de format (hors /videos et /formats) compte pour « Mes vidéos »", () => {
    expect(sectionContientPageCourante(entrees, "/cas-concret", formats)).toBe(true);
    expect(sectionContientPageCourante(entrees, "/cas-concret/nouvelle", formats)).toBe(true);
  });
  it("une page sans rapport ne la compte pas", () => {
    expect(sectionContientPageCourante(entrees, "/carrousels", formats)).toBe(false);
  });
});

describe("section de la page courante : pas de flèche", () => {
  it("/carrousels est dans « Contenus » : son titre n'est pas cliquable, sans flèche", () => {
    const b = boutons.find((x) => x.includes("section Contenus"))!;
    expect(b).toContain('aria-disabled="true"');
    const i = html.indexOf(b);
    expect(html.slice(i, html.indexOf("</button>", i))).not.toContain("<svg");
  });
  it("les autres sections gardent flèche et clic", () => {
    const b = boutons.find((x) => x.includes("section Ressources"))!;
    expect(b).not.toContain("aria-disabled");
    const i = html.indexOf(b);
    expect(html.slice(i, html.indexOf("</button>", i))).toContain("<svg");
  });
});
