import { describe, expect, it } from "vitest";
import { corpsPostZernio, IMAGES_MAX, REEL_FACEBOOK_DUREE_SEC, type CreateurTiktok, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";

// RES-01 : limites d'après le relevé officiel L8-01 (docs/reseaux/regles-officielles.json, lu le 2026-11-12).
const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const CREATEUR: CreateurTiktok = { privacyLevels: ["SELF_ONLY"], allowComment: true, allowDuet: true, allowStitch: true };
const base = (p: Partial<DemandeZernio>): DemandeZernio => ({
  reseau: "instagram",
  texte: "Texte d'exemple",
  date: "2026-11-05T10:00:00+01:00",
  fichierCle: "https://exemple-r2.test/video.mp4",
  cible: "exemple-compte-1",
  cleEnvoi: "a".repeat(64),
  ...p,
});
const corps = (p: Partial<DemandeZernio>) => corpsPostZernio(base(p), { maintenant: MAINTENANT, createurTiktok: CREATEUR });
const images = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://exemple-r2.test/${i}.png`, texteAlternatif: "Image d'exemple" }));
const tiktok = (p: Partial<DemandeZernio> = {}) =>
  corps({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY", ...p }).platforms[0].platformSpecificData as Record<string, unknown>;

describe("RES-01 · carrousel Instagram", () => {
  it("20 images acceptées, 21 refusées avec un message en français", () => {
    expect(IMAGES_MAX.instagram).toBe(20);
    expect(corps({ images: images(20) }).mediaItems).toHaveLength(20);
    expect(() => corps({ images: images(21) })).toThrow(/instagram accepte 20 images au plus\. Rien n'a été envoyé/);
  });
  it("les autres limites d'images ne bougent pas", () => {
    expect(IMAGES_MAX).toEqual({ instagram: 20, facebook: 10, linkedin: 20, tiktok: 35 });
  });
});

describe("RES-01 · TikTok : cases d'interaction", () => {
  it("décochées par défaut, même si le créateur les permet", () => {
    expect(tiktok()).toMatchObject({ allowComment: false, allowDuet: false, allowStitch: false });
  });
  it("cochées seulement si la personne les coche", () => {
    expect(tiktok({ interactionsTiktok: { commentaire: true } })).toMatchObject({ allowComment: true, allowDuet: false, allowStitch: false });
    expect(tiktok({ interactionsTiktok: { duo: true } })).toMatchObject({ allowComment: false, allowDuet: true, allowStitch: false });
    expect(tiktok({ interactionsTiktok: { collage: true } })).toMatchObject({ allowComment: false, allowDuet: false, allowStitch: true });
  });
  it("jamais cochée si le créateur l'interdit", () => {
    const interdit: CreateurTiktok = { ...CREATEUR, allowComment: false, allowDuet: false, allowStitch: false };
    const c = corpsPostZernio(base({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY", interactionsTiktok: { commentaire: true, duo: true, collage: true } }), { maintenant: MAINTENANT, createurTiktok: interdit });
    expect(c.platforms[0].platformSpecificData).toMatchObject({ allowComment: false, allowDuet: false, allowStitch: false });
  });
  it("une valeur non booléenne vraie ne coche rien", () => {
    expect(tiktok({ interactionsTiktok: { commentaire: "oui" as unknown as boolean } })).toMatchObject({ allowComment: false });
  });
});

describe("RES-01 · Reel Facebook", () => {
  const fb = (dureeSec: number) => corps({ reseau: "facebook", cible: "a:fb:p1", format: "9:16", dureeSec }).platforms[0].platformSpecificData as Record<string, unknown>;
  it("la limite reste 60 s (réseau : 90 s, diffuseur : 60 s)", () => {
    expect(REEL_FACEBOOK_DUREE_SEC).toEqual({ min: 3, max: 60 });
    expect(fb(60).contentType).toBe("reel");
    expect(fb(61).contentType).toBeUndefined();
  });
});
