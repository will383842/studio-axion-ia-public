import { describe, expect, it, vi } from "vitest";
import { creerFauxClientZernio, J, MOT_INTERDIT, postExemple, type ReponsePreparee } from "./aides/faux-zernio";

const CLE_J = "studio-exemple-cle-journal";
const DATE = "2026-11-03T10:00:00Z"; // horloge fictive : 2026-11-01T08:00:00Z
const brouillon = (partiel = {}) => ({ statut: 200, corps: { post: postExemple({ metadata: { origine: "studio", studioCle: CLE_J }, ...partiel }) } });
const programme = (scheduledFor = "2026-11-03T10:00:00.000Z", status = "scheduled") => ({ statut: 200, corps: { post: postExemple({ status, scheduledFor }) } });
const OK_PUT: ReponsePreparee = { statut: 200, corps: { post: postExemple() } };

describe("z1c · promotion D5 complète", () => {
  it("chemin nominal : GET avant, PUT au corps strict, GET après", async () => {
    const { client, faux } = creerFauxClientZernio([brouillon(), OK_PUT, programme()]);
    const r = await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE });
    expect(r.etat).toBe("programme");
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET", "PUT", "GET"]);
    expect(faux.appels[1].json).toStrictEqual({ isDraft: false, scheduledFor: "2026-11-03T10:00:00Z" });
    expect((faux.appels[1].json as { scheduledFor: string }).scheduledFor.endsWith("Z")).toBe(true);
  });

  it("date du journal reprise à la seconde ; une fraction non nulle est refusée (jamais d'arrondi)", async () => {
    const { client, faux } = creerFauxClientZernio([brouillon(), OK_PUT, programme("2026-11-03T10:00:07Z")]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: "2026-11-03T10:00:07.000Z" })).etat).toBe("programme");
    expect((faux.appels[1].json as { scheduledFor: string }).scheduledFor).toBe("2026-11-03T10:00:07Z");
    const r = await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: "2026-11-03T10:00:07.400Z" });
    expect(r.etat).toBe("refuse");
    expect(faux.appels).toHaveLength(3);
  });

  it.each([
    ["date passée", "2026-11-01T07:00:00Z"],
    ["date à moins de 30 min", "2026-11-01T08:29:00Z"],
  ])("%s : aucun PUT, à reprogrammer par vous", async (_nom, date) => {
    const { client, faux } = creerFauxClientZernio([brouillon()]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: date })).etat).toBe("a-reprogrammer");
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(0);
  });

  it("date qui devient trop proche pendant le re-téléversement : aucun PUT de promotion", async () => {
    const { client, faux, horloge } = creerFauxClientZernio([brouillon(), OK_PUT]);
    const r = await client.promouvoir({
      postId: "exemple-post-1",
      cleJournal: CLE_J,
      dateJournal: "2026-11-01T09:00:00Z",
      medias: {
        televerseLe: "2026-10-20T08:00:00Z",
        reteleverser: async () => {
          horloge.avancer(40 * 60_000);
          return [{ type: "image", url: "https://media.exemple/neuf.jpg" }];
        },
      },
    });
    expect(r.etat).toBe("a-reprogrammer");
    expect(faux.appels.filter((a) => a.methode === "PUT").map((a) => a.json)).toEqual([{ mediaItems: [{ type: "image", url: "https://media.exemple/neuf.jpg" }] }]);
  });

  it.each([
    ["statut autre que draft", { status: "scheduled" }],
    ["origine inconnue", { metadata: { origine: "autre", studioCle: CLE_J } }],
    ["sans métadonnées", { metadata: undefined }],
    ["clé différente", { metadata: { origine: "studio", studioCle: "studio-autre" } }],
    ["mot interdit dans le contenu relu", { content: `Bravo ${MOT_INTERDIT}` }],
    ["mot interdit dans un champ secondaire relu", { platforms: [{ platform: "instagram", accountId: "x", customContent: J("Quali", "opi") }] }],
  ])("GET avant non conforme (%s) : aucun PUT", async (_nom, partiel) => {
    const { client, faux } = creerFauxClientZernio([brouillon(partiel)]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE })).etat).toBe("refuse");
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET"]);
  });

  it("origine import-buffer acceptée", async () => {
    const { client } = creerFauxClientZernio([brouillon({ metadata: { origine: "import-buffer", studioCle: CLE_J } }), OK_PUT, programme()]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE })).etat).toBe("programme");
  });

  it("réponse 200 trompeuse : le GET après lit encore draft → à vérifier, alerte, aucun second PUT", async () => {
    const { client, faux, journal } = creerFauxClientZernio([brouillon(), OK_PUT, programme("2026-11-03T10:00:00Z", "draft")]);
    const r = await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE });
    expect(r.etat).toBe("a-verifier");
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(1);
    expect(journal.lignes.some((l) => l.startsWith("alerte") && l.includes("à vérifier"))).toBe(true);
  });

  it("GET après avec une autre date : à vérifier", async () => {
    const { client } = creerFauxClientZernio([brouillon(), OK_PUT, programme("2026-11-03T10:01:00Z")]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE })).etat).toBe("a-verifier");
  });

  it("PUT en 5xx : à vérifier, aucun nouvel essai", async () => {
    const { client, faux } = creerFauxClientZernio([brouillon(), { statut: 502 }]);
    expect((await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE })).etat).toBe("a-verifier");
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET", "PUT"]);
  });

  it("média de plus de 6 jours : nouveau téléversement, PUT { mediaItems } seul, puis promotion", async () => {
    const reteleverser = vi.fn(async () => [{ type: "video", url: "https://media.exemple/neuf.mp4" }]);
    const { client, faux } = creerFauxClientZernio([brouillon(), OK_PUT, OK_PUT, programme()]);
    const r = await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE, medias: { televerseLe: "2026-10-25T07:59:00Z", reteleverser } });
    expect(r).toMatchObject({ etat: "programme", mediasRemplaces: true });
    expect(reteleverser).toHaveBeenCalledTimes(1);
    const puts = faux.appels.filter((a) => a.methode === "PUT").map((a) => a.json);
    expect(puts).toStrictEqual([{ mediaItems: [{ type: "video", url: "https://media.exemple/neuf.mp4" }] }, { isDraft: false, scheduledFor: "2026-11-03T10:00:00Z" }]);
  });

  it("média de 6 jours ou moins : aucun remplacement", async () => {
    const reteleverser = vi.fn(async () => []);
    const { client, faux } = creerFauxClientZernio([brouillon(), OK_PUT, programme()]);
    await client.promouvoir({ postId: "exemple-post-1", cleJournal: CLE_J, dateJournal: DATE, medias: { televerseLe: "2026-10-27T08:00:00Z", reteleverser } });
    expect(reteleverser).not.toHaveBeenCalled();
    expect(faux.appels.filter((a) => a.methode === "PUT")).toHaveLength(1);
  });

  it("médias re-téléversés porteurs d'un mot interdit : refus avant le réseau, aucune promotion", async () => {
    const { client, faux } = creerFauxClientZernio([brouillon()]);
    const p = client.promouvoir({
      postId: "exemple-post-1",
      cleJournal: CLE_J,
      dateJournal: DATE,
      medias: { televerseLe: "2026-10-01T00:00:00Z", reteleverser: async () => [{ type: "image", url: "https://media.exemple/a.jpg", altText: MOT_INTERDIT }] },
    });
    await expect(p).rejects.toMatchObject({ code: "mot-interdit" });
    expect(faux.appels.map((a) => a.methode)).toEqual(["GET"]);
  });
});
