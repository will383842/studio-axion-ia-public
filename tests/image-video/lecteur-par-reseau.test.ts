/**
 * Image → vidéo, « Vos vidéos » (lot I, décision de Williams du 08/11) : un seul lecteur, une puce par réseau, les
 * actions du réseau choisi, le texte replié. Vrais rendus (renderToStaticMarkup) ; rien d'appelé, rien de payé.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { VosVideos } = await import("@/components/formats/image-video/VosVideos");
const { pucesDe, adresseTelechargement, telechargerAvecSecours } = await import("@/components/formats/image-video/LecteurParReseau");
const { titreCourt, construireVueImageVideo } = await import("@/services/image-video-ecran");

const carte = (reseau: string, nom: string, extra: Record<string, unknown> = {}) => ({
  reseau,
  nom,
  ton: "vert" as const,
  phrase: "Prête à publier.",
  duree: "30 s",
  url: `https://exemple/${reseau}.mp4`,
  texte: `Texte ${nom}`,
  ...extra,
});
const VIDEOS = [
  carte("youtube-shorts", "YouTube Shorts"),
  carte("linkedin", "LinkedIn", { format: "4:5" }),
  carte("instagram", "Instagram"),
  carte("facebook", "Facebook", { urlFil: "https://exemple/facebook-fil.mp4", fil: { fichierCle: "f", duree: "28 s", texte: "Texte fil" } }),
];
const rendre = (p: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(VosVideos, { videoId: "v-1", videos: VIDEOS, prete: true, etape: "a_relire", ...p } as never));
const texte = (h: string) => h.replace(/<[^>]*>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

describe("titreCourt (pur)", () => {
  it("40 caractères au plus, coupe sur un mot, « … » à la fin", () => {
    const t = titreCourt("Un cabinet comptable relance ses clients en retard et gagne du temps chaque semaine");
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t.endsWith("…")).toBe(true);
    expect(t).toBe("Un cabinet comptable relance ses…");
    expect(t.slice(0, -1)).not.toMatch(/\s$/);
  });
  it("un titre court reste tel quel", () => {
    expect(titreCourt("Mon titre")).toBe("Mon titre");
    expect(titreCourt("")).toBe("Image → vidéo");
  });
});

describe("VosVideos : un seul lecteur", () => {
  const html = rendre();
  it("un seul <video> pour 4 réseaux, une puce par réseau dans un tablist, plus « Facebook · fil »", () => {
    expect(html.match(/<video/g)).toHaveLength(1);
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    const t = texte(html);
    for (const n of ["YouTube Shorts", "LinkedIn", "Instagram", "Facebook", "Facebook · fil"]) expect(t).toContain(n);
  });
  it("sans fil, pas de puce « fil »", () => {
    expect(texte(rendre({ videos: VIDEOS.slice(0, 3) }))).not.toContain("Facebook · fil");
  });
  it("le téléchargement passe par la route, avec le réseau choisi (le premier)", () => {
    expect(html).toContain("/api/telechargements/video?video=v-1&amp;reseau=youtube-shorts");
    expect(html).not.toContain("fil=1");
    expect(html).not.toMatch(/<a [^>]*download/);
  });
  it("Valider à l'étape à relire ; plus de bouton à l'étape validée", () => {
    expect(texte(html)).toContain("Valider");
    expect(texte(rendre({ etape: "validee" }))).not.toMatch(/\bValider\b/);
    expect(texte(rendre({ prete: false }))).not.toMatch(/\bValider\b/);
  });
  it("Copier le texte du réseau choisi", () => {
    expect(texte(html)).toContain("Copier le texte");
  });
});

describe("VosVideos : verdict et texte replié", () => {
  it("verdict caché s'il est bon, montré en remarque s'il signale un souci", () => {
    expect(texte(rendre({ verdict: { ok: true, phrase: "Contrôle : bon.", mentions: [] } }))).not.toContain("Contrôle : bon.");
    const t = texte(rendre({ verdict: { ok: false, phrase: "Contrôle : à revoir.", mentions: ["Un mot"] } }));
    expect(t).toContain("Contrôle : à revoir.");
    expect(t).toContain("Un mot");
  });
  it("le texte d'origine et ce que le studio a adapté sont dans des <details> fermés", () => {
    const h = rendre({ texteOrigine: "Un cabinet comptable relance ses clients en retard", adapte: ["Une durée raccourcie"] });
    expect(h.match(/<details/g)!.length).toBeGreaterThanOrEqual(2);
    expect(h).not.toMatch(/<details[^>]* open/);
    expect(h).toMatch(/<summary[^>]*>[^<]*Le texte d&#x27;origine/);
    expect(h).toMatch(/<summary[^>]*>[^<]*Ce que le studio a adapté/);
    expect(h).toContain("Une durée raccourcie");
  });
  it("pas de texte d'origine ni d'adaptation : pas de <details> pour eux", () => {
    const t = texte(rendre());
    expect(t).not.toContain("Le texte d'origine");
    expect(t).not.toContain("Ce que le studio a adapté");
  });
});

describe("la vue", () => {
  it("porte l'étape éditoriale, l'état « prête » et le texte d'origine", () => {
    const v = construireVueImageVideo(
      { id: "v-1", titre: "T", etapeEditoriale: "validee", statut: "prete", entrees: { imageVideo: { texte: "Mon texte" } } },
      { id: "t-1", statut: "termine", parametres: { imageVideo: { version: "fabrication-iv/1", etape: "prete", caisse: { plafondCentimes: 0, reservations: [] }, livraison: [{ reseau: "facebook", version: "longue", dureeSec: 30, fichierCle: "f.mp4" }] } } } as never,
      null,
    );
    expect(v.etapeEditoriale).toBe("validee");
    expect(v.prete).toBe(true);
    expect(v.texteOrigine).toBe("Mon texte");
  });
});

describe("titre YouTube, adresses, puces, secours du téléchargement", () => {
  it("le titre du réseau est montré avec « Copier le titre » (publication par téléchargement)", () => {
    const h = rendre({ videos: [carte("youtube-shorts", "YouTube Shorts", { titre: "Mon titre YouTube" })] });
    expect(texte(h)).toContain("Mon titre YouTube");
    expect(texte(h)).toContain("Copier le titre");
    expect(texte(rendre())).not.toContain("Copier le titre");
  });
  it("pucesDe : une puce par réseau, « fil » juste après Facebook, avec l'adresse du fil", () => {
    const p = pucesDe(VIDEOS as never);
    expect(p.map((x) => x.cle)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook", "facebook:fil"]);
    expect(p[4]).toMatchObject({ fil: true, nom: "Facebook · fil", duree: "28 s", url: "https://exemple/facebook-fil.mp4" });
    expect(p[3]!.fil).toBe(false);
    expect(pucesDe([])).toEqual([]);
  });
  it("l'adresse du fil porte &fil=1, pas celle du Reel", () => {
    expect(adresseTelechargement("v-1", "facebook", true)).toBe("/api/telechargements/video?video=v-1&reseau=facebook&fil=1");
    expect(adresseTelechargement("v-1", "facebook", false)).toBe("/api/telechargements/video?video=v-1&reseau=facebook");
  });
  it("route sans fichier (404) : on garde l'adresse directe de la vidéo ; route bonne : la route", async () => {
    const aller = vi.fn();
    await telechargerAvecSecours("/r", "https://exemple/a.mp4", { sonder: async () => 404, aller });
    expect(aller).toHaveBeenLastCalledWith("https://exemple/a.mp4");
    await telechargerAvecSecours("/r", "https://exemple/a.mp4", { sonder: async () => 0, aller });
    expect(aller).toHaveBeenLastCalledWith("/r");
    await telechargerAvecSecours("/r", "https://exemple/a.mp4", { sonder: async () => { throw new Error("x"); }, aller });
    expect(aller).toHaveBeenLastCalledWith("/r");
  });
});
