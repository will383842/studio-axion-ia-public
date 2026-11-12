/**
 * Appelants du registre d'oppositions : clé d'idempotence figée à l'enregistrement, STOP jamais perdu (UTF-8, identifiant long),
 * déduplication par empreinte, espace utilisé par chaque appelant. Secrets fictifs, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import type { RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { RE_CLE_IDEMPOTENCE } from "@/domaine/guide-reseau/cle-idempotence";
import type { RequeteSignee } from "@/fournisseurs/site/types";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const S = await import("@/services/mots-service");
const A = await import("@/services/a-traiter");
const Opp = await import("@/services/oppositions-mots");
const E = await import("@/domaine/guide-reseau/empreinte-personne");
const C = await import("@/services/_commun");

const T0 = 1_760_781_600_000;
const SECRET_CROCHET = "secret-fictif-crochet-appelants";
const E1 = "secret-fictif-empreinte-numero-un-0123456789";
const E2 = "secret-fictif-empreinte-numero-deux-012345678";
const ENV_BASE = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET_CROCHET, SITE_VIDEOS_URL: "https://site.exemple", SITE_GUIDES_RESEAU_SECRET: "secret-fictif-site-appelants-0123456789" };
const ENV_E1 = { ...ENV_BASE, [E.VARIABLE_SECRET_EMPREINTE]: E1 };
const RUN: RunLu = { email: "lecteur-fictif@example.test", mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
const lire = () => C.lireParametre<import("@/services/oppositions-mots").LigneOpposition[]>(Opp.PARAM_OPPOSITIONS_MOTS, []);
const courante = () => {
  const k = E.lireClesEmpreinte(process.env);
  if (!k.ok) throw new Error("clés attendues");
  return k.courante;
};

async function deposer(env: Record<string, string>, idEv: string, idContact: string | null, mot = "GUIDE") {
  const o: Record<string, unknown> = { id: idEv, event: "workflow.run.completed", timestamp: new Date(T0).toISOString(), execution: { id: `run_${idEv}_0001`, status: "completed" }, trigger: { type: "keyword", text: mot } };
  if (idContact) o.contact = { id: idContact };
  const corps = Buffer.from(JSON.stringify(o));
  return pm.recevoirCrochetZernio({ corps, idEvenement: idEv, signature: signatureZernio(SECRET_CROCHET, corps) }, { env, maintenantMs: T0 });
}
const evenement = async (idEv: string) => (await depots().evenementsFournisseurs.lister((x) => x.idEvenement === idEv))[0];

beforeEach(() => {
  reinitialiserDepots();
  pm.reinitialiserGardesParcours();
  for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  pm.injecterLecteurRuns(null);
  pm.injecterTransportSite(null);
  S.injecterLecteurOpposition(null);
  S.injecterTransportOpposition(null);
});

describe("clé d'idempotence figée à l'enregistrement de l'événement", () => {
  it("calculée une fois (opaque, 64 hex), stockée, et la même clé part après rotation du secret", async () => {
    await deposer(ENV_E1, "evt_idem_1", "ct_idem");
    const ev = await evenement("evt_idem_1");
    const k1 = E.lireClesEmpreinte(ENV_E1);
    if (!k1.ok) throw new Error("clés");
    const stockee = ev.charge.cleIdempotenceGuide;
    expect(stockee).toBe(E.cleIdempotenceOpaque(k1.courante, "guide", "run_evt_idem_1_0001"));
    expect(String(stockee)).toMatch(RE_CLE_IDEMPOTENCE);
    expect(String(stockee)).not.toContain("run_evt_idem_1");
    // rotation : S2 devient courant, S1 ancien
    vi.stubEnv(E.VARIABLE_SECRET_EMPREINTE, E2);
    vi.stubEnv(E.VARIABLE_SECRETS_ANCIENS, E1);
    const vus: RequeteSignee[] = [];
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    pm.injecterTransportSite(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    expect(await pm.traiterOutboxZernio({ env: ENV_BASE, maintenantMs: T0 })).toMatchObject({ envoyes: 1 });
    expect(JSON.parse(vus[0].corps).cleIdempotence).toBe(stockee);
    expect((await evenement("evt_idem_1")).charge.cleIdempotenceGuide).toBe(stockee); // jamais recalculée
  });
  it("une redistribution du même événement n'écrase pas la clé stockée", async () => {
    await deposer(ENV_E1, "evt_idem_2", "ct_idem");
    const avant = (await evenement("evt_idem_2")).charge.cleIdempotenceGuide;
    await deposer({ ...ENV_BASE, [E.VARIABLE_SECRET_EMPREINTE]: E2 }, "evt_idem_2", "ct_idem");
    expect((await evenement("evt_idem_2")).charge.cleIdempotenceGuide).toBe(avant);
  });
  it("opposition transmise au site avec la clé « opposition » stockée", async () => {
    await deposer(ENV_E1, "evt_idem_3", "ct_stop_idem", "stop");
    const stockee = (await evenement("evt_idem_3")).charge.cleIdempotenceOpposition;
    expect(String(stockee)).toMatch(RE_CLE_IDEMPOTENCE);
    expect(stockee).not.toBe((await evenement("evt_idem_3")).charge.cleIdempotenceGuide);
    vi.stubEnv(E.VARIABLE_SECRET_EMPREINTE, E2);
    vi.stubEnv(E.VARIABLE_SECRETS_ANCIENS, E1);
    const vus: RequeteSignee[] = [];
    S.injecterLecteurOpposition(async () => ({ email: "lecteur-fictif@example.test", reseau: "instagram", occurredAt: new Date(T0).toISOString() }));
    S.injecterTransportOpposition(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    expect(await S.traiterOppositions({ env: { ...ENV_BASE, [E.VARIABLE_SECRET_EMPREINTE]: E2, [E.VARIABLE_SECRETS_ANCIENS]: E1 } })).toMatchObject({ prises: 1, transmises: 1 });
    expect(JSON.parse(vus[0].corps).cleIdempotence).toBe(stockee);
  });
});

describe("traiterOppositions : empreinte, déduplication, échec fermé, espaces", () => {
  it("une personne déjà enregistrée en p1 ne reçoit pas de 2e ligne ; transmise posée sur la ligne retrouvée", async () => {
    vi.stubEnv(E.VARIABLE_SECRET_EMPREINTE, E1);
    await Opp.enregistrerOpposition("ct_dedup", "zernio-contact");
    await deposer(ENV_E1, "evt_dedup", "ct_dedup", "stop");
    S.injecterLecteurOpposition(async () => ({ email: "lecteur-fictif@example.test", reseau: "instagram", occurredAt: new Date(T0).toISOString() }));
    S.injecterTransportOpposition(async () => ({ statut: 200, corps: {} }));
    expect(await S.traiterOppositions({ env: ENV_E1 })).toMatchObject({ prises: 1, transmises: 1 });
    const l = await lire();
    expect(l).toHaveLength(1);
    expect(l[0].id).toMatch(/^p1\./);
    expect(l[0].transmise).toBe(true);
  });
  it("secret absent : échec fermé, événement non traité, aucune ligne héritée écrite", async () => {
    await deposer(ENV_E1, "evt_ferme", "ct_ferme", "stop");
    const rap = await S.traiterOppositions({ env: { PARCOURS_MOT_ENABLED: "1" } });
    expect(rap).toMatchObject({ actif: true, prises: 0 });
    expect((await evenement("evt_ferme")).traite).toBe(false);
    expect(await lire()).toEqual([]);
    expect(await S.traiterOppositions({ env: ENV_E1 })).toMatchObject({ prises: 1 });
    expect(await lire()).toHaveLength(1);
  });
  it("espaces figés : contact => « zernio-contact », sans contact => « evenement » (identifiant de l'événement)", async () => {
    await deposer(ENV_E1, "evt_esp_1", "ct_esp", "stop");
    await deposer(ENV_E1, "evt_esp_2", null, "stop");
    await S.traiterOppositions({ env: ENV_E1 });
    const k = E.lireClesEmpreinte(ENV_E1);
    if (!k.ok) throw new Error("clés");
    const ids = (await lire()).map((x) => x.id).sort();
    expect(ids).toEqual([E.empreintePersonne(k.courante, "zernio-contact", "ct_esp"), E.empreintePersonne(k.courante, "evenement", "evt_esp_2")].sort());
  });
});

describe("espace « zernio-conversation » (lot 3a)", () => {
  it("existe, est distinct des autres espaces et donne une empreinte différente", () => {
    const k = E.lireClesEmpreinte(ENV_E1);
    if (!k.ok) throw new Error("clés");
    const esp: import("@/domaine/guide-reseau/empreinte-personne").EspacePersonne = "zernio-conversation";
    const a = E.empreintePersonne(k.courante, esp, "id-fictif");
    expect(a).toMatch(/^p1\./);
    for (const autre of ["instagram", "facebook", "zernio-contact", "evenement"] as const) expect(E.empreintePersonne(k.courante, autre, "id-fictif")).not.toBe(a);
  });
});

describe("STOP jamais perdu : identifiants UTF-8 ou très longs", () => {
  const ids = ["contact-é-日本-🙂", "x".repeat(1000)];
  it("aiguillage : un STOP est enregistré puis la personne est reconnue (espace « zernio-contact »)", async () => {
    for (const idContact of ids) {
      reinitialiserDepots();
      const depot = A.creerDepotMemoire();
      const o = { env: { A_TRAITER_ENABLED: "1" }, depot, lireMots: async () => ["GUIDE"] };
      const base = { idEvenement: "ev-u1", post: "post-1", reseau: "instagram" as const, canal: "commentaire" as const, idContact };
      expect(await A.orienterCommentaire({ ...base, mot: "stop", commentaire: "stop" }, o)).toEqual({ issue: "execute", action: "silence", raison: "opposition" });
      expect(await Opp.personneOpposee(idContact)).toBe(true);
      expect((await lire())[0].id).toBe(E.empreintePersonne(courante(), "zernio-contact", idContact));
      expect(await A.orienterCommentaire({ ...base, idEvenement: "ev-u2", mot: "GUIDE", commentaire: "GUIDE" }, o)).toEqual({ issue: "execute", action: "silence", raison: "personne_opposee" });
    }
  });
  it("outbox : personne opposée à identifiant UTF-8 écartée, sans boucle de réessai", async () => {
    await Opp.enregistrerOpposition(ids[0], "zernio-contact");
    await deposer(ENV_E1, "evt_utf8", "ct_ascii");
    // Le crochet ne garde que des identifiants ASCII ; on force un identifiant UTF-8 dans l'événement pour couvrir l'outbox.
    const ev = await evenement("evt_utf8");
    await depots().evenementsFournisseurs.modifier(ev.id, { charge: { ...ev.charge, idContact: ids[0] } });
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    pm.injecterTransportSite(async () => ({ statut: 200, corps: {} }));
    expect(await pm.traiterOutboxZernio({ env: ENV_BASE, maintenantMs: T0 })).toMatchObject({ envoyes: 0, ecartes: 1 });
    expect((await evenement("evt_utf8")).charge.dernierCode).toBe("opposee");
  });
});
