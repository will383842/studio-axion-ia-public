/**
 * Client « inbox » Zernio : liste fermée (4 routes), validation des corps, Idempotency-Key dédiée, « Tout arrêter »,
 * erreurs typées. Corps et identifiants FICTIFS (exemple-…), adresse fictive en example.com.
 */
import { describe, expect, it } from "vitest";
import { enteteIdempotenceInbox } from "@/fournisseurs/publication/zernio-client";
import { rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { creerFauxClientZernio, fetchInterdit, CLE_FICTIVE } from "./aides/faux-zernio";
import { creerClientZernio } from "@/fournisseurs/publication/zernio-client";

const HEX = "a".repeat(64);
const CLE_INBOX = `inbox-${HEX}`;
const COMPTES = ["exemple-compte-1"] as const;
const PUBLIC = rendreTexteMp("mp-pub-igfb-v1", {})!;
const PRIVE = rendreTexteMp("mp-recu-v2", { titre: "Guide d'exemple" })!;
const TITRES = ["Guide d'exemple"];
const ADRESSE = "lecteur-fictif@example.com";

const privee = (corps: unknown = { accountId: "exemple-compte-1", message: PRIVE }) => ({
  methode: "POST" as const,
  chemin: "/v1/inbox/comments/exemple-post-1/exemple-com-1/private-reply",
  corps,
  comptesPermis: COMPTES,
  titresGuidesPermis: TITRES,
});
const publique = (corps: unknown = { accountId: "exemple-compte-1", message: PUBLIC, commentId: "exemple-com-1" }, idempotence: string | undefined = CLE_INBOX) => ({
  methode: "POST" as const,
  chemin: "/v1/inbox/comments/exemple-post-1",
  corps,
  idempotence,
  comptesPermis: COMPTES,
  titresGuidesPermis: TITRES,
});
const envoi = (corps: unknown = { accountId: "exemple-compte-1", message: PRIVE }, idempotence: string | undefined = CLE_INBOX) => ({
  methode: "POST" as const,
  chemin: "/v1/inbox/conversations/exemple-conv-1/messages",
  corps,
  idempotence,
  comptesPermis: COMPTES,
  titresGuidesPermis: TITRES,
});
const lecture = { methode: "GET" as const, chemin: "/v1/inbox/conversations/exemple-conv-1/messages", query: { accountId: "exemple-compte-1" }, comptesPermis: COMPTES };

describe("inbox · liste fermée", () => {
  it("accepte exactement les 4 routes", async () => {
    const { client, faux } = creerFauxClientZernio(() => ({ statut: 200, corps: { messages: [] } }));
    for (const req of [privee(), publique(), envoi(), lecture]) await client.requete(req);
    expect(faux.appels.map((a) => `${a.methode} ${new URL(a.url).pathname}`)).toEqual([
      "POST /api/v1/inbox/comments/exemple-post-1/exemple-com-1/private-reply",
      "POST /api/v1/inbox/comments/exemple-post-1",
      "POST /api/v1/inbox/conversations/exemple-conv-1/messages",
      "GET /api/v1/inbox/conversations/exemple-conv-1/messages",
    ]);
  });

  it("refuse /v1/workflows (POST, PUT, PATCH, GET) et toute autre route, sans réseau", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    const corps = { accountId: "exemple-compte-1", message: PRIVE };
    for (const methode of ["POST", "PUT", "PATCH", "GET", "DELETE"] as const) {
      await expect(client.requete({ methode, chemin: "/v1/workflows", corps: methode === "GET" ? undefined : corps })).rejects.toMatchObject({ code: "chemin-refuse" });
      await expect(client.requete({ methode, chemin: "/v1/workflows/exemple-wf-1", corps: methode === "GET" ? undefined : corps })).rejects.toMatchObject({ code: "chemin-refuse" });
    }
    for (const [methode, chemin] of [
      ["GET", "/v1/inbox/comments/exemple-post-1"],
      ["DELETE", "/v1/inbox/comments/exemple-post-1"],
      ["PUT", "/v1/inbox/conversations/exemple-conv-1/messages"],
      ["GET", "/v1/inbox/conversations"],
      ["POST", "/v1/inbox/conversations/exemple-conv-1"],
      ["POST", "/v1/inbox/comments/exemple-post-1/exemple-com-1/hide"],
      ["POST", "/v1/inconnue"],
    ] as const) {
      await expect(client.requete({ methode, chemin, corps: methode === "GET" ? undefined : corps, comptesPermis: COMPTES })).rejects.toMatchObject({ code: "chemin-refuse" });
    }
    expect(faux.appels).toHaveLength(0);
  });

  it("refuse un segment invalide (postId, commentId, conversationId) sans réseau", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    for (const chemin of [
      "/v1/inbox/comments/exemple post",
      "/v1/inbox/comments/exemple.post",
      `/v1/inbox/comments/${"x".repeat(129)}`,
      "/v1/inbox/comments/exemple-post-1/ex%20/private-reply",
      "/v1/inbox/conversations/a.b/messages",
      "/v1/inbox/conversations/../messages",
    ]) {
      await expect(client.requete({ ...privee(), chemin })).rejects.toMatchObject({ code: "chemin-refuse" });
    }
    await expect(client.requete(publique({ accountId: "exemple-compte-1", message: PUBLIC, commentId: "a b" }))).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });
});

describe("inbox · validation des corps", () => {
  it("refuse un texte hors dictionnaire (texte libre, adresse, mauvais type de texte)", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    const libre = `Bonjour, écrivez-moi à ${ADRESSE}`;
    await expect(client.requete(privee({ accountId: "exemple-compte-1", message: libre }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(envoi({ accountId: "exemple-compte-1", message: `${PRIVE} Et aussi ${ADRESSE}` }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(publique({ accountId: "exemple-compte-1", message: libre, commentId: "exemple-com-1" }))).rejects.toMatchObject({ code: "chemin-refuse" });
    // Un texte du dictionnaire mais du mauvais côté : privé en public, public en privé.
    await expect(client.requete(publique({ accountId: "exemple-compte-1", message: PRIVE, commentId: "exemple-com-1" }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(privee({ accountId: "exemple-compte-1", message: PUBLIC }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(privee({ accountId: "exemple-compte-1", message: 42 }))).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });

  it("refuse un accountId hors de la liste fermée (ou une liste absente ou vide)", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    await expect(client.requete(privee({ accountId: "exemple-autre", message: PRIVE }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete({ ...privee(), comptesPermis: [] })).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete({ ...privee(), comptesPermis: undefined })).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete({ ...lecture, query: { accountId: "exemple-autre" } })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });

  it("refuse les champs en trop et les formes inattendues", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch });
    await expect(client.requete(privee({ accountId: "exemple-compte-1", message: PRIVE, commentId: "exemple-com-1" }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(publique({ accountId: "exemple-compte-1", message: PUBLIC }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(envoi({ accountId: "exemple-compte-1", message: PRIVE, extra: 1 }))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete(privee("texte"))).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete({ ...lecture, query: { accountId: "exemple-compte-1", autre: "x" } })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });

  it("boutons postback : bornés (3 au plus, titre court, charge simple, type postback)", async () => {
    const bouton = { type: "postback", title: "Recevoir ici", payload: "recevoir_ici" };
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: { ok: true } }]);
    await client.requete(envoi({ accountId: "exemple-compte-1", message: PRIVE, buttons: [bouton] }));
    expect(faux.appels).toHaveLength(1);
    const f = fetchInterdit();
    const c2 = creerClientZernio({ cle: CLE_FICTIVE, fetch: f.fetch });
    for (const buttons of [
      [bouton, bouton, bouton, bouton],
      [{ ...bouton, title: "x".repeat(21) }],
      [{ ...bouton, payload: "a b" }],
      [{ ...bouton, payload: "x".repeat(65) }],
      [{ ...bouton, type: "web_url" }],
      [{ ...bouton, url: "https://example.com" }],
      "oui",
    ]) {
      await expect(c2.requete(envoi({ accountId: "exemple-compte-1", message: PRIVE, buttons }))).rejects.toMatchObject({ code: "chemin-refuse" });
    }
    expect(f.appels).toHaveLength(0);
  });
});

describe("inbox · Idempotency-Key", () => {
  it("format dédié inbox-<64 hex>, exigé pour la réponse publique et l'envoi de message", async () => {
    expect(enteteIdempotenceInbox(HEX)).toBe(CLE_INBOX);
    expect(() => enteteIdempotenceInbox("zz")).toThrow();
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps: {} }, { statut: 200, corps: {} }]);
    await client.requete(publique());
    await client.requete(envoi());
    expect(faux.appels.map((a) => a.entetes["Idempotency-Key"])).toEqual([CLE_INBOX, CLE_INBOX]);
    const f = fetchInterdit();
    const c2 = creerClientZernio({ cle: CLE_FICTIVE, fetch: f.fetch });
    for (const mauvaise of [undefined, `studio-${HEX}`, `imp-${HEX}`, `inbox-${"a".repeat(63)}`, `inbox-${"A".repeat(64)}`, HEX]) {
      await expect(c2.requete({ ...publique(), idempotence: mauvaise })).rejects.toMatchObject({ code: "chemin-refuse" });
      await expect(c2.requete({ ...envoi(), idempotence: mauvaise })).rejects.toMatchObject({ code: "chemin-refuse" });
    }
    expect(f.appels).toHaveLength(0);
  });

  it("refusée sur la réponse privée et sur la lecture ; inbox-… refusée sur la création de post", async () => {
    const f = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: f.fetch });
    await expect(client.requete({ ...privee(), idempotence: CLE_INBOX })).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(client.requete({ ...lecture, idempotence: CLE_INBOX })).rejects.toMatchObject({ code: "chemin-refuse" });
    await expect(
      client.requete({ methode: "POST", chemin: "/v1/posts", idempotence: CLE_INBOX, corps: { isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] } }),
    ).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(f.appels).toHaveLength(0);
  });
});

describe("inbox · « Tout arrêter » et lecture requise", () => {
  it("interrupteur coupé : les 3 écritures sont refusées sans appel réseau ; la lecture reste permise", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch, envoiAutorise: () => false });
    for (const req of [privee(), publique(), envoi()]) await expect(client.requete(req)).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(faux.appels).toHaveLength(0);
    const { client: lecteur, faux: f2 } = creerFauxClientZernio([{ statut: 200, corps: { messages: [] } }], { envoiAutorise: () => false });
    await lecteur.requete(lecture);
    expect(f2.appels).toHaveLength(1);
  });

  it("après une 5xx sur une écriture, toute écriture inbox est bloquée jusqu'à une lecture de posts", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 503, corps: { error: "indisponible" } }, { statut: 200, corps: { posts: [] } }, { statut: 200, corps: {} }]);
    await expect(client.requete(envoi())).rejects.toMatchObject({ code: "a-verifier" });
    expect(client.lectureExigee()).toBe(true);
    await expect(client.requete(publique())).rejects.toMatchObject({ code: "lecture-requise" });
    expect(faux.appels).toHaveLength(1);
    await client.listerPosts();
    await client.requete(publique());
    expect(faux.appels).toHaveLength(3);
  });

  it("lectureRequiseInitiale bloque aussi la réponse privée", async () => {
    const faux = fetchInterdit();
    const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch, lectureRequiseInitiale: true });
    await expect(client.requete(privee())).rejects.toMatchObject({ code: "lecture-requise" });
    expect(faux.appels).toHaveLength(0);
  });
});

describe("inbox · erreurs typées", () => {
  it("403 INBOX_REQUIRED et message_allowance_exceeded", async () => {
    const { client } = creerFauxClientZernio([
      { statut: 403, corps: { code: "INBOX_REQUIRED", error: `refus pour ${ADRESSE}` } },
      { statut: 403, corps: { error: "x", details: { code: "message_allowance_exceeded" } } },
      { statut: 403, corps: { error: "autre" } },
    ]);
    await expect(client.requete(privee())).rejects.toMatchObject({ code: "inbox-requis", statut: 403 });
    await expect(client.requete(envoi())).rejects.toMatchObject({ code: "quota-messages", statut: 403 });
    await expect(client.requete(envoi())).rejects.toMatchObject({ code: "acces", statut: 403 });
  });

  it("400 privateReplyConsumed = définitif, un seul appel", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 400, corps: { error: "déjà", details: { privateReplyConsumed: true } } }]);
    await expect(client.requete(privee())).rejects.toMatchObject({ code: "reponse-privee-consommee", statut: 400, reessayable: false });
    expect(faux.appels).toHaveLength(1);
  });

  it("502 privateReplyOutcome unknown = à vérifier, aucun nouvel essai, lecture exigée ensuite", async () => {
    const { client, faux, horloge } = creerFauxClientZernio([{ statut: 502, corps: { error: "x", details: { privateReplyOutcome: "unknown" } } }]);
    await expect(client.requete(privee())).rejects.toMatchObject({ code: "reponse-privee-inconnue", statut: 502, reessayable: false });
    expect(faux.appels).toHaveLength(1);
    expect(horloge.attentes).toEqual([]);
    expect(client.lectureExigee()).toBe(true);
  });

  it("429 sur une LECTURE : Retry-After respecté, rejeu unique ; si le 429 persiste, reessayerApresSec rendu", async () => {
    const un = creerFauxClientZernio([{ statut: 429, entetes: { "retry-after": "7" }, corps: {} }, { statut: 200, corps: {} }]);
    await un.client.requete(lecture);
    expect(un.horloge.attentes).toEqual([7000]);
    expect(un.faux.appels).toHaveLength(2);

    const deux = creerFauxClientZernio([
      { statut: 429, entetes: { "retry-after": "3" }, corps: {} },
      { statut: 429, entetes: { "retry-after": "9" }, corps: {} },
    ]);
    await expect(deux.client.requete(lecture)).rejects.toMatchObject({ code: "debit", statut: 429, reessayerApresSec: 9, reessayable: true });
    expect(deux.faux.appels).toHaveLength(2);
  });

  it("429 sur une ÉCRITURE inbox : incertain, jamais rejoué, Retry-After conservé", async () => {
    for (const req of [privee(), envoi(), publique()]) {
      const c = creerFauxClientZernio([{ statut: 429, entetes: { "retry-after": "3" }, corps: { error: `adresse ${ADRESSE}` } }, { statut: 200, corps: {} }]);
      await expect(c.client.requete(req)).rejects.toMatchObject({ code: "limite-incertaine", statut: 429, reessayerApresSec: 3, reessayable: false });
      expect(c.faux.appels).toHaveLength(1);
      expect(c.horloge.attentes).toEqual([]);
      expect(c.client.lectureExigee()).toBe(true);
    }
    const long = creerFauxClientZernio([{ statut: 429, entetes: { "retry-after": "900" }, corps: {} }]);
    await expect(long.client.requete(privee())).rejects.toMatchObject({ code: "limite-incertaine", reessayerApresSec: 900 });
  });

  it("marqueur [MOT] : un mot normal passe ; un lien ou une adresse e-mail sont refusés sans être recopiés", async () => {
    const avecMot = (mot: string) => envoi({ accountId: "exemple-compte-1", message: rendreTexteMp("mp-m1-v2", { mot, titre: "Guide d'exemple" })!, buttons: undefined });
    const ok = creerFauxClientZernio([{ statut: 200, corps: {} }]);
    await ok.client.requete(avecMot("GUIDE"));
    for (const mauvais of ["https://evil.example/x", "ecrire@example.com", "a".repeat(31)]) {
      const c = creerFauxClientZernio([]);
      const err = await c.client.requete(avecMot(mauvais)).then(() => null, (e: unknown) => e as Error);
      expect(err).toMatchObject({ code: "chemin-refuse" });
      expect(JSON.stringify({ m: err?.message, j: c.journal })).not.toContain("evil");
      expect(c.faux.appels).toHaveLength(0);
    }
  });

  it("liens et titres : hors de nos domaines / hors liste = refus typé avant le réseau ; boutons sur réponse privée = code dédié", async () => {
    const c = creerFauxClientZernio([]);
    const lien = rendreTexteMp("mp-m1-v4-1", { titre: "Guide d'exemple", lien: "https://evil.example/x" })!;
    await expect(c.client.requete(envoi({ accountId: "exemple-compte-1", message: lien }))).rejects.toMatchObject({ code: "lien-hors-domaine" });
    await expect(c.client.requete({ ...envoi(), titresGuidesPermis: undefined })).rejects.toMatchObject({ code: "guide-inconnu" }); // aucune liste de titres fournie
    await expect(c.client.requete({ ...envoi(), titresGuidesPermis: ["Autre guide"] })).rejects.toMatchObject({ code: "guide-inconnu" });
    await expect(c.client.requete(privee({ accountId: "exemple-compte-1", message: PRIVE, buttons: [] }))).rejects.toMatchObject({ code: "boutons-non-supportes" });
    const ok = creerFauxClientZernio([{ statut: 200, corps: {} }]);
    await ok.client.requete(envoi());
    expect(c.faux.appels).toHaveLength(0);
  });

  it("aucune adresse, aucun corps ni clé dans les erreurs et les journaux", async () => {
    const { client, journal } = creerFauxClientZernio([
      { statut: 403, corps: { code: "INBOX_REQUIRED", error: `adresse ${ADRESSE}` } },
      { statut: 400, corps: { error: `adresse ${ADRESSE}`, details: { privateReplyConsumed: true } } },
      { statut: 502, corps: { error: `adresse ${ADRESSE}`, details: { privateReplyOutcome: "unknown" } } },
      { statut: 404, corps: { error: `adresse ${ADRESSE}` } },
    ]);
    const vues: unknown[] = [];
    for (const req of [privee(), privee(), privee(), lecture]) {
      try {
        await client.requete(req);
      } catch (e) {
        vues.push(e, JSON.stringify(e, Object.getOwnPropertyNames(e)));
      }
    }
    const tout = JSON.stringify(vues.map((v) => (v instanceof Error ? { m: v.message, d: (v as { detailTechnique?: string }).detailTechnique, s: v.stack?.split("\n")[0] } : v))) + journal.lignes.join("\n");
    expect(tout).not.toContain("example.com");
    expect(tout).not.toContain("lecteur-fictif");
    expect(tout).not.toContain(CLE_FICTIVE);
    expect(vues).toHaveLength(8);
  });
});
