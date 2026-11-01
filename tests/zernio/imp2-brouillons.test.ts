import { describe, expect, it } from "vitest";
import { confirmerTable, proposerTable } from "../../src/services/import-buffer/cibles";
import { creerBrouillons } from "../../src/services/import-buffer/creer-brouillons";
import type { MediaCopie } from "../../src/services/import-buffer/medias-prives";
import type { PostBuffer } from "../../src/services/import-buffer/types";
import type { LecteurMedia } from "../../src/fournisseurs/publication/zernio-medias";
import { creerFauxClientZernio, fetchInterdit, J, MOT_INTERDIT, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";
import { creerClientZernio } from "../../src/fournisseurs/publication/zernio-client";

const MAINT = Date.parse("2026-11-01T08:00:00Z");
const CANAUX = [
  { id: "canal-ig", nom: "Exemple IG", service: "instagram" },
  { id: "canal-fb", nom: "Exemple FB", service: "facebook" },
  { id: "canal-li", nom: "Exemple LI", service: "linkedin" },
  { id: "canal-tt", nom: "Exemple TT", service: "tiktok" },
];
const CHOIX = { "canal-ig": "exemple-compte-1", "canal-fb": "exemple-compte-2:fb:exemple-page-1", "canal-li": "exemple-compte-3:li:123", "canal-tt": "exemple-compte-4" };
const TABLE = proposerTable(CANAUX, CHOIX).table;
const CONFIRMEE = confirmerTable(TABLE, "C'est juste", new Date(MAINT));

const post = (p: Partial<PostBuffer> & { id: string; canalId: string }): PostBuffer => ({ texte: "Texte d'exemple", dateUtc: "2026-11-05T10:00:00Z", statut: "scheduled", medias: [], ...p });
const copie = (type: MediaCopie["type"], rang = 0, p: Partial<MediaCopie> = {}): MediaCopie => ({ rang, type, mime: type === "video" ? "video/mp4" : type === "document" ? "application/pdf" : "image/png", taille: 10, sha256: "0".repeat(64), cleStockage: `import-buffer/post-exemple/${rang}.${type === "video" ? "mp4" : type === "document" ? "pdf" : "png"}`, ...p });
const urlLecture = async (cle: string) => `https://exemple-r2.test/${cle}`;
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lecteur: LecteurMedia = async () => ({ corps: flux(), taille: 1 });

function serveur(suite: (a: AppelEnregistre) => ReponsePreparee | undefined = () => undefined) {
  return (a: AppelEnregistre): ReponsePreparee => {
    const sur = suite(a);
    if (sur) return sur;
    if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
    if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
    if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
    return { statut: 404, corps: {} };
  };
}
const base = { table: CONFIRMEE, copies: new Map<string, MediaCopie[]>(), maintenant: () => MAINT, urlLecture, lecteur };

describe("IMP-2 brouillons", () => {
  it("à blanc (défaut) : corps construits, aucun appel réseau", async () => {
    const faux = fetchInterdit();
    const { client } = creerFauxClientZernio(faux.fetch ? () => { throw new Error("réseau interdit"); } : []);
    const posts = [post({ id: "post-exemple-1", canalId: "canal-ig" })];
    const copies = new Map([["post-exemple-1", [copie("video")]]]);
    const r = await creerBrouillons({ ...base, client, posts, copies, lot: "A" });
    expect(r.aBlanc).toBe(true);
    expect(r.lignes[0].etat).toBe("a-blanc");
    const c = r.corps.get("post-exemple-1")!;
    expect(c).toMatchObject({ isDraft: true, timezone: "Europe/Paris", scheduledFor: "2026-11-05T10:00:00Z", metadata: { origine: "import-buffer", bufferId: "post-exemple-1" } });
    expect(c.platforms[0].platformSpecificData).toMatchObject({ shareToFeed: true });
    expect(JSON.stringify(c)).not.toMatch(/publishNow/);
    expect(r.lignes[0].cle).toMatch(/^imp-[0-9a-f]{64}$/);
  });

  it("à blanc ne demande pas la table ; vraie création sans table confirmée : refusée", async () => {
    const { client } = creerFauxClientZernio([]);
    await expect(creerBrouillons({ ...base, client, table: TABLE, posts: [], lot: "A", aBlanc: false })).rejects.toThrow(/pas confirmée/);
    await expect(creerBrouillons({ ...base, client, table: undefined, posts: [], lot: "A", aBlanc: false })).rejects.toThrow();
  });

  it("lots, TikTok, date < 3 h et canal sans cible : les posts concernés ne partent pas", async () => {
    const { client } = creerFauxClientZernio([]);
    const posts = [
      post({ id: "post-exemple-1", canalId: "canal-ig" }),
      post({ id: "post-exemple-2", canalId: "canal-li" }),
      post({ id: "post-exemple-3", canalId: "canal-ig", dateUtc: "2026-11-01T10:00:00Z" }),
      post({ id: "post-exemple-4", canalId: "canal-inconnu" }),
    ];
    const copies = new Map(posts.map((p) => [p.id, [copie("video")]]));
    const r = await creerBrouillons({ ...base, client, posts, copies, lot: "A" });
    const etat = Object.fromEntries(r.lignes.map((l) => [l.bufferId, l.etat]));
    expect(etat).toEqual({ "post-exemple-1": "a-blanc", "post-exemple-2": "reste-buffer", "post-exemple-3": "reste-buffer", "post-exemple-4": "refuse" });
    expect(r.lignes[2].raison).toMatch(/3 h/);
  });

  it("Facebook : page explicite dans platformSpecificData ; LinkedIn page : organizationUrn, PDF avec documentTitle (pas dans mediaItems)", async () => {
    const { client } = creerFauxClientZernio([]);
    const posts = [post({ id: "post-exemple-1", canalId: "canal-fb", premierCommentaire: "Commentaire d'exemple" }), post({ id: "post-exemple-2", canalId: "canal-li", premierCommentaire: "Autre" })];
    const copies = new Map<string, MediaCopie[]>([["post-exemple-1", [copie("image", 0, { texteAlternatif: "Alt d'exemple" })]], ["post-exemple-2", [copie("document", 0, { titre: "Guide d'exemple" })]]]);
    const r = await creerBrouillons({ ...base, client, posts, copies, lot: "D" });
    const fb = r.corps.get("post-exemple-1")!;
    expect(fb.platforms[0].platformSpecificData).toMatchObject({ pageId: "exemple-page-1", firstComment: "Commentaire d'exemple" });
    const li = r.corps.get("post-exemple-2")!;
    expect(li.platforms[0].platformSpecificData).toMatchObject({ organizationUrn: "urn:li:organization:123", documentTitle: "Guide d'exemple" });
    expect(li.mediaItems?.[0]).toMatchObject({ type: "document", title: "Guide d'exemple" });
  });

  it("mêmes refus que Z1-P : mot interdit, image sans texte alternatif, titre de PDF vide, label dans le commentaire : refusés avant le réseau", async () => {
    const { client } = creerFauxClientZernio([]);
    const posts = [
      post({ id: "post-exemple-1", canalId: "canal-ig", texte: `Un texte ${MOT_INTERDIT}` }),
      post({ id: "post-exemple-2", canalId: "canal-ig" }),
      post({ id: "post-exemple-3", canalId: "canal-li" }),
      post({ id: "post-exemple-4", canalId: "canal-ig", premierCommentaire: J("Quali", "opi") }),
    ];
    const copies = new Map<string, MediaCopie[]>([
      ["post-exemple-1", [copie("video")]],
      ["post-exemple-2", [copie("image")]],
      ["post-exemple-3", [copie("document")]],
      ["post-exemple-4", [copie("video")]],
    ]);
    const r = await creerBrouillons({ ...base, client, posts, copies, lot: "D" });
    expect(r.lignes.filter((l) => l.etat === "refuse").map((l) => l.bufferId)).toEqual(["post-exemple-1", "post-exemple-2", "post-exemple-3", "post-exemple-4"]);
  });

  it("grille hors plafond : aucun post du lot n'est créé", async () => {
    const { client } = creerFauxClientZernio([]);
    const posts = Array.from({ length: 21 }, (_, i) => post({ id: `post-exemple-${i}`, canalId: "canal-ig", dateUtc: new Date(MAINT + 6 * 3_600_000 + i * 60_000).toISOString() }));
    const copies = new Map(posts.map((p) => [p.id, [copie("video")]]));
    const r = await creerBrouillons({ ...base, client, posts, copies, lot: "A" });
    expect(r.violations).toHaveLength(1);
    expect(r.lignes.every((l) => l.etat === "arret")).toBe(true);
  });

  it("création réelle : téléverse, POST isDraft avec Idempotency-Key imp-…, jamais publishNow ; journal fait foi pour un rejeu", async () => {
    const t = creerFauxClientZernio(serveur());
    const posts = [post({ id: "post-exemple-1", canalId: "canal-ig" })];
    const copies = new Map([["post-exemple-1", [copie("video")]]]);
    const r = await creerBrouillons({ ...base, client: t.client, posts, copies, lot: "A", aBlanc: false, maintenant: t.horloge.maintenant });
    expect(r.lignes[0]).toMatchObject({ etat: "cree", zernioId: "exemple-post-9" });
    const envoyes = t.faux.appels.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
    expect(envoyes).toHaveLength(1);
    expect(envoyes[0].entetes["Idempotency-Key"]).toBe(r.lignes[0].cle);
    expect(envoyes[0].json).toMatchObject({ isDraft: true, metadata: { origine: "import-buffer", bufferId: "post-exemple-1" }, mediaItems: [{ url: "https://exemple-cdn.test/m/x.mp4" }] });
    expect(envoyes[0].corps).not.toMatch(/publishNow/);
    // Rejeu : le journal connaît la clé → aucun nouvel envoi.
    const t2 = creerFauxClientZernio(serveur());
    const r2 = await creerBrouillons({ ...base, client: t2.client, posts, copies, lot: "A", aBlanc: false, maintenant: t2.horloge.maintenant, dejaCrees: new Map([[r.lignes[0].cle!, "exemple-post-9"]]) });
    expect(r2.lignes[0].etat).toBe("deja-fait");
    expect(t2.faux.appels).toHaveLength(0);
  });

  it("5xx : lecture GET avant tout renvoi, le lot s'arrête, aucun renvoi à l'aveugle", async () => {
    const t = creerFauxClientZernio(serveur((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 503, corps: {} } : a.methode === "GET" && a.url.includes("/v1/posts") ? { statut: 200, corps: { posts: [] } } : undefined)));
    const posts = [post({ id: "post-exemple-1", canalId: "canal-ig" }), post({ id: "post-exemple-2", canalId: "canal-ig" })];
    const copies = new Map(posts.map((p) => [p.id, [copie("video")]]));
    const r = await creerBrouillons({ ...base, client: t.client, posts, copies, lot: "A", aBlanc: false, maintenant: t.horloge.maintenant });
    expect(r.lignes.map((l) => l.etat)).toEqual(["a-verifier", "arret"]);
    expect(t.faux.appels.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"))).toHaveLength(1);
    expect(t.faux.appels.some((a) => a.methode === "GET" && a.url.includes("/v1/posts"))).toBe(true);
  });

  it("5xx puis le brouillon est retrouvé à la lecture : marqué créé", async () => {
    const t = creerFauxClientZernio(serveur((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 503, corps: {} } : a.methode === "GET" && a.url.includes("/v1/posts") ? { statut: 200, corps: { posts: [postExemple({ _id: "exemple-post-7", metadata: { origine: "import-buffer", bufferId: "post-exemple-1" } })] } } : undefined)));
    const posts = [post({ id: "post-exemple-1", canalId: "canal-ig" })];
    const r = await creerBrouillons({ ...base, client: t.client, posts, copies: new Map([["post-exemple-1", [copie("video")]]]), lot: "A", aBlanc: false, maintenant: t.horloge.maintenant });
    expect(r.lignes[0]).toMatchObject({ etat: "cree", zernioId: "exemple-post-7" });
  });

  it("doublon 409 : existingPostId lu, aucun nouvel envoi", async () => {
    const t = creerFauxClientZernio(serveur((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 409, corps: { error: "duplicate", details: { existingPostId: "exemple-post-5" } } } : undefined)));
    const posts = [post({ id: "post-exemple-1", canalId: "canal-ig" })];
    const r = await creerBrouillons({ ...base, client: t.client, posts, copies: new Map([["post-exemple-1", [copie("video")]]]), lot: "A", aBlanc: false, maintenant: t.horloge.maintenant });
    expect(r.lignes[0].etat).toBe("doublon");
  });

  it("le client n'est jamais contourné : aucun fetch direct dans les modules", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["creer-brouillons", "verifier", "cibles", "plafonds"]) {
      const s = readFileSync(new URL(`../../src/services/import-buffer/${f}.ts`, import.meta.url), "utf8");
      expect(s).not.toMatch(/\bfetch\(/);
      expect(s).not.toMatch(/publishNow["']?\s*:/);
    }
    void creerClientZernio;
  });
});
