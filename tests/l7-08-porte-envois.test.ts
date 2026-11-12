/** L7-08 : la porte « publication éditoriale » est lue par TOUS les chemins d'envoi du calendrier. Réglage absent = zéro appel au diffuseur. */
import { beforeEach, describe, expect, it } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } from "@/services/zernio";
import { confirmerTable, proposerTable } from "@/services/import-buffer/cibles";
import { creerBrouillons } from "@/services/import-buffer/creer-brouillons";
import { promouvoirBrouillons } from "@/services/import-buffer/promotion";
import type { PostBuffer } from "@/services/import-buffer/types";
import { creerClientZernio } from "@/fournisseurs/publication/zernio-client";
import { envoiAutoriseCalendrierClient } from "@/fournisseurs/publication/inscription";
import { creerFauxClientZernio, creerFauxFetch, postExemple } from "./zernio/aides/faux-zernio";

const MAINT = Date.parse("2026-11-01T08:00:00Z");
const TABLE = confirmerTable(proposerTable([{ id: "canal-ig", nom: "Exemple IG", service: "instagram" }], { "canal-ig": "exemple-compte-1" }).table, "C'est juste", new Date(MAINT));
const post: PostBuffer = { id: "post-exemple-1", canalId: "canal-ig", texte: "Texte d'exemple", dateUtc: "2026-11-05T10:00:00Z", statut: "scheduled", medias: [] };

const regler = async (ancien: boolean | undefined, calendrier: boolean | undefined, editoriale: boolean | undefined) => {
  if (ancien !== undefined) await ecrireParametre(PARAM_ARRET_ZERNIO, ancien);
  if (calendrier !== undefined) await ecrireParametre(PARAM_ENVOI_CALENDRIER, calendrier);
  if (editoriale !== undefined) await ecrireParametre(PARAM_EDITORIALE_ACTIVE, editoriale);
};
const FERMES: [string, boolean | undefined, boolean | undefined, boolean | undefined][] = [
  ["réglage éditorial absent", true, true, undefined],
  ["réglage éditorial éteint", true, true, false],
  ["calendrier fermé", true, false, true],
  ["envoi général coupé", false, true, true],
];

beforeEach(() => reinitialiserDepots());

describe("L7-08 : réglage absent ou éteint = aucun appel au diffuseur", () => {
  it.each(FERMES)("création de brouillons (%s)", async (_n, a, c, e) => {
    await regler(a, c, e);
    const { client, faux } = creerFauxClientZernio([]);
    const r = await creerBrouillons({ client, table: TABLE, posts: [post], copies: new Map(), lot: "A", aBlanc: false, maintenant: () => MAINT, urlLecture: async (cle) => `https://exemple-r2.test/${cle}`, lecteur: async () => { throw new Error("aucune lecture attendue"); } });
    expect(r.refusLot).toMatch(/fermée/);
    expect(faux.appels).toHaveLength(0);
  });

  it.each(FERMES)("promotion (%s)", async (_n, a, c, e) => {
    await regler(a, c, e);
    const { client, faux } = creerFauxClientZernio([]);
    const r = await promouvoirBrouillons({ client, postsBuffer: [], aBlanc: false, maintenant: () => MAINT });
    expect(r.refusLot).toMatch(/fermée/);
    expect(faux.appels).toHaveLength(0);
  });

  it.each(FERMES)("client du fournisseur de publication (%s) : écriture refusée avant tout fetch", async (_n, a, c, e) => {
    await regler(a, c, e);
    const faux = creerFauxFetch([{ statut: 201, corps: { post: { _id: "exemple-post-1" } } }]);
    const client = creerClientZernio({ cle: "exemple-cle-fictive-ne-pas-utiliser-0001", fetch: faux.fetch, envoiAutorise: envoiAutoriseCalendrierClient });
    const corps = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
    await expect(client.requete({ methode: "POST", chemin: "/v1/posts", corps, idempotence: `studio-${"c".repeat(64)}` })).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
  });
});

describe("L7-08 : réglage allumé = l'appel a lieu", () => {
  it("création de brouillons : le diffuseur est appelé", async () => {
    await regler(true, true, true);
    const { client, faux } = creerFauxClientZernio((a) => {
      if (a.url.endsWith("/v1/media/presign")) return { statut: 200, corps: { uploadUrl: "https://exemple-stockage.test/depot/x", publicUrl: "https://exemple-cdn.test/m/x.mp4" } };
      if (a.url.startsWith("https://exemple-stockage.test")) return { statut: 200, corps: {} };
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) return { statut: 201, corps: { post: postExemple({ _id: "exemple-post-9" }) } };
      return { statut: 404, corps: {} };
    });
    const copie = { rang: 0, type: "video" as const, mime: "video/mp4", taille: 10, sha256: "0".repeat(64), cleStockage: "import-buffer/post-exemple/0.mp4" };
    const flux = () => new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1])); c.close(); } });
    const r = await creerBrouillons({ client, table: TABLE, posts: [post], copies: new Map([[post.id, [copie]]]), lot: "A", aBlanc: false, maintenant: () => MAINT, urlLecture: async (cle) => `https://exemple-r2.test/${cle}`, lecteur: async () => ({ corps: flux(), taille: 1 }) });
    expect(r.refusLot).toBeUndefined();
    expect(faux.appels.length).toBeGreaterThan(0);
  });

  it("promotion : la lecture des brouillons a lieu", async () => {
    await regler(true, true, true);
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { posts: [] } }));
    const r = await promouvoirBrouillons({ client, postsBuffer: [], aBlanc: false, maintenant: () => MAINT });
    expect(r.refusLot).toBeUndefined();
    expect(faux.appels.length).toBeGreaterThan(0);
  });

  it("client du fournisseur de publication : l'écriture part", async () => {
    await regler(true, true, true);
    const faux = creerFauxFetch([{ statut: 201, corps: { post: { _id: "exemple-post-1", status: "draft", platforms: [] } } }]);
    const client = creerClientZernio({ cle: "exemple-cle-fictive-ne-pas-utiliser-0001", fetch: faux.fetch, envoiAutorise: envoiAutoriseCalendrierClient });
    const corps = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
    await client.requete({ methode: "POST", chemin: "/v1/posts", corps, idempotence: `studio-${"c".repeat(64)}` });
    expect(faux.appels.length).toBeGreaterThan(0);
  });
});
