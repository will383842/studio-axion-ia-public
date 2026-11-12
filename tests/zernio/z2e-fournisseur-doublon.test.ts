import { describe, expect, it } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import type { PostZernio } from "@/fournisseurs/publication/zernio-client";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import type { LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import type { DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const CLE = cleEnvoiPublication("video-exemple", "instagram", "2026-11-05T10:00:00Z", "exemple");
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lire: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
const demande = (p: Partial<DemandeZernio> = {}): DemandeZernio => ({ reseau: "instagram", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-1", cleEnvoi: CLE, ...p });

function serveur(suite: (a: AppelEnregistre) => ReponsePreparee | undefined = () => undefined) {
  return (a: AppelEnregistre): ReponsePreparee => {
    const u = a.url;
    const surmesure = suite(a);
    if (surmesure) return surmesure;
    if (u.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
    if (u.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
    if (a.methode === "POST" && u.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
    if (u.endsWith("/tiktok/creator-info")) return { statut: 200, corps: { privacyLevels: [{ value: "PUBLIC_TO_EVERYONE" }], postingLimits: { interactionSettings: { allow_comment: { enabled: true }, allow_duet: { enabled: false }, allow_stitch: { enabled: true } } } } };
    return { statut: 404, corps: {} };
  };
}
const monter = (suite?: Parameters<typeof serveur>[0]) => {
  const t = creerFauxClientZernio(serveur(suite));
  const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: t.horloge.maintenant });
  return { ...t, f };
};
const posts = (faux: { appels: AppelEnregistre[] }) => faux.appels.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));

describe("z2e · fournisseur : création incomplète et doublons", () => {
  it("2xx avec une plateforme en échec : code « creation-incomplete » (post existant, jamais un refus net)", async () => {
    const { f } = monter((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 201, corps: { post: postExemple({ _id: "exemple-post-5", platforms: [{ platform: "instagram", accountId: "exemple-compte-1", status: "failed", errorCategory: "exemple" }] }) } } : undefined));
    await expect(f.envoyer(demande())).rejects.toMatchObject({ code: "creation-incomplete", statut: 200 });
  });
  const doublon = (existante: Partial<PostZernio>) => (a: AppelEnregistre) => {
    if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 409, corps: { error: "duplicate", details: { existingPostId: "exemple-post-origine" } } };
    if (a.methode === "GET" && a.url.endsWith("/v1/posts/exemple-post-origine")) return { statut: 200, corps: { post: postExemple({ _id: "exemple-post-origine", ...existante }) } };
    return undefined;
  };
  it("doublon 409 : repris seulement si la clé du post d'origine correspond", async () => {
    const { f } = monter(doublon({ metadata: { origine: "studio", studioCle: CLE } }));
    expect(await f.envoyer(demande())).toMatchObject({ idExterne: "exemple-post-origine", via: "zernio" });
  });
  it("doublon 409 : clé différente (autre page du même compte) = « à vérifier », identifiant non repris", async () => {
    const { f } = monter(doublon({ metadata: { origine: "studio", studioCle: "autre" } }));
    const e = await f.envoyer(demande()).catch((x) => x);
    expect(e).toMatchObject({ code: "doublon" });
    expect(e.existingPostId).toBeUndefined();
  });
});
