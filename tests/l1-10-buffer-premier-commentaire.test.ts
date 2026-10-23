/**
 * L1-10 — premier commentaire (`firstComment`) et texte alternatif (`altText`) dans l'entrée createPost.
 * Double de Buffer uniquement : aucun envoi réel. Le schéma relevé (r1-buffer-schema) valide les noms de champs.
 */
import { describe, expect, it } from "vitest";
import { entreeCreerPost, creerPublicationBuffer, ErreurBuffer, premierCommentaireTransmissible, ALT_MAX } from "@/fournisseurs/publication/buffer";
import { CANAUX } from "./helpers/r1-buffer";

const VIDEO = "https://compte.r2.cloudflarestorage.com/seau/v.mp4?X-Amz-Expires=604800";
const INSTANT = Date.parse("2026-10-03T10:00:00.000Z");
const base = { texte: "Bonjour", date: "2026-10-05T07:00:00.000Z", fichierCle: VIDEO, canalId: CANAUX.instagram };
const meta = (r: Parameters<typeof entreeCreerPost>[0]) => entreeCreerPost(r, INSTANT).metadata as Record<string, Record<string, unknown>> | undefined;

describe("premier commentaire", () => {
  it("transmis par Instagram, Facebook et LinkedIn, sans casser le reste de leur réglage", () => {
    expect(meta({ ...base, reseau: "instagram", premierCommentaire: "Le lien : axion-ia.com" })?.instagram).toEqual({ type: "reel", shouldShareToFeed: true, firstComment: "Le lien : axion-ia.com" });
    expect(meta({ ...base, reseau: "facebook", premierCommentaire: "Le lien" })?.facebook).toEqual({ type: "reel", firstComment: "Le lien" });
    expect(meta({ ...base, reseau: "linkedin", premierCommentaire: "Le lien" })).toEqual({ linkedin: { firstComment: "Le lien" } });
  });

  it("sans commentaire (ou blanc) : payload inchangé", () => {
    expect(meta({ ...base, reseau: "instagram" })?.instagram).toEqual({ type: "reel", shouldShareToFeed: true });
    expect(meta({ ...base, reseau: "instagram", premierCommentaire: "  " })?.instagram).toEqual({ type: "reel", shouldShareToFeed: true });
    expect(meta({ ...base, reseau: "linkedin" })).toBeUndefined();
  });

  it("TikTok et YouTube : jamais de firstComment dans l'entrée", () => {
    expect(JSON.stringify(entreeCreerPost({ ...base, reseau: "tiktok", premierCommentaire: "Le lien" }, INSTANT))).not.toContain("firstComment");
    expect(JSON.stringify(entreeCreerPost({ ...base, reseau: "youtube", titre: "T", premierCommentaire: "Le lien" }, INSTANT))).not.toContain("firstComment");
    expect(["instagram", "facebook", "linkedin"].every((r) => premierCommentaireTransmissible(r as "instagram"))).toBe(true);
    expect(["tiktok", "youtube", "youtube-shorts"].some((r) => premierCommentaireTransmissible(r as "tiktok"))).toBe(false);
  });

  it("mot interdit (Certifexemple certifié) : refus avant tout envoi", () => {
    expect(() => entreeCreerPost({ ...base, reseau: "instagram", premierCommentaire: "Nous sommes certifiés Certifexemple" }, INSTANT)).toThrow(ErreurBuffer);
  });
});

describe("texte alternatif", () => {
  const img = (t: string) => ({ url: "https://exemple.test/i.png", texteAlternatif: t });
  it("altText sur chaque image, 125 signes au plus", () => {
    const e = entreeCreerPost({ ...base, reseau: "instagram", images: [img("Un schéma"), img("x".repeat(300))] }, INSTANT);
    const assets = e.assets as { image: { url: string; metadata: { altText: string } } }[];
    expect(assets).toHaveLength(2);
    expect(assets[0].image.metadata.altText).toBe("Un schéma");
    expect(assets[1].image.metadata.altText.length).toBeLessThanOrEqual(ALT_MAX);
  });
  it("image sans texte alternatif : refus", () => {
    expect(() => entreeCreerPost({ ...base, reseau: "instagram", images: [img("  ")] }, INSTANT)).toThrow(ErreurBuffer);
  });
});

describe("envoi avec double", () => {
  const reponse = (statut = "draft") => ({ data: { createPost: { __typename: "PostActionSuccess", post: { id: "post123456", channelId: "c", status: statut } } } });
  const fournisseur = () => {
    const corps: unknown[] = [];
    const appeler = (async (_u: string, init: { body: string }) => {
      corps.push(JSON.parse(init.body));
      return new Response(JSON.stringify(reponse()), { status: 200, headers: { "content-type": "application/json" } });
    }) as never;
    return { f: creerPublicationBuffer("cle-test-0123456789", { appeler }), corps };
  };

  it("le payload envoyé contient firstComment ; réponse « transmis »", async () => {
    const { f, corps } = fournisseur();
    const r = await f.envoyer({ ...base, reseau: "instagram", premierCommentaire: "Le lien" });
    expect(JSON.stringify(corps[0])).toContain("firstComment");
    expect(r.premierCommentaire).toBe("transmis");
  });
  it("réseau non pris en charge : « a-la-main », rien d'abandonné en silence", async () => {
    const { f } = fournisseur();
    expect((await f.envoyer({ ...base, reseau: "tiktok", premierCommentaire: "Le lien" })).premierCommentaire).toBe("a-la-main");
  });
  it("pas de commentaire : la réponse n'en parle pas", async () => {
    const { f } = fournisseur();
    expect(await f.envoyer({ ...base, reseau: "instagram" })).not.toHaveProperty("premierCommentaire");
  });
  it("mot interdit : aucun appel au réseau", async () => {
    const { f, corps } = fournisseur();
    await expect(f.envoyer({ ...base, reseau: "instagram", premierCommentaire: "Certifexemple certifié" })).rejects.toBeInstanceOf(ErreurBuffer);
    expect(corps).toHaveLength(0);
  });
});
