/**
 * LOT D'IMAGES · L8 — dépôt multiple (plan § e.1) : 1 image = l'écran actuel ; ≥ 2 images = grille + prix total ; une
 * image refusée bloque le bouton ; au-delà de LOT_MAX_IV, les suivantes ne sont pas gardées. Rendu statique (patron
 * `interface.test.ts`), aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const vue = await import("@/components/formats/image-video/vue");
const { Depot } = await import("@/components/formats/image-video/Depot");
const { DepotLot } = await import("@/components/formats/image-video/DepotLot");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const MONTANTS = { 1: 120, 2: 180, 3: 240, 4: 300 };
const item = (n: number, plus: Record<string, unknown> = {}) => ({ cle: `i${n}`, url: `blob:test/${n}`, nom: `image-${n}.png`, largeur: 1080, hauteur: 1350, fichierId: `f${n}`, ...plus });
const rendre = (items: ReturnType<typeof item>[], plus: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(DepotLot, { items, montantParVideoCentimes: 360, reseaux: ["linkedin"], offre: "image", onReseaux: () => undefined, onOffre: () => undefined, onRetirer: () => undefined, onFabriquer: async () => undefined, ...plus } as never));

describe("1 image : l'écran actuel", () => {
  it("la zone accepte plusieurs images mais l'écran vide garde son texte et son bouton à une vidéo", () => {
    const html = texte(renderToStaticMarkup(createElement(Depot, { montants: MONTANTS })));
    expect(html).toContain("Déposez une ou plusieurs images");
    expect(html).toContain("800 px de côté au moins");
    expect(html).toMatch(/Fabriquer la vidéo \(au plus 3,00\s?€\)/);
    expect(html).not.toContain("Fabriquer les");
  });
});

describe("3 images : la grille et le total", () => {
  const html = rendre([item(1), item(2), item(3)]);
  const t = texte(html);
  it("une vignette par image, son nom, « prête », « Retirer »", () => {
    expect((html.match(/<img /g) ?? []).length).toBe(3);
    for (const n of [1, 2, 3]) expect(t).toContain(`image-${n}.png`);
    expect((t.match(/prête/g) ?? []).length).toBe(3);
    expect((t.match(/Retirer/g) ?? []).length).toBe(3);
  });
  it("le bouton dit le nombre de vidéos et le prix total « au plus » ; une phrase dit qu'aucun arrêt n'a lieu", () => {
    expect(t).toMatch(/Fabriquer les 3 vidéos · au plus 10,80\s?€/);
    expect(t).toContain("Au plus ce prix pour les 3 vidéos. Aucun arrêt : une vidéo douteuse est mise de côté sans payer sa voix.");
    const bouton = /<button[^>]*>(?:(?!<\/button>)[\s\S])*Fabriquer les 3 vidéos/.exec(html)?.[0] ?? "";
    expect(bouton).not.toBe("");
    expect(bouton).not.toContain(`disabled=""`);
  });
  it("les réseaux et l'offre sont communs à tout le lot", () => {
    for (const r of ["YouTube Shorts", "LinkedIn", "Facebook"]) expect(t).toContain(r);
    expect(t).toContain("Selon l'image");
  });
});

describe("une image refusée bloque le bouton", () => {
  it("la phrase du refus est sous la vignette et le bouton est désactivé", () => {
    const html = rendre([item(1), item(2, { refus: "Image trop petite (600 × 1200 px). Il faut 800 px de côté au moins.", fichierId: undefined })]);
    expect(texte(html)).toContain("Image trop petite (600 × 1200 px).");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Fabriquer les 2 vidéos/);
  });
  it("une image encore en envoi bloque aussi le bouton et montre son avancement", () => {
    const html = rendre([item(1), item(2, { fichierId: undefined, envoi: 42 })]);
    expect(texte(html)).toContain("envoi 42 %");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Fabriquer les 2 vidéos/);
  });
});

describe("au-delà de LOT_MAX_IV", () => {
  it("11 images : 10 gardées, la phrase est dite", () => {
    const onze = Array.from({ length: 11 }, (_, i) => i);
    const r = vue.garderLeLot(onze);
    expect(r.gardes).toEqual(onze.slice(0, 10));
    expect(r.phrase).toBe("10 images au plus par lot.");
    expect(vue.garderLeLot([1, 2, 3])).toEqual({ gardes: [1, 2, 3] });
  });
  it("le composant montre la phrase quand des images ont été écartées", () => {
    const dix = Array.from({ length: 10 }, (_, i) => item(i + 1));
    expect(texte(rendre(dix, { depasse: true }))).toContain("10 images au plus par lot.");
    expect(texte(rendre(dix))).not.toContain("10 images au plus par lot.");
  });
});
