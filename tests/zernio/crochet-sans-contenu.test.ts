/** Crochet Zernio SANS CONTENU : aucun texte brut stocké. Corps, secret et adresse FICTIFS (example.com), aucun réseau. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lireEnveloppe, lireEvenementCommentaire, lireEvenementMessage, lireEvenementRun, signatureZernio, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const SECRET = "secret-fictif-sans-contenu";
const T0 = 1_760_781_600_000;
const ISO = new Date(T0).toISOString();
const ADRESSE = "lecteur-fictif@example.com";
const ENV = { PARCOURS_MOT_ENABLED: "1", MOTS_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET };

const run = (o: object = {}) => ({ id: "evt_r1", event: "workflow.run.completed", timestamp: ISO, execution: { id: "exec_1", status: "completed" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text: "GUIDE" }, ...o });
const commentaire = (c: object = {}, o: object = {}) => ({
  id: "evt_c1", event: "comment.received", timestamp: ISO,
  account: { accountId: "acc_1", platform: "instagram" },
  comment: { id: "com_1", platformPostId: "post_1", text: "GUIDE", author: { id: "auteur_1" }, isReply: false, ...c }, ...o,
});
const message = (m: object = {}, o: object = {}) => ({
  id: "evt_m1", event: "message.received", timestamp: ISO,
  account: { accountId: "acc_1", platform: "instagram" },
  message: { id: "msg_1", conversationId: "conv_1", text: "bonjour", sender: { id: "exp_1" }, postback: { payload: "GUIDE_OUI" }, ...m }, ...o,
});
const envoi = (o: object, idEvenement?: string | null) => {
  const corps = Buffer.from(JSON.stringify(o), "utf8");
  return { corps, signature: signatureZernio(SECRET, corps), idEvenement: idEvenement === undefined ? (o as { id: string }).id : idEvenement };
};
const recevoir = (e: ReturnType<typeof envoi>, t = T0, env: Record<string, string | undefined> = ENV) => pm.recevoirCrochetZernio(e, { env, maintenantMs: t });
const outbox = () => depots().evenementsFournisseurs.lister((e) => e.fournisseur === "zernio");
const NEUTRE = { statut: 200, corps: { recu: true } };
let consoles: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(() => {
  reinitialiserDepots();
  pm.reinitialiserGardesParcours();
  consoles = (["log", "error", "warn", "info"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
});
afterEach(() => vi.restoreAllMocks());

describe("a) l'adresse ne reste NULLE PART", () => {
  it.each([
    ["trigger.text", run({ trigger: { type: "keyword", text: ADRESSE } })],
    ["comment.text", commentaire({ text: ADRESSE })],
    ["message.text", message({ text: ADRESSE, postback: undefined })],
    ["message.text + postback", message({ text: ADRESSE })],
  ])("%s", async (_n, o) => {
    await recevoir(envoi(o));
    const d = depots();
    const tout = JSON.stringify([
      await outbox(), await d.evenementsFournisseurs.lister(() => true),
      await d.parametres.lister(() => true),
      await d.evenements.lister(() => true), // le VRAI journal (voir `journaliser`, src/services/_commun.ts)
      consoles.map((c) => c.mock.calls),
    ]);
    expect(tout).not.toContain(ADRESSE);
    expect(tout).not.toContain("example.com");
  });
  it("trigger.text : gardé seulement si mot seul ou opposition", () => {
    const lire = (t: unknown) => lireEvenementRun(lireEnveloppe(JSON.stringify(run({ trigger: { text: t } })))!)?.motDeclencheur;
    expect(lire("GUIDE")).toBe("GUIDE");
    expect(lire("stop")).toBe("stop");
    expect(lire(ADRESSE)).toBeNull();
    expect(lire("bonjour guide")).toBeNull();
  });
});

describe("lecteurs sans contenu", () => {
  const env = (o: object) => lireEnveloppe(JSON.stringify(o))!;
  it("commentaire : identifiants opaques, motSeul normalisé, jamais le texte", () => {
    const e = lireEvenementCommentaire(env(commentaire({ text: " guide " })))!;
    expect(e).toEqual({ idCommentaire: "com_1", idPostPlateforme: "post_1", idCompte: "acc_1", reseau: "instagram", idAuteur: "auteur_1", motSeul: "GUIDE", estReponse: false });
    expect(lireEvenementCommentaire(env(commentaire({ text: ADRESSE })))!.motSeul).toBeNull();
    expect(lireEvenementCommentaire(env(commentaire({ text: "stop" })))!.motSeul).toBe("STOP");
    expect(JSON.stringify(lireEvenementCommentaire(env(commentaire({ text: ADRESSE }))))).not.toContain("example.com");
  });
  it("message : identifiants et postback opaque, jamais le texte", () => {
    const e = lireEvenementMessage(env(message({ text: ADRESSE })))!;
    expect(e).toEqual({ idMessage: "msg_1", idConversation: "conv_1", idCompte: "acc_1", idExpediteur: "exp_1", postback: "GUIDE_OUI" });
    expect(lireEvenementMessage(env(message({ postback: { payload: ADRESSE } })))!.postback).toBeNull();
  });
  it("mauvais type ou identifiant absent → null", () => {
    expect(lireEvenementCommentaire(env(run()))).toBeNull();
    expect(lireEvenementCommentaire(env(commentaire({ id: undefined })))).toBeNull();
    expect(lireEvenementMessage(env(message({ id: undefined })))).toBeNull();
  });
});

describe("dépôt commentaire / message", () => {
  it("commentaire valide : déposé sous zernio.commentaire, charge limitée aux identifiants", async () => {
    expect((await recevoir(envoi(commentaire()))).statut).toBe(200);
    const l = await outbox();
    expect(l).toHaveLength(1);
    expect(l[0].type).toBe("zernio.commentaire");
    expect(l[0].charge).toMatchObject({ idCommentaire: "com_1", idCompte: "acc_1", idAuteur: "auteur_1", motSeul: "GUIDE" });
    expect(JSON.stringify(l[0].charge)).not.toContain("bonjour");
  });
  it("message à postback : déposé sous zernio.message", async () => {
    await recevoir(envoi(message()));
    const l = await outbox();
    expect(l.map((e) => e.type)).toEqual(["zernio.message"]);
    expect(l[0].charge).toMatchObject({ idMessage: "msg_1", idConversation: "conv_1", postback: "GUIDE_OUI" });
  });
  it("message sans postback : rien à déposer", async () => {
    await recevoir(envoi(message({ postback: undefined })));
    expect(await outbox()).toHaveLength(0);
  });
  it("déduplication (idCompte, idCommentaire) même avec un id d'événement différent", async () => {
    await recevoir(envoi(commentaire()));
    await recevoir(envoi({ ...commentaire(), id: "evt_c2" }));
    expect(await outbox()).toHaveLength(1);
  });
  it("g) motSeul null / réponse / auteur = compte : aucun dépôt", async () => {
    for (const [i, c] of [{ text: "super vidéo" }, { text: ADRESSE }, { isReply: true }, { author: { id: "acc_1" } }].entries()) {
      const r = await recevoir(envoi({ ...commentaire(c), id: `evt_g${i}`, comment: { ...commentaire().comment, id: `com_g${i}`, ...c } }));
      expect(r).toEqual(NEUTRE);
    }
    expect(await outbox()).toHaveLength(0);
  });
});

describe("b) signature", () => {
  const base = () => envoi(run());
  it("un bit inversé, MAJUSCULES, longueur 63 → 401", async () => {
    const e = base();
    const inverse = (e.signature.slice(0, -1) + (e.signature.endsWith("0") ? "1" : "0"));
    expect((await recevoir({ ...e, signature: inverse })).statut).toBe(401);
    expect((await recevoir({ ...e, signature: e.signature.toUpperCase() })).statut).toBe(401);
    expect((await recevoir({ ...e, signature: e.signature.slice(0, 63) })).statut).toBe(401);
    expect(await outbox()).toHaveLength(0);
  });
  it("vérifiée AVANT JSON.parse (espion)", async () => {
    const spy = vi.spyOn(JSON, "parse");
    expect((await recevoir({ corps: Buffer.from("{pas du json"), signature: "a".repeat(64), idEvenement: "x" })).statut).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("c-e) déduplication de l'id signé et fenêtre", () => {
  it("c) 7 rejeux d'un même id, timestamp vieux de 26 h → 200 et un seul dépôt", async () => {
    const vieux = run({ timestamp: new Date(T0 - 26 * 3600_000).toISOString() });
    const rs = [];
    for (let i = 0; i < 7; i++) rs.push(await recevoir(envoi(vieux)));
    expect(rs.every((r) => r.statut === 200)).toBe(true);
    expect(await outbox()).toHaveLength(1);
  });
  it("timestamp plus vieux que 72 h → 401", async () => {
    expect((await recevoir(envoi(run({ timestamp: new Date(T0 - 73 * 3600_000).toISOString() })))).statut).toBe(401);
  });
  it("d) en-tête d'id différent de l'id du corps → 401", async () => {
    expect((await recevoir(envoi(run(), "autre_id"))).statut).toBe(401);
    expect(await outbox()).toHaveLength(0);
  });
  it("e) timestamp 10 min dans le futur → 401 ; 4 min → 200", async () => {
    expect((await recevoir(envoi(run({ timestamp: new Date(T0 + 600_000).toISOString() })))).statut).toBe(401);
    expect((await recevoir(envoi(run({ timestamp: new Date(T0 + 240_000).toISOString() })))).statut).toBe(200);
  });
  it("route : en-tête d'id ≠ id du corps → 401 ; alias hérité x-late-event-id aussi", async () => {
    vi.stubEnv("PARCOURS_MOT_ENABLED", "1");
    vi.stubEnv("ZERNIO_WEBHOOK_SECRET", SECRET);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    try {
      const { POST } = await import("@/app/api/crochets/zernio/route");
      const corps = JSON.stringify(run());
      const r = await POST(new Request("http://localhost/api/crochets/zernio", { method: "POST", body: corps, headers: { "x-zernio-signature": signatureZernio(SECRET, corps), "x-zernio-event-id": "autre_id" } }) as never);
      expect(r.status).toBe(401);
      const r2 = await POST(new Request("http://localhost/api/crochets/zernio", { method: "POST", body: corps, headers: { "x-zernio-signature": signatureZernio(SECRET, corps), "x-late-event-id": "autre_id" } }) as never);
      expect(r2.status).toBe(401);
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });
});

describe("f) échantillon de test", () => {
  it("test:true → 200 sans effet ni dépôt", async () => {
    expect(await recevoir(envoi(run({ test: true })))).toEqual(NEUTRE);
    expect(await recevoir(envoi(commentaire({}, { test: true })))).toEqual(NEUTRE);
    expect(await outbox()).toHaveLength(0);
  });
});

describe("h) interrupteurs éteints", () => {
  it("réponse neutre 200, aucun dépôt", async () => {
    for (const env of [{ ZERNIO_WEBHOOK_SECRET: SECRET }, { ZERNIO_WEBHOOK_SECRET: SECRET, PARCOURS_MOT_ENABLED: "0", MOTS_ENABLED: "0" }]) {
      for (const o of [run(), commentaire(), message()]) expect(await recevoir(envoi(o), T0, env)).toEqual(NEUTRE);
    }
    expect(await outbox()).toHaveLength(0);
  });
  it("PARCOURS_MOT_ENABLED seul : le run est déposé, pas les commentaires", async () => {
    const env = { ZERNIO_WEBHOOK_SECRET: SECRET, PARCOURS_MOT_ENABLED: "1" };
    await recevoir(envoi(run()), T0, env);
    await recevoir(envoi(commentaire()), T0, env);
    expect((await outbox()).map((e) => e.type)).toEqual(["workflow.run.completed"]);
  });
});

describe("preuve du journal : une adresse déposée dans le journal est détectée", () => {
  it("le journal réel (depots().evenements) est lu : l'adresse y est trouvée si on l'y écrit", async () => {
    const { journaliser } = await import("@/services/_commun");
    await journaliser("test", `fuite ${ADRESSE}`);
    const journal = await depots().evenements.lister(() => true);
    expect(journal.length).toBeGreaterThan(0);
    expect(JSON.stringify(journal)).toContain(ADRESSE);
  });
  it("après un dépôt de trigger.text = adresse, le journal est lisible et sans adresse", async () => {
    await recevoir(envoi(run({ trigger: { type: "keyword", text: ADRESSE } })));
    const journal = await depots().evenements.lister(() => true);
    expect(Array.isArray(journal)).toBe(true);
    expect(JSON.stringify(journal)).not.toContain("example.com");
  });
});

describe("mot seul : limité aux mots configurés et à l'opposition", () => {
  const lireRun = (t: unknown) => lireEvenementRun(lireEnveloppe(JSON.stringify(run({ trigger: { text: t } })))!)?.motDeclencheur;
  const env = (o: object) => lireEnveloppe(JSON.stringify(o))!;
  it("un numéro de téléphone fictif (chiffres seuls) → null", () => {
    expect(lireRun("0612345678")).toBeNull();
    expect(lireRun("12")).toBeNull();
    expect(lireEvenementCommentaire(env(commentaire({ text: "0612345678" })))!.motSeul).toBeNull();
  });
  it("un mot isolé non configuré → null ; GUIDE et opposition conservés", () => {
    expect(lireRun("BONJOUR")).toBeNull();
    expect(lireEvenementCommentaire(env(commentaire({ text: "BONJOUR" })))!.motSeul).toBeNull();
    expect(lireRun("GUIDE")).toBe("GUIDE");
    expect(lireRun("stop")).toBe("stop");
    expect(lireEvenementCommentaire(env(commentaire({ text: "guide" })))!.motSeul).toBe("GUIDE");
  });
  it("idContact avec « @ » → null (identifiant opaque seulement)", () => {
    const e = lireEvenementRun(lireEnveloppe(JSON.stringify(run({ contact: { id: ADRESSE } })))!)!;
    expect(e.idContact).toBeNull();
    expect(lireEvenementRun(lireEnveloppe(JSON.stringify(run()))!)!.idContact).toBe("ct_1");
  });
});

describe("message : écho de nos propres messages et clé secondaire", () => {
  it.each([
    ["isSelf", { isSelf: true }],
    ["isOwn", { isOwn: true }],
    ["expéditeur = compte", { sender: { id: "acc_1" } }],
    ["expéditeur = platformAccountId", { sender: { id: "pf_9" } }, { account: { accountId: "acc_1", platform: "instagram", platformAccountId: "pf_9" } }],
  ] as [string, object, object?][])("écho (%s) : aucun dépôt", async (_n, m, o = {}) => {
    expect(await recevoir(envoi(message(m, o)))).toEqual(NEUTRE);
    expect(await outbox()).toHaveLength(0);
  });
  it("déduplication (idCompte, idMessage) avec un id d'événement différent", async () => {
    await recevoir(envoi(message()));
    await recevoir(envoi({ ...message(), id: "evt_m2" }));
    expect(await outbox()).toHaveLength(1);
  });
});

describe("travail de fond : seul workflow.run.completed est traité", () => {
  const RUN: RunLu = { email: ADRESSE, mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
  afterEach(() => {
    pm.injecterLecteurRuns(null);
    pm.injecterTransportSite(null);
  });
  const ENV_FOND = { ...ENV, SITE_GUIDES_RESEAU_SECRET: "secret-site-fictif", SITE_VIDEOS_URL: "https://site.example.com" };

  it("50 commentaires GUIDE : lecteur jamais appelé, rien de consommé, vrais runs traités dans le même lot", async () => {
    const lecteur = vi.fn(async () => ({ ...RUN }));
    const appels: unknown[] = [];
    pm.injecterLecteurRuns(lecteur);
    pm.injecterTransportSite(async (r) => (appels.push(r), { statut: 200, corps: {} }));
    for (let i = 0; i < 50; i++) await recevoir(envoi({ ...commentaire({ id: `com_${i}`, author: { id: `a_${i}` } }), id: `evt_c_${i}` }));
    await recevoir(envoi(message()));
    for (let i = 0; i < 3; i++) await recevoir(envoi({ ...run(), id: `evt_r_${i}`, execution: { id: `exec_${i}`, status: "completed" }, contact: { id: `ct_${i}` } }));
    expect(await outbox()).toHaveLength(54);

    const rap = await pm.traiterOutboxZernio({ env: ENV_FOND, maintenantMs: T0 });

    expect(rap).toMatchObject({ traites: 3, envoyes: 3, aReessayer: 0, definitifs: 0 });
    expect(rap.plafonne).toBeFalsy();
    expect(rap.disjoncteurOuvert).toBeFalsy();
    expect(lecteur.mock.calls.map((c) => (c as unknown as string[])[0]).sort()).toEqual(["exec_0", "exec_1", "exec_2"]);
    expect(appels).toHaveLength(3);
    const autres = (await outbox()).filter((e) => e.type !== "workflow.run.completed");
    expect(autres).toHaveLength(51);
    for (const e of autres) {
      expect(e.traite).toBe(false);
      expect(e.charge).toMatchObject({ etat: "a_faire" });
      expect(e.charge.essais ?? 0).toBe(0);
    }
  });

  it("uniquement des commentaires : lecteur jamais appelé, aucun essai", async () => {
    const lecteur = vi.fn(async () => ({ ...RUN }));
    pm.injecterLecteurRuns(lecteur);
    pm.injecterTransportSite(async () => ({ statut: 200, corps: {} }));
    for (let i = 0; i < 50; i++) await recevoir(envoi({ ...commentaire({ id: `com_${i}`, author: { id: `a_${i}` } }), id: `evt_c_${i}` }));
    expect(await pm.traiterOutboxZernio({ env: ENV_FOND, maintenantMs: T0 })).toMatchObject({ traites: 0, envoyes: 0, aReessayer: 0 });
    expect(lecteur).not.toHaveBeenCalled();
  });

  it("opposition : un commentaire « stop » (motSeul) n'est pas non plus une demande, et reste intact", async () => {
    const lecteur = vi.fn(async () => ({ ...RUN }));
    pm.injecterLecteurRuns(lecteur);
    pm.injecterTransportSite(async () => ({ statut: 200, corps: {} }));
    await recevoir(envoi(commentaire({ text: "stop" })));
    await pm.traiterOutboxZernio({ env: ENV_FOND, maintenantMs: T0 });
    expect(lecteur).not.toHaveBeenCalled();
    expect((await outbox())[0].traite).toBe(false);
  });
});
