/** COR-PV2-T2 : format RÉEL du crochet (docs.zernio.com/webhooks, /webhooks/automations). Exemples FICTIFS, secret FICTIF, sans réseau. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { dansFenetreRejeu, lireEnveloppe, lireEvenementRun, signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");

const SECRET = "secret-fictif-t2";
const T0 = 1_760_781_600_000;
const ISO = new Date(T0).toISOString();
const ENV = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET };

const EXEMPLES: Record<string, object> = {
  "workflow.run.completed": { id: "evt_a1", event: "workflow.run.completed", timestamp: ISO, workflow: { id: "wf_1", name: "Parcours guide" }, execution: { id: "exec_1", status: "completed" }, conversation: { id: "conv_1" }, contact: { id: "ct_1" }, trigger: { type: "keyword", text: "GUIDE" } },
  "workflow.run.completed (exited)": { id: "evt_a2", event: "workflow.run.completed", timestamp: ISO, workflow: { id: "wf_1", name: "Parcours guide" }, execution: { id: "exec_2", status: "exited" }, contact: { id: "ct_2" }, trigger: { type: "keyword", text: "GUIDE" } },
  "workflow.run.failed": { id: "evt_b1", event: "workflow.run.failed", timestamp: ISO, workflow: { id: "wf_1", name: "Parcours guide" }, execution: { id: "exec_3", status: "failed" }, error: "etape en echec" },
  "message.sent": { id: "evt_c1", event: "message.sent", timestamp: ISO, executionId: "exec_1", workflowId: "wf_1", sequenceId: "seq_1", automationId: "auto_1" },
  "comment.received": { id: "evt_d1", event: "comment.received", timestamp: ISO, account: { accountId: "acc_1" } },
  "webhook.test": { id: "evt_e1", event: "webhook.test", timestamp: ISO },
};
const envoi = (o: object, idEvenement?: string | null) => {
  const corps = Buffer.from(JSON.stringify(o), "utf8");
  return { corps, signature: signatureZernio(SECRET, corps), idEvenement: idEvenement === undefined ? (o as { id: string }).id : idEvenement };
};
const recevoir = (e: ReturnType<typeof envoi>, t = T0) => pm.recevoirCrochetZernio(e, { env: ENV, maintenantMs: t });
const outbox = () => depots().evenementsFournisseurs.lister((e) => e.fournisseur === "zernio");

beforeEach(() => {
  reinitialiserDepots();
  pm.reinitialiserGardesParcours();
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("signature : HMAC-SHA256 hex minuscule du corps brut seul", () => {
  it("égale au calcul indépendant, sans horodatage devant", () => {
    const corps = JSON.stringify(EXEMPLES["webhook.test"]);
    expect(signatureZernio(SECRET, corps)).toBe(createHmac("sha256", SECRET).update(corps).digest("hex"));
    expect(signatureZernio(SECRET, corps)).not.toBe(createHmac("sha256", SECRET).update(`${T0 / 1000}.${corps}`).digest("hex"));
  });
  it("vérifiée avant tout JSON.parse : signature fausse + JSON invalide → 401, pas 422", async () => {
    const spy = vi.spyOn(JSON, "parse");
    const r = await recevoir({ corps: Buffer.from("{pas du json"), signature: "a".repeat(64), idEvenement: "x" });
    expect(r.statut).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("événements du doc", () => {
  it("workflow.run.completed (completed et exited) : déposé avec execution.id, contact.id et trigger.text", async () => {
    expect((await recevoir(envoi(EXEMPLES["workflow.run.completed"]))).statut).toBe(200);
    expect((await recevoir(envoi(EXEMPLES["workflow.run.completed (exited)"]))).statut).toBe(200);
    const l = await outbox();
    expect(l.map((e) => e.charge.idRun).sort()).toEqual(["exec_1", "exec_2"]);
    expect(l.find((e) => e.charge.idRun === "exec_1")?.charge).toMatchObject({ idContact: "ct_1", motDeclencheur: "GUIDE" });
  });
  it("lireEvenementRun : statut inconnu ou execution.id absent → null", () => {
    const lire = (o: object) => lireEvenementRun(lireEnveloppe(JSON.stringify(o))!);
    expect(lire(EXEMPLES["workflow.run.completed"])).toMatchObject({ idRun: "exec_1" });
    expect(lire({ ...EXEMPLES["workflow.run.completed"], execution: { id: "e", status: "failed" } })).toBeNull();
    expect(lire({ ...EXEMPLES["workflow.run.completed"], execution: { status: "completed" } })).toBeNull();
  });
  it.each(["workflow.run.failed", "message.sent", "comment.received", "webhook.test"])("%s : accusé 200, aucun effet", async (nom) => {
    const r = await recevoir(envoi(EXEMPLES[nom]));
    expect(r).toEqual({ statut: 200, corps: { recu: true } });
    expect(await outbox()).toHaveLength(0);
  });
  it("webhook.test mal signé : toujours 401", async () => {
    const e = envoi(EXEMPLES["webhook.test"]);
    expect((await recevoir({ ...e, signature: "b".repeat(64) })).statut).toBe(401);
  });
});

describe("anti-rejeu", () => {
  it("fenêtre ±300 s sur le timestamp du CORPS (ISO ou nombre)", async () => {
    expect(dansFenetreRejeu(T0 / 1000, T0 + 300_000)).toBe(true);
    expect(dansFenetreRejeu(T0 / 1000, T0 + 301_000)).toBe(false);
    expect((await recevoir(envoi(EXEMPLES["webhook.test"]), T0 + 301_000)).statut).toBe(401);
    expect((await recevoir(envoi({ ...EXEMPLES["webhook.test"], timestamp: T0 / 1000 }), T0 + 100_000)).statut).toBe(200);
  });
  it("déduplication par X-Zernio-Event-Id (même si l'id du corps diffère), sous verrou, en parallèle aussi", async () => {
    const a = envoi({ ...EXEMPLES["workflow.run.completed"], id: "corps_1" }, "evt_entete");
    const b = envoi({ ...EXEMPLES["workflow.run.completed"], id: "corps_2" }, "evt_entete");
    const rs = await Promise.all([recevoir(a), recevoir(b), recevoir(a)]);
    expect(rs.every((r) => r.statut === 200)).toBe(true);
    expect(await outbox()).toHaveLength(1);
    expect((await outbox())[0].idEvenement).toBe("evt_entete");
  });
  it("sans en-tête d'identifiant : repli sur l'id du corps", async () => {
    await recevoir(envoi(EXEMPLES["workflow.run.completed"], null));
    expect((await outbox())[0].idEvenement).toBe("evt_a1");
  });
});

describe("route : en-têtes du doc et alias hérités", () => {
  const appeler = async (entetes: Record<string, string>, o = EXEMPLES["workflow.run.completed"]) => {
    const { POST } = await import("@/app/api/crochets/zernio/route");
    const corps = JSON.stringify(o);
    return POST(new Request("http://localhost/api/crochets/zernio", { method: "POST", body: corps, headers: { "content-type": "application/json", ...entetes(corps) } }) as never);
  };
  beforeEach(() => {
    vi.stubEnv("PARCOURS_MOT_ENABLED", "1");
    vi.stubEnv("ZERNIO_WEBHOOK_SECRET", SECRET);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  it("X-Zernio-Signature / -Event / -Event-Id", async () => {
    const r = await appeler((c) => ({ "x-zernio-signature": signatureZernio(SECRET, c), "x-zernio-event": "workflow.run.completed", "x-zernio-event-id": "evt_h1" }));
    expect(r.status).toBe(200);
    expect((await outbox())[0].idEvenement).toBe("evt_h1");
  });
  it("alias hérités X-Late-Signature / X-Late-Event-Id", async () => {
    const r = await appeler((c) => ({ "x-late-signature": signatureZernio(SECRET, c), "x-late-event-id": "evt_h2" }));
    expect(r.status).toBe(200);
    expect((await outbox())[0].idEvenement).toBe("evt_h2");
  });
  it("sans signature : 401", async () => {
    expect((await appeler(() => ({ "x-zernio-event-id": "evt_h3" }))).status).toBe(401);
  });
});
