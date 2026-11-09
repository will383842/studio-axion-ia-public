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
    for (const t of ["Publier et mesurer", "Ressources"]) expect(html).toContain(`aria-label="Replier la section ${t}"`);
    expect(html).toContain('aria-label="Section Contenus, page en cours"');
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
    const b = boutons.find((x) => x.includes("Section Contenus"))!;
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

/** Gabarit compact aligné sur le CRM Pro (09/11, Williams : « le menu latéral est plus gros que celui du CRM Pro »). */
describe("barre latérale compacte (bureau)", () => {
  const nav = html.slice(html.indexOf("<nav"));
  it("liens text-sm font-medium, lignes min-h-9, gap-2, rayon rounded-lg", () => {
    expect(nav).toContain("min-h-9 items-center gap-2 rounded-lg text-sm font-medium");
    expect(nav).not.toContain("text-[15px]");
    expect(nav).not.toContain("min-h-11 items-center gap-3");
  });
  it("le pied (Déconnexion) suit le même gabarit", () => {
    expect(html).toMatch(/flex min-h-9 w-full items-center gap-2 rounded-lg text-sm font-medium[^"]*"[^>]*>(?:<svg|<span)[\s\S]*?Me déconnecter/);
  });
});

describe("finitions (relecture de #265)", () => {
  it("la section courante annonce « page en cours » et non « Replier »", () => {
    const b = boutons.find((x) => x.includes("Contenus"))!;
    expect(b).toContain('aria-label="Section Contenus, page en cours"');
    expect(b).not.toContain("Replier la section Contenus");
  });
  it("l'entrée active est en gras (font-semibold), les autres non", () => {
    const actif = html.match(/<a[^>]*aria-current="page"[^>]*>/)?.[0] ?? "";
    expect(actif).toContain("font-semibold");
    const autres = (html.match(/<a[^>]*>/g) ?? []).filter((a) => !a.includes('aria-current="page"') && !a.includes("bg-orange"));
    expect(autres.length).toBeGreaterThan(0);
    for (const a of autres) expect(a).not.toContain("font-semibold");
  });
});
