/**
 * Un seul chemin pour créer une vidéo (18/10) : la barre latérale n'a plus de raccourci de création ; tout passe par
 * « Nouvelle vidéo ». Les formats ouverts (essai) restent des lignes de « Mes vidéos », allumées sur leur écran de création.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { BarreLaterale } = await import("@/components/coquille/BarreLaterale");
const { formatActif } = await import("@/components/coquille/navigation");
const { OngletsMesVideos } = await import("@/components/videos/OngletsMesVideos");
const { CarteFormat } = await import("@/components/ui/CarteFormat");

const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("formatActif : la ligne d'un format reste allumée sur ses pages", () => {
  const iv = { id: "image-video", adresseCreation: "/image-video" };
  it("sur son écran de création et en dessous", () => {
    expect(formatActif("/image-video", iv)).toBe(true);
    expect(formatActif("/image-video/abc", iv)).toBe(true);
  });
  it("sur sa fiche /formats/<id>", () => {
    expect(formatActif("/formats/image-video", iv)).toBe(true);
  });
  it("pas ailleurs, ni sur un préfixe voisin", () => {
    expect(formatActif("/videos", iv)).toBe(false);
    expect(formatActif("/image-video-bis", iv)).toBe(false);
    expect(formatActif("/formats/avocat", iv)).toBe(false);
  });
  it("sans adresse de création : seulement la fiche", () => {
    expect(formatActif("/formats/avocat", { id: "avocat" })).toBe(true);
    expect(formatActif("/nouvelle/avocat", { id: "avocat" })).toBe(false);
  });
});

describe("BarreLaterale : aucun raccourci de création", () => {
  const icone = "film" as const;
  const formats = [
    { id: "avocat", nom: "Vidéo type avocat", icone, statut: "actif" as const, nbVideos: 1, adresseCreation: "/nouvelle/avocat" },
    { id: "tableau-anime", nom: "Tableau animé", icone, statut: "actif" as const, nbVideos: 0, adresseCreation: "/tableau/nouvelle" },
    { id: "cas-concret", nom: "Cas concret MD", icone, statut: "actif" as const, nbVideos: 0, adresseCreation: "/cas-concret" },
    { id: "facecam-animee", nom: "Vidéo face caméra animée", icone, statut: "actif" as const, nbVideos: 0, essai: true, adresseCreation: "/face-camera-animee" },
    { id: "image-video", nom: "Image → vidéo", icone, statut: "actif" as const, nbVideos: 2, essai: true, adresseCreation: "/image-video" },
  ];
  const html = renderToStaticMarkup(createElement(BarreLaterale, { formats, actionDeconnexion: async () => undefined }));

  it("aucun lien vers un écran de création de générateur", () => {
    for (const adresse of ["/tableau/nouvelle", "/cas-concret", "/image-video", "/face-camera-animee"]) expect(html).not.toContain(`href="${adresse}`);
  });
  it("les lignes de formats mènent à leur fiche /formats/<id>", () => {
    for (const f of formats) expect(html).toContain(`href="/formats/${f.id}"`);
  });
  it("Image → vidéo : pastille « Essai » et nombre de vidéos", () => {
    const lien = /<a[^>]*href="\/formats\/image-video"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    expect(lien).not.toBeNull();
    const t = texte(lien![1]!);
    expect(t).toContain("Essai");
    expect(t).toContain("2");
  });
  it("« Nouvelle vidéo » est là, mais pas « Image → vidéo » comme entrée du menu principal", () => {
    expect(html).toContain('href="/nouvelle"');
    expect(html).not.toMatch(/<a[^>]*href="\/image-video"/);
  });
});

describe("OngletsMesVideos : les formats ouverts ont leur onglet", () => {
  const html = renderToStaticMarkup(createElement(OngletsMesVideos, { actif: "toutes", compteParFormat: {}, nbToutes: 0, nbBrouillons: 0, nbArchivees: 0 }));
  it("Image → vidéo et Face caméra animée, sans vidéo", () => {
    expect(html).toContain('href="/formats/image-video"');
    expect(html).toContain('href="/formats/facecam-animee"');
  });
  it("un format masqué sans vidéo n'a pas d'onglet", () => {
    expect(html).not.toContain('href="/formats/selfie"');
  });
});

describe("CarteFormat : nom court", () => {
  it("Vidéo type avocat s'affiche « Type avocat »", () => {
    const format = { id: "avocat", nom: "Vidéo type avocat", accroche: "Une accroche", icone: "film" as const, statut: "actif" as const, durees: [30], ratios: ["9:16" as const], nbVideos: 0 };
    const html = renderToStaticMarkup(createElement(CarteFormat, { format, href: "/nouvelle/avocat" }));
    expect(texte(html)).toContain("Type avocat");
    expect(texte(html)).not.toContain("Vidéo type avocat");
  });
});
