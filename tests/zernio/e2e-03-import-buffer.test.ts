/**
 * E2E-3 · import des posts Buffer à venir : lecture Buffer SIMULÉE (aucune clé, aucun réseau), création Zernio simulée.
 * Mode à blanc (option --creer absente) = rien n'est créé ; le brouillon de test du 31/10 est exclu ; aucun post Buffer supprimé.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { confirmerTable, proposerTable } from "../../src/services/import-buffer/cibles";
import { creerBrouillons } from "../../src/services/import-buffer/creer-brouillons";
import { estVideoTest, filtrerPostsAVenir } from "../../src/services/import-buffer/exclusions";
import { creerClientLecture, lireBuffer } from "../../src/services/import-buffer/lire-buffer";
import type { MediaCopie } from "../../src/services/import-buffer/medias-prives";
import { retirerJumeaux } from "../../src/services/import-buffer/retrait-jumeau";
import type { PostBuffer } from "../../src/services/import-buffer/types";
import { creerFauxClientZernio, postExemple } from "./aides/faux-zernio";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/buffer-a-venir-fictif.json", import.meta.url), "utf8")).data;
const MAINT = Date.parse("2026-11-02T08:00:00Z");
const CANAUX = [
  { id: "canal-exemple-1", nom: "Exemple IG", service: "instagram" },
  { id: "canal-exemple-2", nom: "Exemple LI", service: "linkedin" },
];
const CHOIX = { "canal-exemple-1": "exemple-compte-1", "canal-exemple-2": "exemple-compte-3:li:123" };
const CONFIRMEE = confirmerTable(proposerTable(CANAUX, CHOIX).table, "C'est juste", new Date(MAINT));
const urlLecture = async (cle: string) => `https://exemple-r2.test/${cle}`;

const copie = (type: MediaCopie["type"], rang = 0, p: Partial<MediaCopie> = {}): MediaCopie => ({
  rang, type, mime: type === "video" ? "video/mp4" : type === "document" ? "application/pdf" : "image/jpeg", taille: 10, sha256: "0".repeat(64),
  cleStockage: `import-buffer/post-exemple/${rang}.${type === "video" ? "mp4" : type === "document" ? "pdf" : "jpg"}`, ...p,
});

/** Lecture Buffer SIMULÉE depuis la fixture ; enregistre toutes les requêtes envoyées (pour prouver « lecture seule »). */
async function lireBufferSimule() {
  const requetes: string[] = [];
  const appeler = vi.fn(async (_u: unknown, init?: RequestInit) => {
    const q = JSON.parse(String(init?.body)).query as string;
    requetes.push(q);
    const data = q.includes("Compte") ? { account: FIXTURE.account } : q.includes("Canaux") ? { channels: FIXTURE.channels } : { posts: FIXTURE.posts };
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  const client = creerClientLecture("exemple-cle-fictive-ne-pas-utiliser-0401", { appeler: appeler as unknown as typeof fetch });
  const lu = await lireBuffer(client, { depuis: "2026-11-02T00:00:00Z" });
  return { lu, requetes, appeler };
}
const copiesDe = (posts: PostBuffer[]) => new Map<string, MediaCopie[]>(posts.map((p) => [p.id, p.medias.map((m, i) => copie(m.type as MediaCopie["type"], i, { texteAlternatif: m.texteAlternatif, titre: m.titre }))]));
const base = { table: CONFIRMEE, maintenant: () => MAINT, urlLecture };

describe("e2e-3 · import des posts Buffer à venir : mode à blanc", () => {
  it("sans --creer (aBlanc non précisé) : corps construits, AUCUN appel Zernio, aucune écriture", async () => {
    const { lu } = await lireBufferSimule();
    const { client, faux } = creerFauxClientZernio(() => {
      throw new Error("aucun appel réseau permis à blanc");
    });
    const r = await creerBrouillons({ ...base, client, posts: lu.posts, copies: copiesDe(lu.posts), lot: "D" });
    expect(r.aBlanc).toBe(true);
    expect(faux.appels).toHaveLength(0);
    expect(r.lignes.filter((l) => l.etat === "cree")).toHaveLength(0);
    expect(r.lignes.filter((l) => l.zernioId)).toHaveLength(0);
    const etats = Object.fromEntries(r.lignes.map((l) => [l.bufferId, l.etat]));
    expect(etats["post-exemple-01"]).toBe("a-blanc");
    expect(etats["post-exemple-02"]).toBe("a-blanc");
  });

  it("à blanc : les corps sont des BROUILLONS (isDraft) marqués import-buffer, jamais de publication immédiate", async () => {
    const { lu } = await lireBufferSimule();
    const { client } = creerFauxClientZernio([]);
    const r = await creerBrouillons({ ...base, client, posts: lu.posts, copies: copiesDe(lu.posts), lot: "D" });
    expect(r.corps.size).toBeGreaterThan(0);
    for (const [id, corps] of r.corps) {
      expect(corps.isDraft).toBe(true);
      expect(corps.metadata).toMatchObject({ origine: "import-buffer", bufferId: id });
      expect(JSON.stringify(corps)).not.toMatch(/publishNow/);
    }
  });

  it("aBlanc: undefined et aBlanc: true se comportent pareil ; seul aBlanc: false (--creer) peut écrire", async () => {
    const { lu } = await lireBufferSimule();
    for (const aBlanc of [undefined, true]) {
      const { client, faux } = creerFauxClientZernio([]);
      const r = await creerBrouillons({ ...base, client, posts: lu.posts, copies: copiesDe(lu.posts), lot: "D", ...(aBlanc === undefined ? {} : { aBlanc }) });
      expect(r.aBlanc).toBe(true);
      expect(faux.appels).toHaveLength(0);
    }
    // Création réelle sans table confirmée : refusée avant tout appel.
    const { client, faux } = creerFauxClientZernio([]);
    await expect(creerBrouillons({ ...base, client, table: proposerTable(CANAUX, CHOIX).table, posts: lu.posts, copies: copiesDe(lu.posts), lot: "D", aBlanc: false })).rejects.toThrow(/pas confirmée/);
    expect(faux.appels).toHaveLength(0);
  });

  it("l'outil en ligne de commande : la création exige --creer ET n'est jamais active avec --a-blanc", () => {
    const source = readFileSync(new URL("../../outils/import-buffer/brouillons.mts", import.meta.url), "utf8");
    expect(source).toMatch(/const veutCreer = args\.includes\("--creer"\) && !args\.includes\("--a-blanc"\);/);
    expect(source).toMatch(/const aBlanc = !veutCreer;/);
    expect(source).toMatch(/if \(veutCreer && !estConfirmee\(table\)\) throw/);
    expect(source).toMatch(/\baBlanc\b,/); // transmis à creerBrouillons
  });
});

describe("e2e-3 · exclusions : le brouillon de test du 31/10 n'est pas importé", () => {
  const brouillonTest31: PostBuffer = {
    id: "post-test-31", canalId: "canal-exemple-2", texte: "Vidéo de test exemple", dateUtc: "2026-10-31T10:00:00Z", statut: "draft",
    medias: [{ type: "video", mime: "video/mp4", source: "https://exemple.invalid/t.mp4" } as never],
  };

  it("un brouillon LinkedIn contenant une vidéo daté du 31/10 est reconnu comme test et exclu", () => {
    expect(estVideoTest(brouillonTest31)).toBe(true);
    const { retenus, exclus } = filtrerPostsAVenir([brouillonTest31], new Date("2026-10-30T08:00:00Z"));
    expect(retenus).toHaveLength(0);
    expect(exclus).toEqual([{ id: "post-test-31", raison: "video-test-31-10" }]);
  });

  it("dans le lot : le brouillon de test ne donne ni corps ni création, même avec un jumeau possible", async () => {
    const { lu } = await lireBufferSimule();
    const posts = [...lu.posts, brouillonTest31];
    const { client, faux } = creerFauxClientZernio([]);
    const copies = copiesDe(posts);
    copies.set("post-test-31", [copie("video")]);
    const r = await creerBrouillons({ ...base, maintenant: () => Date.parse("2026-10-30T08:00:00Z"), client, posts, copies, lot: "B" });
    const ligne = r.lignes.find((l) => l.bufferId === "post-test-31")!;
    expect(ligne.etat).toBe("reste-buffer");
    expect(ligne.raison).toMatch(/video-test-31-10/);
    expect(r.corps.has("post-test-31")).toBe(false);
    expect(faux.appels).toHaveLength(0);
  });

  it("la vidéo de test de la fixture (Instagram, 31/10), les posts envoyés et les posts passés sont aussi exclus", async () => {
    const { lu } = await lireBufferSimule();
    const { client } = creerFauxClientZernio([]);
    const r = await creerBrouillons({ ...base, client, posts: lu.posts, copies: copiesDe(lu.posts), lot: "D" });
    const raison = (id: string) => r.lignes.find((l) => l.bufferId === id)?.raison ?? "";
    expect(raison("post-exemple-03")).toMatch(/video-test-31-10/);
    expect(raison("post-exemple-04")).toMatch(/envoye/);
    expect(raison("post-exemple-05")).toMatch(/passe/);
    for (const id of ["post-exemple-03", "post-exemple-04", "post-exemple-05"]) expect(r.corps.has(id)).toBe(false);
  });
});

describe("e2e-3 · aucun post Buffer n'est supprimé ni modifié", () => {
  it("la lecture n'envoie que des requêtes de lecture (aucune « mutation ») et refuse d'en envoyer", async () => {
    const { requetes, appeler } = await lireBufferSimule();
    expect(requetes.length).toBeGreaterThan(0);
    expect(requetes.every((q) => !/mutation|delete|remove/i.test(q))).toBe(true);
    const client = creerClientLecture("exemple-cle-fictive-ne-pas-utiliser-0402", { appeler: appeler as unknown as typeof fetch });
    const avant = appeler.mock.calls.length;
    await expect(client.lire("mutation Supprimer { deletePost(id: \"x\") { id } }")).rejects.toMatchObject({ code: "ecriture-refusee" });
    expect(appeler.mock.calls.length).toBe(avant);
  });

  it("côté Zernio, le client à liste fermée refuse toute suppression de post (DELETE)", async () => {
    const { client, faux } = creerFauxClientZernio([]);
    await expect(client.requete({ methode: "DELETE", chemin: "/v1/posts/exemple-post-1" })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });

  it("retrait du jumeau sans confirmation : seulement une LISTE à la main, aucune écriture, rien de supprimé", async () => {
    const { lu } = await lireBufferSimule();
    const aVenir = lu.posts.filter((p) => p.statut === "scheduled");
    const jumeaux = aVenir.map((p, i) => postExemple({
      _id: `exemple-jumeau-${i}`, status: "draft", content: p.texte, scheduledFor: p.dateUtc, mediaItems: p.medias.map(() => ({ type: "image", url: "https://exemple-cdn.test/m/x.png" })) as never,
      metadata: { origine: "import-buffer", bufferId: p.id, studioCle: "imp-x" },
    }));
    const t = creerFauxClientZernio((a) => {
      if (a.methode === "GET" && /\/v1\/posts\/exemple-jumeau-\d$/.test(a.url)) return { statut: 200, corps: { post: jumeaux.find((j) => a.url.endsWith(j._id)) } };
      if (a.methode === "GET") return { statut: 200, corps: { posts: jumeaux, pagination: { page: 1, pages: 1 } } };
      return { statut: 500, corps: {} };
    });
    const passerEnBrouillon = vi.fn(async () => ({ ok: true }));
    const r = await retirerJumeaux({ client: t.client, posts: aVenir, passerEnBrouillon }); // confirmerRetrait absent
    expect(passerEnBrouillon).not.toHaveBeenCalled();
    expect(r.lignes.every((l) => l.etat === "a-retirer-a-la-main" || l.etat === "jumeau-different" || l.etat === "sans-jumeau")).toBe(true);
    expect(r.liste.every((l) => /jamais à supprimer/.test(l.raison ?? ""))).toBe(true);
    expect(t.faux.appels.every((a) => a.methode === "GET")).toBe(true);
  });
});
