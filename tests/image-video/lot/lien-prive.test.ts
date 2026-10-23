/**
 * LOT D'IMAGES · L10 — « Lien privé » sur Image → vidéo (« Vos vidéos ») et Cas concret (« Vos fichiers »), plan § f.
 * Le bouton existe dans les deux ; un lien se crée sur une vidéo Image → vidéo prête (sa version choisie, sa sortie 9:16) ;
 * la feuille « Partager » de la fiche vidéo rend la même chose qu'avant (extraite dans `PartagerVideo`). Aucun réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Video } from "@/domaine/types";
import { mockHeaders } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video/v1" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { VosVideos } = await import("@/components/formats/image-video/VosVideos");
const { VosFichiers } = await import("@/components/formats/cas-concret/fiche-video/VosFichiers");
const { BoutonLienPrive } = await import("@/components/partage/BoutonLienPrive");
const { PartagerVideo } = await import("@/components/partage/PartagerVideo");
const { FeuillePartager } = await import("@/components/partage/FeuillePartager");
const { FournisseurVideo } = await import("@/components/publication/ContexteVideo");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const partages = await import("@/services/partages");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const LIEN = { videoId: "v1", titre: "Chatbot 24h/24", partages: [] };
const CARTE = { reseau: "tiktok", nom: "TikTok", ton: "vert", phrase: "Prête.", url: "https://stockage.test/a.mp4" } as never;

describe("le bouton « Lien privé »", () => {
  it("est dans « Vos vidéos » (Image → vidéo) en tête de section, quand le lien est fourni", () => {
    const html = renderToStaticMarkup(createElement(VosVideos, { videos: [CARTE], lienPrive: LIEN }));
    expect(texte(html)).toContain("Lien privé");
    expect(html.indexOf("Lien privé")).toBeLessThan(html.indexOf("TikTok"));
  });

  it("n'y est pas sans le lien fourni (écran inchangé)", () => {
    expect(texte(renderToStaticMarkup(createElement(VosVideos, { videos: [CARTE] })))).not.toContain("Lien privé");
  });

  it("est dans « Vos fichiers » (Cas concret) en tête de section", () => {
    const vue = { essai: false, fichiers: [{ reseau: "tiktok", nom: "TikTok", dureeSec: 50, dimensions: "1080 × 1920" }], cout: "1,00 €" } as never;
    const html = renderToStaticMarkup(createElement(VosFichiers, { vue, lienPrive: LIEN }));
    expect(texte(html)).toContain("Lien privé");
    expect(html.indexOf("Lien privé")).toBeLessThan(html.indexOf("TikTok"));
    expect(texte(renderToStaticMarkup(createElement(VosFichiers, { vue })))).not.toContain("Lien privé");
  });

  it("BoutonLienPrive est un bouton « Lien privé » qui garde sa feuille fermée au départ", () => {
    const html = renderToStaticMarkup(createElement(BoutonLienPrive, LIEN));
    expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Lien privé/);
    expect(texte(html)).not.toContain("Créer et copier le lien");
  });
});

describe("la feuille « Partager » extraite", () => {
  const donnees = { videoId: "v1", titre: "Chatbot 24h/24", dureeSec: 50, ratios: ["9:16"], ratiosFormat: ["9:16"], coutsFormats: {}, sorties: [], sousTitres: null, kit: null, partages: [], reseauxParDefaut: [], fabricationSimulee: false, textesSimules: false, verifiesAuto: {} } as never;

  it("le contenu de la feuille est dans PartagerVideo, tel qu'il était (textes et gestes)", () => {
    // La feuille est un tiroir (portail) : le rendu statique ne montre rien ; on vérifie donc le contenu déplacé.
    const source = readFileSync(join(process.cwd(), "src/components/partage/PartagerVideo.tsx"), "utf8");
    for (const t of ["Lien privé", "Créer et copier le lien", "Autoriser le téléchargement", "Liens actifs", "Anciens liens", "Révoquer", "Couper ce lien pour toujours ?", "Copier le lien", "creerPartageAction", "revoquerPartageAction"]) expect(source).toContain(t);
    expect(readFileSync(join(process.cwd(), "src/components/partage/FeuillePartager.tsx"), "utf8")).not.toContain("creerPartageAction");
  });

  it("la fiche vidéo rend la même feuille qu'avant : FeuillePartager (contexte) == PartagerVideo (mêmes données)", () => {
    const fermee = renderToStaticMarkup(createElement(FournisseurVideo as never, { donnees } as never, createElement(FeuillePartager)));
    const directe = renderToStaticMarkup(createElement(PartagerVideo, { videoId: "v1", titre: "Chatbot 24h/24", partages: [], ouverte: false, onOuverteChange: () => undefined }));
    expect(texte(fermee)).toBe(texte(directe));
  });
});

describe("un lien privé sur une vidéo Image → vidéo prête", () => {
  it("se crée sur la sortie de sa version choisie, et le lien se résout", async () => {
    reinitialiserDepots();
    const d = depots();
    const now = new Date().toISOString();
    await d.videos.enregistrer({ id: "v-iv", titre: "Chatbot", formatId: "image-video", statut: "prete", versionChoisieId: "ver-1", creeLe: now, modifieLe: now } as unknown as Video);
    await d.sorties.enregistrer({ id: "s1", videoId: "v-iv", versionId: "ver-1", ratio: "9:16", resolution: "1080x1920", dureeSec: 50, taille: 1, fichierId: "f1", creeLe: now, modifieLe: now } as never);
    const p = await partages.creerPartage("v-iv", { dureeJours: 7, telechargementAutorise: false });
    expect(p.sortieId).toBe("s1");
    expect((await partages.listerPartages("v-iv"))[0]).toMatchObject({ actif: true, chemin: p.chemin });
  });

  it("refuse une vidéo pas prête, en phrase", async () => {
    reinitialiserDepots();
    const now = new Date().toISOString();
    await depots().videos.enregistrer({ id: "v-brouillon", titre: "x", formatId: "image-video", statut: "brouillon", creeLe: now, modifieLe: now } as unknown as Video);
    await expect(partages.creerPartage("v-brouillon", { dureeJours: 7, telechargementAutorise: false })).rejects.toMatchObject({ code: "PAS_PRETE" });
  });
});
