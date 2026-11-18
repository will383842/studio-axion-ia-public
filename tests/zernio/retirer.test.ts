import { describe, expect, it } from "vitest";
import { CLE_FICTIVE, creerFauxClientZernio, postExemple, type ReponsePreparee } from "./aides/faux-zernio";

const CLE_J = "studio-exemple-cle-journal";
const ID = "exemple-post-1";
const post = (partiel = {}) => ({ statut: 200, corps: { post: postExemple({ status: "scheduled", scheduledFor: "2026-11-03T10:00:00Z", metadata: { origine: "studio", studioCle: CLE_J }, ...partiel }) } });
const INTROUVABLE: ReponsePreparee = { statut: 404, corps: { error: "not found" } };
const OK_DELETE: ReponsePreparee = { statut: 200, corps: {} };
const methodes = (faux: { appels: { methode: string }[] }) => faux.appels.map((a) => a.methode);

describe("retirer() · lecture avant, suppression, relecture après", () => {
  it("chemin nominal : GET, DELETE sans corps, GET (introuvable) → retire", async () => {
    const { client, faux } = creerFauxClientZernio([post(), OK_DELETE, INTROUVABLE]);
    const r = await client.retirer({ postId: ID, cleJournal: CLE_J });
    expect(r.etat).toBe("retire");
    expect(methodes(faux)).toEqual(["GET", "DELETE", "GET"]);
    expect(faux.appels[1].url).toMatch(/\/v1\/posts\/exemple-post-1$/);
    expect(faux.appels[1].corps).toBeUndefined();
  });

  it("brouillon accepté ; relecture « cancelled » → retire", async () => {
    const annule = post({ status: "cancelled" });
    const { client } = creerFauxClientZernio([post({ status: "draft" }), OK_DELETE, annule]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("retire");
  });

  it.each([
    ["déjà publié", { status: "published" }, /statut published/],
    ["en cours de publication", { status: "publishing" }, /statut publishing/],
    ["origine inconnue", { metadata: { origine: "autre", studioCle: CLE_J } }, /pas à nous/],
    ["sans métadonnées", { metadata: undefined }, /pas à nous/],
    ["clé différente", { metadata: { origine: "studio", studioCle: "studio-autre" } }, /clé du post/],
  ])("garde avant (%s) : refuse, aucun DELETE", async (_n, partiel, raison) => {
    const { client, faux } = creerFauxClientZernio([post(partiel)]);
    expect(await client.retirer({ postId: ID, cleJournal: CLE_J })).toMatchObject({ etat: "refuse", raison: expect.stringMatching(raison) });
    expect(methodes(faux)).toEqual(["GET"]);
  });

  it.each([
    ["date passée", "2026-10-31T10:00:00Z"],
    ["à 10 min", "2026-11-01T08:10:00Z"],
    ["juste sous la marge de 30 min", "2026-11-01T08:29:59Z"],
  ])("programmé, %s : a-verifier (il peut partir), aucun DELETE", async (_n, scheduledFor) => {
    const { client, faux } = creerFauxClientZernio([post({ scheduledFor })]);
    expect(await client.retirer({ postId: ID, cleJournal: CLE_J })).toMatchObject({ etat: "a-verifier", raison: expect.stringMatching(/30 min/) });
    expect(methodes(faux)).toEqual(["GET"]);
  });

  it("programmé à exactement 30 min : accepté (même bord que promouvoir)", async () => {
    const { client } = creerFauxClientZernio([post({ scheduledFor: "2026-11-01T08:30:00Z" }), OK_DELETE, INTROUVABLE]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("retire");
  });

  it.each([
    ["absente", { scheduledFor: undefined }],
    ["illisible", { scheduledFor: "pas-une-date" }],
  ])("programmé, date %s : refuse, aucun DELETE", async (_n, partiel) => {
    const { client, faux } = creerFauxClientZernio([post(partiel)]);
    expect(await client.retirer({ postId: ID, cleJournal: CLE_J })).toMatchObject({ etat: "refuse", raison: expect.stringMatching(/illisible/) });
    expect(methodes(faux)).toEqual(["GET"]);
  });

  it("brouillon avec une date passée : accepté (rien ne part d'un brouillon)", async () => {
    const { client } = creerFauxClientZernio([post({ status: "draft", scheduledFor: "2026-10-01T10:00:00Z" }), OK_DELETE, INTROUVABLE]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("retire");
  });

  it.each([
    ["publiée", "published"],
    ["en cours de publication", "publishing"],
    ["en échec partiel", "failed"],
    ["statut inconnu", "autre"],
  ])("une plateforme %s sur deux : refuse « déjà en ligne », aucun DELETE", async (_n, statut) => {
    const platforms = [
      { platform: "instagram", accountId: "c1", status: "pending" },
      { platform: "facebook", accountId: "c2", status: statut },
    ];
    const { client, faux } = creerFauxClientZernio([post({ platforms })]);
    expect(await client.retirer({ postId: ID, cleJournal: CLE_J })).toMatchObject({ etat: "refuse", raison: expect.stringMatching(/déjà en ligne sur au moins un réseau/) });
    expect(methodes(faux)).toEqual(["GET"]);
  });

  it("plateforme sans statut : refuse, aucun DELETE", async () => {
    const { client, faux } = creerFauxClientZernio([post({ platforms: [{ platform: "instagram", accountId: "c1" }] })]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("refuse");
    expect(methodes(faux)).toEqual(["GET"]);
  });

  it.each(["draft", "scheduled", "pending"])("plateformes au statut %s : acceptées", async (statut) => {
    const { client } = creerFauxClientZernio([post({ platforms: [{ platform: "instagram", accountId: "c1", status: statut }] }), OK_DELETE, INTROUVABLE]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("retire");
  });

  it("introuvable avant : retour explicite « a-verifier », aucun DELETE", async () => {
    const { client, faux } = creerFauxClientZernio([INTROUVABLE]);
    expect(await client.retirer({ postId: ID, cleJournal: CLE_J })).toMatchObject({ etat: "a-verifier", raison: expect.stringMatching(/introuvable/) });
    expect(methodes(faux)).toEqual(["GET"]);
  });

  it("DELETE en 200 mais post encore là à la relecture → a-verifier, alerte, aucun second DELETE", async () => {
    const { client, faux, journal } = creerFauxClientZernio([post(), OK_DELETE, post()]);
    const r = await client.retirer({ postId: ID, cleJournal: CLE_J });
    expect(r.etat).toBe("a-verifier");
    expect(methodes(faux)).toEqual(["GET", "DELETE", "GET"]);
    expect(journal.lignes.some((l) => l.startsWith("alerte") && l.includes("à vérifier"))).toBe(true);
  });

  it.each([
    ["5xx", { statut: 502 } as ReponsePreparee],
    ["délai dépassé", { erreur: "delai" } as ReponsePreparee],
  ])("DELETE incertain (%s) puis post encore là → a-verifier, jamais retire", async (_n, rep) => {
    const { client, faux } = creerFauxClientZernio([post(), rep, post()]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("a-verifier");
    expect(methodes(faux).filter((m) => m === "DELETE")).toHaveLength(1);
  });

  it("DELETE en 404 puis relecture introuvable → retire", async () => {
    const { client } = creerFauxClientZernio([post(), INTROUVABLE, INTROUVABLE]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("retire");
  });

  it.each([
    ["relecture en 5xx", { statut: 503 } as ReponsePreparee],
    ["relecture sans réponse", { erreur: "delai" } as ReponsePreparee],
    ["format inattendu", { statut: 200, corps: { rien: true } } as ReponsePreparee],
  ])("%s → a-verifier", async (_n, rep) => {
    const { client } = creerFauxClientZernio([post(), OK_DELETE, rep]);
    expect((await client.retirer({ postId: ID, cleJournal: CLE_J })).etat).toBe("a-verifier");
  });

  it("interrupteur coupé : envoi-coupe, aucun appel", async () => {
    const { client, faux } = creerFauxClientZernio([post()], { envoiAutorise: () => false });
    await expect(client.retirer({ postId: ID, cleJournal: CLE_J })).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
  });

  it("la clé n'apparaît dans aucune ligne de journal ni dans le résultat", async () => {
    const { client, journal } = creerFauxClientZernio([post(), { statut: 502, corps: { error: `Bearer ${CLE_FICTIVE}` } }, post()]);
    const r = await client.retirer({ postId: ID, cleJournal: CLE_J });
    expect(JSON.stringify(r)).not.toContain(CLE_FICTIVE);
    expect(journal.lignes.join("\n")).not.toContain(CLE_FICTIVE);
  });
});

describe("porte publique : DELETE de post refusé", () => {
  it.each([["sans corps", undefined], ["avec corps", {}]])("requete() DELETE /v1/posts/{id} (%s) : chemin-refuse, aucun appel réseau", async (_n, corps) => {
    const { client, faux } = creerFauxClientZernio([OK_DELETE]);
    await expect(client.requete({ methode: "DELETE", chemin: `/v1/posts/${ID}`, corps })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });
});
