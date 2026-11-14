/**
 * CAL-14A : le média du tiroir. Pages signées d'un visuel (carrousel, infographie), adresses douteuses écartées, panne du dépôt
 * sans casse, vidéo qui garde son lecteur et son poster, lien expiré dit en clair.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const obtenir = vi.fn();
const urlLecture = vi.fn(async (cle: string) => `https://stockage.test/${cle}?sig=1`);
vi.mock("@/services/_commun", () => ({
  depots: () => ({ visuels: { obtenir } }),
  fournisseur: async () => ({ urlLecture, urlLectureDuree: undefined }),
}));

const { entreesAvecMedias } = await import("@/app/(studio)/calendrier/charger-medias");
const { entreeDepuisPublication } = await import("@/components/calendrier/apercu-reseau");
const { ApercuPublication } = await import("@/components/calendrier/ApercuPublication");

const pub = (id: string, extra: Record<string, unknown> = {}) => ({ id, reseau: "linkedin", statut: "programmee", via: "manuel", date: "2030-01-02T09:00:00.000Z", texte: "Un texte", ...extra });
const pages = (n: number) => Array.from({ length: n }, (_, i) => ({ index: i, x1Cle: `v/p${i + 1}.png`, x2Cle: `v/p${i + 1}@2x.png` }));
const afficher = (e: Awaited<ReturnType<typeof entreesAvecMedias>>[number]) =>
  renderToStaticMarkup(<ApercuPublication entree={e} aujourdhui="2030-01-01" onPrecedente={() => {}} onSuivante={() => {}} onFermer={() => {}} onChangerDate={() => {}} />);

beforeEach(() => {
  obtenir.mockReset();
  urlLecture.mockClear();
});

describe("CAL-14A — média du tiroir", () => {
  it("visuel à 3 pages : carrousel, pages signées, « Page 1 sur 3 »", async () => {
    obtenir.mockResolvedValue({ famille: "carrousel", rendu: { pages: pages(3) } });
    const [e] = await entreesAvecMedias([pub("p1", { visuelId: "vis_1" })]);
    expect(e.type).toBe("carrousel");
    expect(e.media?.pages).toHaveLength(3);
    const html = afficher(e);
    expect(html).toContain("Page 1 sur 3");
    expect(html).toContain("https://stockage.test/v/p1.png");
  });

  it("infographie : la page 1 est l'image, bouton « Agrandir »", async () => {
    obtenir.mockResolvedValue({ famille: "infographie", rendu: { pages: pages(1) } });
    const [e] = await entreesAvecMedias([pub("p1", { visuelId: "vis_1" })]);
    expect(e.type).toBe("infographie");
    expect(e.media?.url).toBe("https://stockage.test/v/p1.png?sig=1");
    expect(afficher(e)).toContain("Agrandir");
  });

  it("visuel introuvable : « Les pages ne sont pas encore prêtes »", async () => {
    obtenir.mockResolvedValue(undefined);
    const [e] = await entreesAvecMedias([pub("p1", { visuelId: "vis_x" })]);
    expect(afficher(e)).toContain("Les pages ne sont pas encore prêtes");
  });

  it("adresse javascript: écartée", async () => {
    obtenir.mockResolvedValue({ famille: "carrousel", rendu: { pages: pages(2) } });
    urlLecture.mockResolvedValueOnce("javascript:alert(1)").mockResolvedValueOnce("//autre.test/x.png");
    const [e] = await entreesAvecMedias([pub("p1", { visuelId: "vis_1" })]);
    expect(e.media?.pages).toEqual([]);
    expect(afficher(e)).not.toContain("javascript:");
  });

  it("erreur du dépôt : les entrées sont rendues sans média, une par une", async () => {
    obtenir.mockRejectedValueOnce(new Error("panne")).mockResolvedValueOnce({ famille: "carrousel", rendu: { pages: pages(2) } });
    const a = pub("p1", { visuelId: "vis_1" });
    const b = pub("p2", { visuelId: "vis_2" });
    const sortie = await entreesAvecMedias([a, b]);
    expect(sortie[0]).toEqual(entreeDepuisPublication(a));
    expect(sortie[1].media?.pages).toHaveLength(2);
  });

  it("un même visuel n'est chargé qu'une fois, et 20 pages au plus sont signées", async () => {
    obtenir.mockResolvedValue({ famille: "carrousel", rendu: { pages: pages(30) } });
    const sortie = await entreesAvecMedias([pub("p1", { visuelId: "vis_1" }), pub("p2", { visuelId: "vis_1", reseau: "facebook" })]);
    expect(obtenir).toHaveBeenCalledTimes(1);
    expect(sortie[0].media?.pages).toHaveLength(20);
    expect(urlLecture).toHaveBeenCalledTimes(20);
  });

  it("vidéo : le lecteur et le poster sont gardés", async () => {
    const e = entreeDepuisPublication(pub("p1", { videoId: "vid_1", video: { titre: "T", vignette: "https://x.test/poster.jpg", video: "https://x.test/v.mp4" } }));
    const [sortie] = await entreesAvecMedias([pub("p1", { videoId: "vid_1", video: { titre: "T", vignette: "https://x.test/poster.jpg", video: "https://x.test/v.mp4" } })]);
    expect(sortie).toEqual(e);
    const html = afficher(sortie);
    expect(html).toContain("<video");
    expect(html).toContain('poster="https://x.test/poster.jpg"');
    expect(obtenir).not.toHaveBeenCalled();
  });

  it("le chargeur reste réservé au serveur", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/app/(studio)/calendrier/charger-medias.ts", "utf8");
    expect(src).toContain('import "server-only"');
    expect(src).not.toMatch(/["']use server["']/);
  });
});

describe("CAL-14A — ordre des entrées", () => {
  it("les visuels se chargent en parallèle mais la sortie garde l'ordre de la semaine", async () => {
    obtenir.mockImplementation(async (id: string) => {
      await new Promise((r) => setTimeout(r, id === "vis_1" ? 20 : 0));
      return { famille: "carrousel", rendu: { pages: pages(id === "vis_1" ? 1 : 2) } };
    });
    const sortie = await entreesAvecMedias([pub("p1", { visuelId: "vis_1" }), pub("p2", { visuelId: "vis_2" }), pub("p3", { videoId: "vid_1" })]);
    expect(sortie.map((e) => e.cle)).toEqual(["p1", "p2", "p3"].map((id) => entreeDepuisPublication(pub(id)).cle));
    expect(sortie[0].media?.pages).toHaveLength(1);
    expect(sortie[1].media?.pages).toHaveLength(2);
  });
});
