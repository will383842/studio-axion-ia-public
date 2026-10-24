/**
 * Décision de Will (19/10/2026) : « SUPPRIME TIKTOK POUR IMAGE TO VIDEO ». TikTok n'est plus proposé ni fabriqué par
 * Image → vidéo ; les anciennes vidéos qui le portent restent lisibles ; les autres générateurs gardent TikTok.
 * Rendu statique, aucun appel payant.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { RESEAUX_IV, RESEAUX_IV_HISTORIQUE, PLAFONDS_IV } = await import("@/domaine/image-video/plafonds");
const { lireEntreesImageVideo, creerMoteurMontageImageVideo } = await import("@/moteurs/montage-image-video");
const lots = await import("@/services/image-video-lot");
const { PHRASE_TIKTOK_RETIRE_IV } = await import("@/domaine/image-video/plafonds");
const { Depot } = await import("@/components/formats/image-video/Depot");
const { VosVideos } = await import("@/components/formats/image-video/VosVideos");
const vue = await import("@/components/formats/image-video/vue");
const ecran = await import("@/services/image-video-ecran");
const { formatImageVideo } = await import("@/formats/image-video");
const autres = await import("@/formats/autres");
const { formatFacecamAnimee } = await import("@/formats/facecam-animee");
const { formatAvocat } = await import("@/formats/avocat");
const { formatTableauAnime } = await import("@/formats/tableau-anime");
const { formatCasConcret } = await import("@/formats/cas-concret");
const { formatFacecam } = await import("@/formats/facecam");
const { livraisonDe } = await import("@/moteurs/montage-image-video/fabrication");

const texte = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("(a) le dépôt Image → vidéo ne propose plus TikTok", () => {
  it("quatre réseaux proposés, TikTok absent des constantes, des pastilles et du texte", () => {
    expect([...RESEAUX_IV]).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);
    expect(vue.RESEAUX_ECRAN_IV.map((r) => r.valeur)).toEqual([...RESEAUX_IV]);
    expect([...formatImageVideo.reseauxConseilles]).toEqual([...RESEAUX_IV]);
    const html = texte(renderToStaticMarkup(createElement(Depot, { montants: { 1: 120, 2: 180, 3: 240, 4: 300 } })));
    expect(html).not.toMatch(/tiktok/i);
    for (const r of ["YouTube Shorts", "LinkedIn", "Instagram", "Facebook"]) expect(html).toContain(r);
    expect(html).toMatch(/au plus 3,00\s?€/);
  });

  it("le prix « au plus » du dépôt baisse avec quatre réseaux (le moteur réserve le même prix)", () => {
    const quatre = ecran.prixDuDepot(RESEAUX_IV);
    expect(quatre).toBe(895); // 8,95 € au plus (24/10 : 7,95 € + 1 € de relectures du fil Facebook 4:5 ; cinq réseaux avant : 9,26 €)
    expect(quatre).toBeLessThan(926);
    expect(quatre).toBeGreaterThan(ecran.prixDuDepot(["youtube-shorts", "linkedin", "instagram"]));
  });

  it("une demande qui ne porte que TikTok est refusée en une phrase claire, rien n'est créé", async () => {
    const brouillon = vi.fn();
    const r = await ecran.deposerImageVideo({ fichierId: "f-1", reseaux: ["tiktok"] as never, largeur: 1080, hauteur: 1350 }, { formatOuvert: () => true, voix: async () => ({}) as never, fichier: async () => ({ mime: "image/png", taille: 1000 }) as never, brouillon });
    expect(r).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.tiktokRetire });
    expect(ecran.PHRASES_IV.tiktokRetire).toMatch(/TikTok n'est plus proposé/);
    expect(brouillon).not.toHaveBeenCalled();
  });
});

describe("(a bis) le moteur et le lot refusent une demande qui ne porte que TikTok", () => {
  it("le moteur refuse au lancement avec le code IV_SANS_RESEAU et la phrase « TikTok n'est plus proposé »", () => {
    const commande = { entrees: { imageVideo: { imageCle: "k", reseaux: ["tiktok"] } } } as never;
    expect(creerMoteurMontageImageVideo({ statutFormat: "actif" }).refusAuLancement?.(commande)).toEqual({ code: "IV_SANS_RESEAU", message: PHRASE_TIKTOK_RETIRE_IV });
  });

  it("le dépôt d'un lot qui ne porte que TikTok est refusé avec PHRASES_IV.tiktokRetire", async () => {
    const r = await lots.deposerLotImageVideo({ images: ["f-1", "f-2"].map((fichierId) => ({ fichierId, largeur: 1080, hauteur: 1350 })), reseaux: ["tiktok"] });
    expect(r).toEqual({ statut: "refusee", phrase: ecran.PHRASES_IV.tiktokRetire });
  });
});

describe("(b) une ancienne demande ou vidéo avec « tiktok » reste lisible", () => {
  it("l'entrée d'une ancienne demande se lit sans erreur : TikTok est ignoré, les autres réseaux sont gardés", () => {
    const e = lireEntreesImageVideo({ imageVideo: { imageCle: "k", reseaux: ["tiktok", "linkedin", "facebook"] } });
    expect(e.reseaux).toEqual(["linkedin", "facebook"]);
    expect(lireEntreesImageVideo({ imageVideo: { imageCle: "k", reseaux: ["tiktok"] } }).reseaux).toEqual([]);
  });

  it("TikTok garde son nom et son plafond pour l'affichage des anciennes vidéos", () => {
    expect(PLAFONDS_IV.tiktok.nom).toBe("TikTok");
    expect(vue.nomReseau("tiktok")).toBe("TikTok");
    expect([...RESEAUX_IV_HISTORIQUE]).toContain("tiktok");
  });

  it("la page de suivi et « Mes vidéos » affichent une ancienne livraison TikTok sans erreur, résultats livrés accessibles", () => {
    const cartes = vue.cartesReseaux([
      { reseau: "facebook", version: "longue", dureeSec: 52, fichierCle: "final/fb.mp4" },
      { reseau: "tiktok", version: "longue", dureeSec: 66.2, mention: "un peu longue pour ce réseau", fichierCle: "final/tt.mp4" },
      { reseau: "linkedin", version: "courte", dureeSec: 58, fichierCle: "final/li.mp4" },
    ]);
    expect(cartes.map((c) => c.nom)).toEqual(["TikTok", "LinkedIn", "Facebook"]);
    expect(cartes[0].fichierCle).toBe("final/tt.mp4");
    const html = texte(renderToStaticMarkup(createElement(VosVideos, { videos: cartes.map((c) => ({ ...c, url: `https://exemple/${c.fichierCle}` })), verdict: "" as never })));
    expect(html).toContain("TikTok");
    expect(html).toContain("Télécharger");
  });
});

describe("(c) les autres générateurs gardent TikTok", () => {
  it("les formats autres qu'Image → vidéo conseillent toujours TikTok", () => {
    for (const f of [autres.formatCreateurB, autres.formatEcranPartage, autres.formatMotion, autres.formatUgc, autres.formatSelfie]) {
      expect(f.reseauxConseilles, f.id).toContain("tiktok");
    }
    expect(formatFacecamAnimee.reseauxConseilles).toContain("tiktok");
  });

  it("avocat, tableau animé, cas concret et face caméra gardent TikTok", () => {
    for (const f of [formatAvocat, formatTableauAnime, formatCasConcret, formatFacecam]) {
      expect(f.reseauxConseilles, f.id).toContain("tiktok");
    }
  });
});

describe("(d) une demande qui porte TikTok", () => {
  it("la livraison d'une demande qui porte TikTok le signale « TikTok n'est plus proposé », sans fichier", () => {
    const e = { demande: { reseaux: ["tiktok", "linkedin"] }, plan: { fins: [] }, rendus: {} } as never;
    const l = livraisonDe(e, { reseaux: [{ reseau: "linkedin", version: "longue" }] } as never, { textes: [], manquements: [] }, {});
    const tt = l.find((x) => x.reseau === "tiktok")!;
    expect(tt.version).toBe("aucune");
    expect(tt.mention).toMatch(/TikTok n'est plus proposé/);
    expect(tt).not.toHaveProperty("fichierCle");
  });
});
