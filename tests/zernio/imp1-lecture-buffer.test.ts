import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { clientDepuisEnv, contientEcriture, creerClientLecture, lireBuffer, normaliserPost } from "../../src/services/import-buffer/lire-buffer";
import { REQUETE_CANAUX, REQUETE_COMPTE, REQUETE_POSTS_A_VENIR, REQUETE_POSTS_ENVOYES_STATS } from "../../src/services/import-buffer/requetes-lecture";
import { ErreurLectureBuffer } from "../../src/services/import-buffer/types";

const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/buffer-a-venir-fictif.json", import.meta.url), "utf8")).data;
const CLE = "cle-exemple-secrete";

function faux(corps: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(corps), { status, headers: { "content-type": "application/json" } }));
}

describe("IMP-1 troncature de la lecture", () => {
  it("drapeau tronque quand hasNextPage reste vrai au dernier tour", async () => {
    const client = {
      async lire(q: string) {
        if (q === REQUETE_COMPTE) return { account: { organizations: [{ id: "org-exemple" }] } };
        if (q === REQUETE_CANAUX) return { channels: [] };
        return { posts: { edges: [], pageInfo: { hasNextPage: true, endCursor: "suite" } } };
      },
    };
    expect((await lireBuffer(client, { depuis: "2026-11-01T00:00:00Z", pagesMax: 2 })).tronque).toBe(true);
    const fini = { lire: async (q: string) => (q === REQUETE_COMPTE ? { account: { organizations: [{ id: "o" }] } } : q === REQUETE_CANAUX ? { channels: [] } : { posts: { edges: [], pageInfo: { hasNextPage: false } } }) };
    expect((await lireBuffer(fini, { depuis: "2026-11-01T00:00:00Z", pagesMax: 2 })).tronque).toBe(false);
  });
});

describe("IMP-1 client de lecture seule", () => {
  it("refuse toute requête contenant « mutation » AVANT l'envoi", async () => {
    const appeler = faux({ data: {} });
    const client = creerClientLecture(CLE, { appeler: appeler as unknown as typeof fetch });
    for (const q of ["mutation X { a }", "MUTATION X { a }", "query { a } # Mutation"]) {
      await expect(client.lire(q)).rejects.toMatchObject({ code: "ecriture-refusee" });
    }
    expect(appeler).not.toHaveBeenCalled();
    expect(contientEcriture("query { a }")).toBe(false);
  });

  it("aucune requête du module ne contient une écriture", () => {
    for (const q of [REQUETE_COMPTE, REQUETE_CANAUX, REQUETE_POSTS_A_VENIR, REQUETE_POSTS_ENVOYES_STATS]) expect(contientEcriture(q)).toBe(false);
  });

  it("la clé manquante est signalée sans la révéler ; la clé n'apparaît jamais dans une erreur", async () => {
    expect(() => clientDepuisEnv({})).toThrow(ErreurLectureBuffer);
    const client = creerClientLecture(CLE, { appeler: faux({ errors: [{ message: `refus avec ${CLE}` }] }) as unknown as typeof fetch });
    const e = await client.lire("query { a }").catch((x) => x as Error);
    expect(String(e.message)).not.toContain(CLE);
    const refuse = creerClientLecture(CLE, { appeler: faux({}, 401) as unknown as typeof fetch });
    const e2 = await refuse.lire("query { a }").catch((x) => x as Error);
    expect(e2).toMatchObject({ code: "refuse" });
    expect(String(e2.message)).not.toContain(CLE);
  });

  it("lit canaux et posts, normalise médias, texte alternatif, document, commentaire et lien", async () => {
    const appeler = vi.fn(async (_u: unknown, init?: RequestInit) => {
      const q = JSON.parse(String(init?.body)).query as string;
      const data = q.includes("Compte") ? { account: FIXTURE.account } : q.includes("Canaux") ? { channels: FIXTURE.channels } : { posts: FIXTURE.posts };
      return new Response(JSON.stringify({ data }), { status: 200 });
    });
    const client = creerClientLecture(CLE, { appeler: appeler as unknown as typeof fetch });
    const lu = await lireBuffer(client, { depuis: "2026-11-01T00:00:00Z" });
    expect(lu.canaux.map((c) => c.id)).toEqual(["canal-exemple-1", "canal-exemple-2"]);
    expect(lu.posts).toHaveLength(5);
    const p1 = lu.posts[0];
    expect(p1).toMatchObject({ id: "post-exemple-01", canalId: "canal-exemple-1", statut: "scheduled", dateUtc: "2026-11-06T09:00:00.000Z", premierCommentaire: "Premier commentaire exemple" });
    expect(p1.medias[0]).toMatchObject({ type: "image", texteAlternatif: "Image exemple" });
    const p2 = lu.posts[1];
    expect(p2.medias[0]).toMatchObject({ type: "document", titre: "Titre de document exemple", tailleAnnoncee: 1200 });
    expect(p2.lienJoint).toEqual({ url: "https://exemple.invalid/page", titre: "Lien exemple" });
    for (const [, init] of appeler.mock.calls) expect(JSON.parse(String((init as RequestInit).body)).query).not.toMatch(/mutation/i);
  });

  it("normaliserPost tolère les champs absents", () => {
    expect(normaliserPost({ id: "x" })).toMatchObject({ id: "x", texte: "", medias: [], statut: "inconnu" });
  });
});
