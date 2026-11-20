import { describe, expect, it } from "vitest";
import { corpsPostZernio, type DemandeZernio } from "@/fournisseurs/publication/zernio-corps";

const MAINTENANT = Date.parse("2026-11-01T08:00:00Z");
const CREATEUR = { privacyLevels: ["PUBLIC_TO_EVERYONE"], allowComment: true, allowDuet: false, allowStitch: true };
const base = (p: Partial<DemandeZernio> = {}): DemandeZernio => ({
  reseau: "instagram",
  texte: "Texte d'exemple",
  date: "2026-11-05T10:00:00+01:00",
  fichierCle: "https://exemple-r2.test/video.mp4",
  cible: "exemple-compte-1",
  cleEnvoi: "a".repeat(64),
  ...p,
});
const spec = (p: Partial<DemandeZernio>, o: Record<string, unknown> = {}) =>
  (corpsPostZernio(base(p), { maintenant: MAINTENANT, createurTiktok: CREATEUR, ...o }).platforms[0].platformSpecificData ?? {}) as Record<string, unknown>;
const IMAGES = { images: [{ url: "https://exemple-r2.test/a.jpg", texteAlternatif: "Une image d'exemple" }] } as Partial<DemandeZernio>;

describe("ZRN-01 · premier commentaire Instagram", () => {
  it("vidéo : firstComment égal au texte", () => {
    expect(spec({ premierCommentaire: "Voir le lien" }).firstComment).toBe("Voir le lien");
  });
  it("image : firstComment égal au texte", () => {
    expect(spec({ ...IMAGES, premierCommentaire: "Voir le lien" }).firstComment).toBe("Voir le lien");
  });
  it("sans commentaire (absent, vide, espaces) : pas de clé", () => {
    for (const c of [undefined, "", "   "]) {
      expect(spec({ premierCommentaire: c })).not.toHaveProperty("firstComment");
      expect(spec({ ...IMAGES, premierCommentaire: c })).not.toHaveProperty("firstComment");
    }
  });
  it("TikTok et YouTube ne portent jamais firstComment", () => {
    const tiktok = spec({ reseau: "tiktok", premierCommentaire: "Voir le lien", consentementTiktok: true, niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE" });
    expect(tiktok).not.toHaveProperty("firstComment");
    const yt = spec(
      { reseau: "youtube-shorts", premierCommentaire: "Voir le lien", format: "9:16", dureeSec: 30, titre: "Titre" },
      { youtube: { titre: "studio", visibilite: "private", categorieId: "22", pourEnfants: false, synthetique: "non" } },
    );
    expect(yt).not.toHaveProperty("firstComment");
  });
});
