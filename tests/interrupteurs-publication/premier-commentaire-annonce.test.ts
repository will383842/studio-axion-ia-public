/**
 * L5-07 · quand le premier commentaire est coupé, le fournisseur n'annonce plus « transmis » (résultat d'envoi, donc journal).
 * Faux client Zernio, aucun appel réel. Aucun fichier existant de tests/zernio modifié.
 */
import { describe, expect, it } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { creerPublicationZernio } from "@/fournisseurs/publication/zernio";
import type { DemandeZernio } from "@/fournisseurs/publication/zernio-corps";
import type { LecteurMedia } from "@/fournisseurs/publication/zernio-medias";
import { creerFauxClientZernio, CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "../zernio/aides/faux-zernio";

const CLE = cleEnvoiPublication("video-exemple", "facebook", "2026-11-05T10:00:00Z", "exemple-compte-1:fb:111");
const demande = (r: Partial<DemandeZernio> = {}): DemandeZernio => ({ reseau: "facebook", texte: "Texte d'exemple", date: "2026-11-05T10:00:00Z", fichierCle: "https://exemple-r2.test/v.mp4", cible: "exemple-compte-1:fb:111", cleEnvoi: CLE, premierCommentaire: "Commentaire d'exemple", ...r });
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lire: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
const serveur = (a: AppelEnregistre): ReponsePreparee => {
  if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
  if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
  if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
  return { statut: 404, corps: {} };
};
const envoyer = async (coupe: boolean, r: Partial<DemandeZernio> = {}) => {
  const t = creerFauxClientZernio(serveur);
  const f = creerPublicationZernio(CLE_FICTIVE, { clientPret: t.client, lire, maintenant: t.horloge.maintenant, lirePremierCommentaireCoupe: async () => coupe });
  return f.envoyer(demande({ date: new Date(t.horloge.maintenant() + 3 * 3600_000).toISOString(), ...r }));
};

describe("annonce du premier commentaire quand il est coupé", () => {
  it("coupé : le résultat n'annonce ni « transmis » ni « à la main »", async () => {
    const res = await envoyer(true);
    expect(res).toMatchObject({ idExterne: "exemple-post-9" });
    expect(res.premierCommentaire).toBeUndefined();
    expect(JSON.stringify(res)).not.toContain("transmis");
  });
  it("coupé sur un réseau où il ne part pas de toute façon : rien d'annoncé non plus", async () => {
    const res = await envoyer(true, { reseau: "instagram", cible: "exemple-compte-1" });
    expect(res.premierCommentaire).toBeUndefined();
  });
  it("non coupé : « transmis » comme aujourd'hui (Facebook)", async () => {
    expect((await envoyer(false)).premierCommentaire).toBe("transmis");
  });
});
