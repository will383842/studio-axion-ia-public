import { describe, expect, it } from "vitest";
import { confirmerTable, ErreurCibles, proposerTable, validerLigne } from "../../src/services/import-buffer/cibles";
import { creerBrouillons, listerTousLesPosts } from "../../src/services/import-buffer/creer-brouillons";
import { ajouterCles, lireCles } from "../../src/services/import-buffer/journal";
import type { MediaCopie } from "../../src/services/import-buffer/medias-prives";
import type { PostBuffer } from "../../src/services/import-buffer/types";
import { comparerBrouillon } from "../../src/services/import-buffer/verifier";
import type { CorpsPostZernio } from "../../src/fournisseurs/publication/zernio-client";
import type { LecteurMedia } from "../../src/fournisseurs/publication/zernio-medias";
import { creerFauxClientZernio, postExemple, type AppelEnregistre, type ReponsePreparee } from "./aides/faux-zernio";

const MAINT = Date.parse("2026-11-01T08:00:00Z");
const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
const lecteur: LecteurMedia = async () => ({ corps: flux(), taille: 1 });
const urlLecture = async (cle: string) => `https://exemple-r2.test/${cle}`;
const post: PostBuffer = { id: "post-exemple-1", canalId: "canal-li", texte: "Texte d'exemple", dateUtc: "2026-11-05T10:00:00Z", statut: "scheduled", medias: [] };
const copie: MediaCopie = { rang: 0, type: "video", mime: "video/mp4", taille: 10, sha256: "0".repeat(64), cleStockage: "import-buffer/post-exemple/0.mp4" };
const tableProfil = confirmerTable(proposerTable([{ id: "canal-li", nom: "LI", service: "linkedin" }], { "canal-li": "exemple-compte-3:li:profil" }).table, "C'est juste", new Date(MAINT));
const serveur = (compte: Record<string, unknown>, suite: (a: AppelEnregistre) => ReponsePreparee | undefined = () => undefined) => (a: AppelEnregistre): ReponsePreparee => {
  const s = suite(a);
  if (s) return s;
  if (a.url.endsWith("/v1/accounts")) return { statut: 200, corps: { accounts: [{ _id: "exemple-compte-3", platform: "linkedin", ...compte }] } };
  if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
  if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
  if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
  return { statut: 404, corps: {} };
};

describe("IMP-3 · corrections de la relecture d'IMP-2", () => {
  it("1 · verifier : le texte attendu vient du corps envoyé, pas du post relu", () => {
    const corps: CorpsPostZernio = {
      content: "Texte d'exemple", isDraft: true, scheduledFor: "2026-11-05T10:00:00Z",
      platforms: [{ platform: "instagram", accountId: "exemple-compte-1", customContent: "Texte propre à la plateforme" }],
      metadata: { origine: "import-buffer", bufferId: "post-exemple-1" },
    };
    const lu = postExemple({ content: "Texte d'exemple", status: "draft", scheduledFor: "2026-11-05T10:00:00Z", platforms: [{ platform: "instagram", accountId: "exemple-compte-1", customContent: "Texte modifié chez Zernio" }], metadata: { origine: "import-buffer", bufferId: "post-exemple-1" } });
    const e = comparerBrouillon({ bufferId: "post-exemple-1", zernioId: "exemple-post-1", corps }, lu);
    expect(e.map((x) => x.champ)).toEqual(["texte"]);
    expect(e[0]).toMatchObject({ attendu: "Texte propre à la plateforme", lu: "Texte modifié chez Zernio" });
  });

  it("2 · profil LinkedIn prouvé par listerComptes() en mode réel ; refusé si le compte n'est pas un profil", async () => {
    const ok = creerFauxClientZernio(serveur({ accountType: "personal" }));
    const r = await creerBrouillons({ client: ok.client, table: tableProfil, posts: [post], copies: new Map([[post.id, [copie]]]), lot: "B", aBlanc: false, maintenant: ok.horloge.maintenant, urlLecture, lecteur });
    expect(r.lignes[0].etat).toBe("cree");
    expect(ok.faux.appels.some((a) => a.url.endsWith("/v1/accounts"))).toBe(true);
    const non = creerFauxClientZernio(serveur({ accountType: "organization" }));
    const r2 = await creerBrouillons({ client: non.client, table: tableProfil, posts: [post], copies: new Map([[post.id, [copie]]]), lot: "B", aBlanc: false, maintenant: non.horloge.maintenant, urlLecture, lecteur });
    expect(r2.lignes[0].etat).toBe("refuse");
    expect(non.faux.appels.filter((a) => a.methode === "POST")).toHaveLength(0);
  });

  it("3 · cibles : une ligne LinkedIn sans page ni profil est refusée dès validerLigne", () => {
    expect(() => validerLigne({ canalId: "c", reseau: "linkedin", cible: "exemple-compte-3" })).toThrow(ErreurCibles);
    expect(() => validerLigne({ canalId: "c", reseau: "linkedin", cible: "exemple-compte-3:li:123" })).not.toThrow();
    expect(() => validerLigne({ canalId: "c", reseau: "linkedin", cible: "exemple-compte-3:li:profil" })).not.toThrow();
    expect(() => validerLigne({ canalId: "c", reseau: "instagram", cible: "exemple-compte-3:li:profil" })).toThrow(ErreurCibles);
  });

  it("4 · journal des clés imp-… : lu, filtré, complété par les créations", () => {
    const cle = `imp-${"a".repeat(64)}`;
    const lu = lireCles({ [cle]: "exemple-post-1", "pas-une-cle": "x", [`imp-${"b".repeat(64)}`]: "pas valide !" });
    expect([...lu.keys()]).toEqual([cle]);
    const apres = ajouterCles(lu, [{ cle: `imp-${"c".repeat(64)}`, zernioId: "exemple-post-2", etat: "cree" }, { cle: `imp-${"d".repeat(64)}`, zernioId: "exemple-post-3", etat: "refuse" }]);
    expect(apres.size).toBe(2);
    expect(lu.size).toBe(1);
  });

  it("5 · après a-verifier, le brouillon est retrouvé sur la deuxième page", async () => {
    const autres = Array.from({ length: 100 }, (_, i) => postExemple({ _id: `exemple-autre-${i}`, metadata: { origine: "studio" } }));
    const cible = postExemple({ _id: "exemple-post-7", metadata: { origine: "import-buffer", bufferId: "post-exemple-1" } });
    const t = creerFauxClientZernio(serveur({}, (a) => {
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 503, corps: {} };
      if (a.methode === "GET" && a.url.includes("/v1/posts")) return { statut: 200, corps: { posts: new URL(a.url).searchParams.get("page") === "2" ? [cible] : autres } };
      return undefined;
    }));
    const table = confirmerTable(proposerTable([{ id: "canal-li", nom: "LI", service: "linkedin" }], { "canal-li": "exemple-compte-3:li:123" }).table, "C'est juste", new Date(MAINT));
    const r = await creerBrouillons({ client: t.client, table, posts: [post], copies: new Map([[post.id, [copie]]]), lot: "B", aBlanc: false, maintenant: t.horloge.maintenant, urlLecture, lecteur });
    expect(r.lignes[0]).toMatchObject({ etat: "cree", zernioId: "exemple-post-7" });
  });

  it("5 bis · listerTousLesPosts s'arrête quand une page n'apporte rien de neuf", async () => {
    const t = creerFauxClientZernio(() => ({ statut: 200, corps: { posts: [postExemple({ _id: "exemple-post-1" })] } }));
    expect(await listerTousLesPosts(t.client, "draft", 1)).toHaveLength(1);
    expect(t.faux.appels.length).toBeLessThanOrEqual(2);
  });
});
