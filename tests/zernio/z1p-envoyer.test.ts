import { describe, expect, it } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
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

describe("z1p · envoyer", () => {
  it("brouillon : téléverse, crée, clé d'idempotence studio-<hex>, via zernio", async () => {
    const { f, faux } = monter();
    const r = await f.envoyer(demande());
    expect(r).toEqual({ idExterne: "exemple-post-9", via: "zernio", statut: "brouillon" });
    const [p] = posts(faux);
    expect(p.entetes["Idempotency-Key"]).toBe(`studio-${CLE}`);
    expect(p.entetes["Idempotency-Key"].length).toBeLessThanOrEqual(255);
    expect(p.json).toMatchObject({ isDraft: true, timezone: "Europe/Paris", mediaItems: [{ type: "video", url: "https://exemple-cdn.test/m/x.mp4" }] });
    expect(p.corps).not.toMatch(/publishNow|"draft":true/);
    expect(faux.appels.every((a) => !a.corps?.includes(CLE_FICTIVE))).toBe(true);
  });
  it("programmer : statut programmee", async () => {
    const { f } = monter();
    expect((await f.envoyer(demande({ mode: "programmer", date: "2026-11-05T10:00:00Z" }))).statut).toBe("programmee");
  });
  it("clé non hexadécimale : dérivée, jamais envoyée telle quelle", async () => {
    const { f, faux } = monter();
    await f.envoyer(demande({ cleEnvoi: "cle libre" }));
    expect(posts(faux)[0].entetes["Idempotency-Key"]).toMatch(/^studio-[0-9a-f]{64}$/);
  });
  it("refus purs : aucun appel réseau (date passée, Facebook sans page, TikTok sans case)", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ date: "2026-10-01T10:00:00Z" }))).rejects.toThrow(/futur/);
    await expect(f.envoyer(demande({ reseau: "facebook" }))).rejects.toThrow(/page/);
    await expect(f.envoyer(demande({ reseau: "tiktok" }))).rejects.toThrow(/consentement/);
    expect(faux.appels).toHaveLength(0);
  });
  it("LinkedIn : cible nue refusée sans réseau ; profil seulement si le compte lu est personnel", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ reseau: "linkedin", cible: "exemple-compte-2" }))).rejects.toThrow(/choisissez une page/);
    expect(faux.appels).toHaveLength(0);
    const comptes = (type?: string) => (a: AppelEnregistre) => (a.url.endsWith("/v1/accounts") ? { statut: 200, corps: { accounts: [{ _id: "exemple-compte-2", platform: "linkedin", ...(type ? { accountType: type } : {}) }] } } : undefined);
    const non = monter(comptes("organization"));
    await expect(non.f.envoyer(demande({ reseau: "linkedin", cible: "exemple-compte-2:li:profil" }))).rejects.toThrow(/profil personnel/);
    expect(posts(non.faux)).toHaveLength(0);
    const oui = monter(comptes("personal"));
    await oui.f.envoyer(demande({ reseau: "linkedin", cible: "exemple-compte-2:li:profil" }));
    expect(posts(oui.faux)).toHaveLength(1);
    const page = monter();
    await page.f.envoyer(demande({ reseau: "linkedin", cible: "exemple-compte-2:li:42" }));
    expect(posts(page.faux)[0].json).toMatchObject({ platforms: [{ platformSpecificData: { organizationUrn: "urn:li:organization:42" } }] });
  });
  it("sans cleEnvoi : refus (jamais une clé dérivée d'une adresse signée)", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer(demande({ cleEnvoi: undefined }))).rejects.toThrow(/empreinte/);
    expect(faux.appels).toHaveLength(0);
  });
  it("TikTok : sans niveau de confidentialité choisi, refus avant le réseau", async () => {
    const { f, faux } = monter();
    await expect(f.envoyer({ ...demande({ reseau: "tiktok", consentementTiktok: true }) })).rejects.toThrow(/confidentialité/);
    expect(faux.appels).toHaveLength(0);
  });
  it("lecture du média source : redirection refusée, délai posé", async () => {
    const { vi } = await import("vitest");
    const { lecteurMediaParDefaut } = await import("@/fournisseurs/publication/zernio-medias");
    const esp = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(new Uint8Array([1]), { headers: { "content-length": "1" } }));
    await lecteurMediaParDefaut("https://exemple-r2.test/v.mp4");
    expect(esp.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    expect((esp.mock.calls[0][1] as RequestInit).signal).toBeDefined();
    esp.mockRestore();
  });
  it("TikTok : creator-info lu, 5 champs posés", async () => {
    const { f, faux } = monter();
    await f.envoyer(demande({ reseau: "tiktok", niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE", consentementTiktok: true }));
    expect(faux.appels[0].url).toContain("/tiktok/creator-info");
    expect(posts(faux)[0].json).toMatchObject({ platforms: [{ platform: "tiktok", platformSpecificData: { contentPreviewConfirmed: true, expressConsentGiven: true, allowComment: true, allowDuet: false, allowStitch: true } }] });
  });
  it("premier commentaire : Facebook transmis, TikTok à la main", async () => {
    const { f } = monter();
    expect((await f.envoyer(demande({ reseau: "facebook", cible: "a:fb:p1", premierCommentaire: "Voir" }))).premierCommentaire).toBe("transmis");
    expect((await f.envoyer(demande({ reseau: "tiktok", niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE", consentementTiktok: true, premierCommentaire: "Voir" }))).premierCommentaire).toBe("a-la-main");
  });
  it("délai dépassé : GET avant tout renvoi ; post retrouvé = succès, jamais un second POST", async () => {
    const { f, faux } = monter((a) => {
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { erreur: "delai" };
      if (a.methode === "GET" && a.url.includes("/v1/posts")) return { statut: 200, corps: { posts: [postExemple({ _id: "exemple-post-7", metadata: { origine: "studio", studioCle: CLE } })] } };
      return undefined;
    });
    expect(await f.envoyer(demande())).toMatchObject({ idExterne: "exemple-post-7", via: "zernio" });
    expect(posts(faux)).toHaveLength(1);
  });
  it("délai dépassé et post introuvable : erreur, aucun renvoi", async () => {
    const { f, faux } = monter((a) => {
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 503, corps: {} };
      if (a.methode === "GET" && a.url.includes("/v1/posts")) return { statut: 200, corps: { posts: [] } };
      return undefined;
    });
    await expect(f.envoyer(demande())).rejects.toThrow();
    expect(posts(faux)).toHaveLength(1);
  });
  it("lireEtat, canaux (pages Facebook et LinkedIn)", async () => {
    const { f } = monter((a) => {
      if (a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: "exemple-compte-1", platform: "facebook", displayName: "Exemple" }, { _id: "exemple-compte-2", platform: "linkedin", displayName: "Exemple" }, { _id: "exemple-compte-3", platform: "linkedin", accountType: "personal" }] } };
      if (a.url.endsWith("/facebook-page")) return { statut: 200, corps: { pages: [{ id: "p1", name: "Page exemple" }] } };
      if (a.url.endsWith("/linkedin-organizations")) return { statut: 200, corps: { organizations: [{ id: "42", name: "Org exemple" }] } };
      if (a.url.includes("/v1/posts/")) return { statut: 200, corps: { post: postExemple({ status: "scheduled" }) } };
      return undefined;
    });
    expect((await f.lireEtat!("exemple-post-1")).statut).toBe("programmee");
    const ids = (await f.listerCanaux!()).map((c) => c.id);
    expect(ids).not.toContain("exemple-compte-2"); // pas de canal LinkedIn implicite
    expect(ids).toEqual(expect.arrayContaining(["exemple-compte-1:fb:p1", "exemple-compte-2:li:42", "exemple-compte-3:li:profil"]));
  });
});
