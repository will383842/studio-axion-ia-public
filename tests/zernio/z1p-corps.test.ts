import { describe, expect, it } from "vitest";
import type { DemandePublication } from "@/fournisseurs/types";
import { analyserCible, compteLinkedinEstProfil, corpsPostZernio, dateZernio, lireCreateurTiktok, type CreateurTiktok } from "@/fournisseurs/publication/zernio-corps";
import { J, MOT_INTERDIT } from "./aides/faux-zernio";

const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const CREATEUR: CreateurTiktok = { privacyLevels: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"], allowComment: true, allowDuet: false, allowStitch: true };
const base = (p: Partial<DemandePublication> & { niveauConfidentialiteTiktok?: string } = {}) => ({
  reseau: "instagram",
  texte: "Texte d'exemple",
  date: "2026-11-05T10:00:00+01:00",
  fichierCle: "https://exemple-r2.test/video.mp4",
  cible: "exemple-compte-1",
  cleEnvoi: "a".repeat(64),
  ...p,
});
const corps = (p: Partial<DemandePublication> & { niveauConfidentialiteTiktok?: string }, o: Record<string, unknown> = {}) => corpsPostZernio(base(p), { maintenant: MAINTENANT, createurTiktok: CREATEUR, ...o });
const spec = (c: ReturnType<typeof corps>) => c.platforms[0].platformSpecificData as Record<string, unknown>;
const refuse = (p: Partial<DemandePublication> & { niveauConfidentialiteTiktok?: string }, o: Record<string, unknown> = {}) => expect(() => corps(p, o)).toThrow(/Rien n'a été envoyé|interdit/);

describe("z1p · corps pur", () => {
  it("brouillon, date Z, fuseau Paris, métadonnées Studio, jamais publishNow ni draft de réseau", () => {
    const c = corps({});
    expect(c).toMatchObject({ isDraft: true, scheduledFor: "2026-11-05T09:00:00Z", timezone: "Europe/Paris", metadata: { origine: "studio", studioCle: "a".repeat(64) } });
    const t = JSON.stringify(c).toLowerCase();
    expect(t).not.toContain("publishnow");
    expect(t).not.toContain("facebooksettings");
    expect(t).not.toContain("tiktoksettings");
    expect(t).not.toContain('"draft"');
  });
  it("dates : non futures refusées ; programmer exige 30 min", () => {
    refuse({ date: "2026-11-01T07:00:00Z" });
    refuse({ date: "2026-11-01T08:10:00Z", mode: "programmer" });
    expect(corps({ mode: "programmer", date: "2026-11-01T09:00:00Z" }).isDraft).toBe(false);
    expect(dateZernio("2026-11-05T10:00:00.456Z")).toBe("2026-11-05T10:00:00Z");
  });
  it("cibles D9", () => {
    expect(analyserCible("exemple-compte-1:fb:exemple-page-2")).toEqual({ accountId: "exemple-compte-1", pageId: "exemple-page-2" });
    expect(analyserCible("exemple-compte-1:li:12345")).toEqual({ accountId: "exemple-compte-1", organizationUrn: "urn:li:organization:12345" });
    expect(() => analyserCible("")).toThrow();
    expect(() => analyserCible("a:xx:1")).toThrow();
    refuse({ reseau: "facebook" }); // page par défaut : refusée
    refuse({ reseau: "linkedin", cible: undefined, canalId: undefined });
    expect(spec(corps({ reseau: "facebook", cible: "exemple-compte-1:fb:exemple-page-2" }))).toMatchObject({ pageId: "exemple-page-2" });
    expect(spec(corps({ reseau: "linkedin", cible: "exemple-compte-1:li:77" }))).toMatchObject({ organizationUrn: "urn:li:organization:77" });
    // LinkedIn : cible nue refusée (jamais l'organisation par défaut) ; profil seulement s'il est prouvé
    refuse({ reseau: "linkedin" });
    refuse({ reseau: "linkedin", cible: "exemple-compte-1:li:profil" });
    expect(analyserCible("exemple-compte-1:li:profil")).toEqual({ accountId: "exemple-compte-1", profilLinkedin: true });
    const profil = corps({ reseau: "linkedin", cible: "exemple-compte-1:li:profil" }, { profilLinkedinProuve: true });
    expect(profil.platforms[0].platformSpecificData).toBeUndefined();
    expect(compteLinkedinEstProfil({ accountType: "personal" })).toBe(true);
    expect(compteLinkedinEstProfil({ accountType: "organization" })).toBe(false);
    expect(compteLinkedinEstProfil({})).toBe(false);
  });
  it("IA : Instagram oui, Facebook et LinkedIn rien, TikTok vidéo seulement", () => {
    expect(spec(corps({ contenuIA: true }))).toMatchObject({ isAiGenerated: true, shareToFeed: true });
    const fb = corps({ reseau: "facebook", cible: "a:fb:p1", contenuIA: true });
    expect(JSON.stringify(fb)).not.toMatch(/isAiGenerated|videoMadeWithAi/);
    expect(fb.content).toBe("Texte d'exemple");
    expect(JSON.stringify(corps({ reseau: "linkedin", cible: "a:li:7", contenuIA: true }))).not.toMatch(/isAiGenerated|videoMadeWithAi/);
    expect(spec(corps({ reseau: "tiktok", contenuIA: true, consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" }))).toMatchObject({ videoMadeWithAi: true });
    refuse({ reseau: "tiktok", contenuIA: true, consentementTiktok: true, images: [{ url: "https://x.test/a.png", texteAlternatif: "Image" }] });
  });
  it("TikTok : 5 champs à chaque envoi, valeurs permises, marque, consentement exigé", () => {
    const s = spec(corps({ reseau: "tiktok", consentementTiktok: true, votreMarque: true, niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE" }));
    expect(s).toMatchObject({ contentPreviewConfirmed: true, expressConsentGiven: true, allowComment: true, allowDuet: false, allowStitch: true, privacyLevel: "PUBLIC_TO_EVERYONE", commercialContentType: "brand_organic" });
    expect(spec(corps({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "SELF_ONLY" })).commercialContentType).toBeUndefined();
    // le niveau est choisi par la personne : absent ou non offert = refus
    refuse({ reseau: "tiktok", consentementTiktok: true });
    refuse({ reseau: "tiktok", consentementTiktok: true, niveauConfidentialiteTiktok: "FOLLOWER_OF_CREATOR" });
    refuse({ reseau: "tiktok" });
    refuse({ reseau: "tiktok", consentementTiktok: false });
    expect(lireCreateurTiktok({ privacyLevels: [{ value: "SELF_ONLY" }], postingLimits: { interactionSettings: { allow_comment: { enabled: true }, allow_duet: { enabled: false } } } })).toEqual({ privacyLevels: ["SELF_ONLY"], allowComment: true, allowDuet: false, allowStitch: false });
  });
  it("médias : Reel Facebook 9:16 3-60 s, Instagram vidéo = Reel, limites d'images, texte alternatif", () => {
    const f = { reseau: "facebook" as const, cible: "a:fb:p1" };
    expect(spec(corps({ ...f, format: "9:16", dureeSec: 30 })).contentType).toBe("reel");
    expect(spec(corps({ ...f, format: "9:16", dureeSec: 61 })).contentType).toBeUndefined();
    expect(spec(corps({ ...f, format: "16:9", dureeSec: 30 })).contentType).toBeUndefined();
    const im = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `https://x.test/${i}.png`, texteAlternatif: "Image d'exemple" }));
    expect(corps({ images: im(10) }).mediaItems).toHaveLength(10);
    refuse({ images: im(11) });
    refuse({ reseau: "linkedin", cible: "a:li:7", images: im(21) });
    expect(corps({ reseau: "linkedin", cible: "a:li:7", images: im(20) }).mediaItems).toHaveLength(20);
    refuse({ images: [{ url: "https://x.test/a.png", texteAlternatif: "  " }] });
    refuse({ images: [{ url: "https://x.test/a.png", texteAlternatif: "x".repeat(126) }] }); // au-delà de 125 : refusé, jamais tronqué
    expect(corps({ images: [{ url: "https://x.test/a.png", texteAlternatif: "x".repeat(125) }] }).mediaItems?.[0].altText).toBe("x".repeat(125));
  });
  it("PDF LinkedIn : titre exigé ≤ 60, documentTitle dans platformSpecificData, un seul type, 100 Mo", () => {
    const doc = (titre?: string) => ({ reseau: "linkedin" as const, cible: "a:li:7", document: { url: "https://x.test/d.pdf", titre } });
    const c = corps(doc("Guide d'exemple"));
    expect(spec(c).documentTitle).toBe("Guide d'exemple");
    expect(c.mediaItems?.[0]).toMatchObject({ type: "document", title: "Guide d'exemple" });
    expect(c.mediaItems?.[0]).not.toHaveProperty("documentTitle");
    refuse(doc(undefined));
    refuse(doc("x".repeat(61)));
    refuse(doc(`Guide ${MOT_INTERDIT}`));
    refuse({ ...doc("Guide"), tailleOctets: 101 * 1024 * 1024 });
    refuse({ ...doc("Guide"), images: [{ url: "https://x.test/a.png", texteAlternatif: "Image" }] });
    refuse({ ...doc("Guide"), reseau: "instagram" });
  });
  it("mots interdits (texte, commentaire) et premier commentaire", () => {
    refuse({ texte: `Un texte ${MOT_INTERDIT}` });
    refuse({ premierCommentaire: J("Nom ", "Quali", "opi") });
    expect(spec(corps({ reseau: "linkedin", cible: "a:li:7", premierCommentaire: "Voir le lien" })).firstComment).toBe("Voir le lien");
    expect(corps({ premierCommentaire: "Voir le lien" }).platforms[0].platformSpecificData).not.toHaveProperty("firstComment"); // Instagram à prouver
    refuse({ reseau: "youtube" });
  });
});

describe("z1p · hôte des médias téléversés", () => {
  const hotesPublics = new Set(["exemple-cdn.test"]);
  it("accepte une adresse dont l'hôte vient du presign", () => {
    const c = corpsPostZernio(base(), { maintenant: MAINTENANT, medias: [{ type: "video", url: "https://exemple-cdn.test/m/x.mp4" }], hotesPublics });
    expect(c.mediaItems?.[0]?.url).toBe("https://exemple-cdn.test/m/x.mp4");
  });
  it("refuse un autre hôte, une adresse non https, ou l'absence d'hôtes de référence", () => {
    for (const url of ["https://autre-hote.test/x.mp4", "http://exemple-cdn.test/x.mp4", "pas une adresse"]) {
      expect(() => corpsPostZernio(base(), { maintenant: MAINTENANT, medias: [{ type: "video", url }], hotesPublics })).toThrow(/ne vient pas du téléversement/);
    }
    expect(() => corpsPostZernio(base(), { maintenant: MAINTENANT, medias: [{ type: "video", url: "https://exemple-cdn.test/x.mp4" }] })).toThrow(/ne vient pas du téléversement/);
  });
});
