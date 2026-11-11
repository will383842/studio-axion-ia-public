/**
 * « Nouvelle vidéo » (08/11, Williams : « ça évite d'avoir du bruit pour rien ») : seuls les formats qui ont un générateur
 * apparaissent ; plus de rangée « Bientôt », plus de carte grisée.
 * Barre latérale : sur une sous-page, la bonne entrée s'allume, et une seule ligne porte aria-current.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

let chemin = "/nouvelle";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => chemin }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({ id: "will" }) }));
vi.mock("@/services/modeles", () => ({ listerModeles: async () => [] }));
const base = { accroche: "Une accroche", icone: "film" as const, durees: [30], ratios: ["9:16" as const], nbVideos: 0 };
vi.mock("@/services/formats", () => ({
  listerFormatsAvecCompteurs: async () => [
    { ...base, id: "avocat", nom: "Vidéo type avocat", statut: "actif", adresseCreation: "/nouvelle/avocat" },
    { ...base, id: "podcast", nom: "Podcast type interview", statut: "bientot" },
    { ...base, id: "selfie", nom: "Vidéo selfie", statut: "masque" },
  ],
}));

const { default: PageNouvelle } = await import("@/app/(studio)/nouvelle/page");
const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("Nouvelle vidéo : pas de format sans générateur", () => {
  it("le format actif est proposé ; les formats « bientôt » et masqués n'apparaissent pas", async () => {
    const html = renderToStaticMarkup(await PageNouvelle());
    expect(html).toContain('href="/nouvelle/avocat"');
    expect(texte(html)).not.toContain("Podcast");
    expect(texte(html)).not.toContain("selfie");
    expect(texte(html)).not.toContain("Bientôt");
    expect(html).not.toContain('aria-disabled="true"');
  });
});

describe("barre latérale : état actif sur les sous-pages", () => {
  const formats = [{ id: "avocat", nom: "Vidéo type avocat", icone: "film" as const, statut: "actif" as const, nbVideos: 2, adresseCreation: "/nouvelle/avocat" }];
  const rendre = (c: string) => {
    chemin = c;
    return renderToStaticMarkup(createElement(BarreLaterale, { formats, actionDeconnexion: async () => undefined }));
  };
  const balise = (html: string, href: string) => html.match(new RegExp(`<a[^>]*href="${href}"[^>]*>`))?.[0] ?? "";

  it("/ecrire/atelier allume « Écrire »", () => {
    const html = rendre("/ecrire/atelier");
    expect(balise(html, "/ecrire")).toContain('aria-current="page"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("/formats/avocat et /cas-concret : « Mes vidéos » reste allumé (une seule annonce), plus de ligne de format", () => {
    for (const c of ["/formats/avocat", "/cas-concret"]) {
      const html = rendre(c);
      expect(html).not.toContain('href="/formats/avocat"');
      expect(balise(html, "/videos")).toContain('aria-current="page"');
      expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    }
  });

  it("/videos : « Mes vidéos » porte aria-current", () => {
    const html = rendre("/videos");
    expect(balise(html, "/videos")).toContain('aria-current="page"');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
