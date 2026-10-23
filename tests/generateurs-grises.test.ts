/**
 * Générateurs grisés (décision de Will, 17/10) : un format dont `statut !== "actif"` n'est jamais cliquable (carte,
 * barre latérale), mais reste visible avec sa pastille « Bientôt ». « Mes vidéos » garde l'onglet d'un format masqué
 * qui a des vidéos (Image → vidéo). Les boutons de la fiche vidéo ne s'affichent que si l'onglet visé existe.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { CarteFormat } = await import("@/components/ui/CarteFormat");
const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");
const { OngletsMesVideos } = await import("@/components/videos/OngletsMesVideos");
const { BarreActionsVideo } = await import("@/components/publication/BarreActionsVideo");
const { FournisseurVideo } = await import("@/components/publication/ContexteVideo");
const { aOnglet } = await import("@/components/videos/fiche/aOnglet");
const { listerFormats, obtenirFormat } = await import("@/formats");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

const base = { accroche: "Une accroche", icone: "film" as const, durees: [30], ratios: ["9:16" as const] };
const actif = { ...base, id: "avocat", nom: "Avocat", statut: "actif" as const };
const bientot = { ...base, id: "podcast", nom: "Podcast", statut: "bientot" as const };
const masque = { ...base, id: "selfie", nom: "Selfie", statut: "masque" as const };

describe("CarteFormat : un format non actif n'est pas un lien", () => {
  it("actif : un lien vers la destination, pas de pastille", () => {
    const html = renderToStaticMarkup(createElement(CarteFormat, { format: actif, href: "/nouvelle/avocat" }));
    expect(html).toContain('href="/nouvelle/avocat"');
    expect(html).not.toContain("aria-disabled");
    expect(texte(html)).not.toContain("Bientôt");
  });

  for (const f of [bientot, masque]) {
    for (const compacte of [false, true]) {
      it(`${f.statut}${compacte ? " compacte" : ""} : pas de lien, aria-disabled, pastille « Bientôt »`, () => {
        const html = renderToStaticMarkup(createElement(CarteFormat, { format: f, compacte }));
        expect(html).not.toContain("<a ");
        expect(html).not.toContain("href=");
        expect(html).toContain('aria-disabled="true"');
        expect(html).toContain("cursor-not-allowed");
        expect(texte(html)).toContain("Bientôt");
        expect(texte(html)).toContain(f.nom);
      });
    }
  }
});

describe("BarreLaterale : formats sous « Mes vidéos »", () => {
  const formats = [
    { id: "avocat", nom: "Avocat", icone: "film" as const, statut: "actif" as const, nbVideos: 3 },
    { id: "podcast", nom: "Podcast", icone: "micro" as const, statut: "bientot" as const, nbVideos: 0 },
  ];
  const html = renderToStaticMarkup(createElement(BarreLaterale, { formats, actionDeconnexion: async () => undefined }));

  it("un format actif reste un lien", () => {
    expect(html).toContain('href="/formats/avocat"');
  });
  it("un format non actif : pas de lien, aria-disabled, pastille « Bientôt », nom visible", () => {
    expect(html).not.toContain('href="/formats/podcast"');
    expect(html).toMatch(/<span[^>]*aria-disabled="true"[^>]*>/);
    expect(texte(html)).toContain("Podcast");
    expect(texte(html)).toContain("Bientôt");
  });
});

describe("OngletsMesVideos : onglet d'un format masqué qui a des vidéos", () => {
  const rendre = (compteParFormat: Record<string, number>) =>
    renderToStaticMarkup(createElement(OngletsMesVideos, { actif: "toutes", compteParFormat, nbToutes: 1, nbBrouillons: 0, nbArchivees: 0 }));

  it("Image → vidéo (masqué) avec une vidéo : l'onglet est là", () => {
    const html = rendre({ "image-video": 1 });
    expect(html).toContain('href="/formats/image-video"');
  });
  it("Image → vidéo sans vidéo : l'onglet est là (ouvert dans la navigation, 18/10)", () => {
    expect(rendre({})).toContain('href="/formats/image-video"');
  });
  it("un format actif garde son onglet sans vidéo", () => {
    expect(rendre({})).toContain('href="/formats/avocat"');
  });
});

describe("Fiche vidéo : pas de bouton sans l'onglet qu'il vise", () => {
  const donnees = {
    videoId: "v1", titre: "T", dureeSec: 30, ratios: ["9:16"], ratiosFormat: ["9:16"], coutsFormats: {}, sorties: [], sousTitres: null,
    kit: null, partages: [], reseauxParDefaut: [], fabricationSimulee: false, textesSimules: false, verifiesAuto: {},
  } as never;
  const barre = (props: Record<string, unknown>) =>
    texte(renderToStaticMarkup(createElement(FournisseurVideo as never, { donnees }, createElement(BarreActionsVideo, props))));

  it("onglet Publier absent : pas de bouton Publier", () => {
    expect(barre({ avecOngletPublier: false })).not.toContain("Publier");
  });
  it("onglet Publier présent : le bouton est là", () => {
    expect(barre({ avecOngletPublier: true })).toContain("Publier");
  });
  it("aOnglet lit la liste des onglets de la fiche", () => {
    const onglets = [{ valeur: "sous-titres" }, { valeur: "script" }];
    expect(aOnglet(onglets, "sous-titres")).toBe(true);
    expect(aOnglet(onglets, "publier")).toBe(false);
  });
});

describe("Face caméra animée (vrai registre) : active, réservée à Will, ni grisée ni listée", () => {
  const fa = obtenirFormat("facecam-animee");
  const publics = listerFormats();

  it("statut actif et réservée à Will", () => {
    expect(fa.statut).toBe("actif");
    expect(fa.reserveAWill).toBe(true);
  });
  it("absente de la liste publique (donc de /nouvelle, actifs comme grisés)", () => {
    expect(publics.map((f) => f.id)).not.toContain("facecam-animee");
    expect(publics.filter((f) => f.statut !== "actif").map((f) => f.id)).not.toContain("facecam-animee");
  });
  it("absente de la barre latérale pour le public, et pas grisée", () => {
    const formats = publics.map((f) => ({ id: f.id, nom: f.nom, icone: f.icone, statut: f.statut, nbVideos: 0 }));
    const html = renderToStaticMarkup(createElement(BarreLaterale, { formats, actionDeconnexion: async () => undefined }));
    expect(html).not.toContain("/formats/facecam-animee");
    expect(texte(html)).not.toContain(fa.nom);
  });
  it("jamais rendue grisée : actif ⇒ carte lien, sans pastille", () => {
    const html = renderToStaticMarkup(createElement(CarteFormat, { format: { ...fa, statut: "actif" as const, durees: [30], ratios: fa.ratios }, href: "/nouvelle/facecam-animee" }));
    expect(html).not.toContain("aria-disabled");
    expect(texte(html)).not.toContain("Bientôt");
  });
  it("« Mes vidéos » : l'onglet est là, avec ou sans vidéo (format en essai, actif dans la navigation)", () => {
    const rendre = (compteParFormat: Record<string, number>) =>
      renderToStaticMarkup(createElement(OngletsMesVideos, { actif: "toutes", compteParFormat, nbToutes: 1, nbBrouillons: 0, nbArchivees: 0 }));
    expect(rendre({})).toContain('href="/formats/facecam-animee"');
    expect(rendre({ "facecam-animee": 1 })).toContain('href="/formats/facecam-animee"');
  });
});
