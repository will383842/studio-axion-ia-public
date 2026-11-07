/** R2 · aucun repli sur SITE_VIDEOS_SECRET : seul SITE_GUIDES_RESEAU_SECRET (≥ 32 caractères) relie le site. Secrets 100 % fictifs, aucun réseau. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signatureZernio } from "@/domaine/guide-reseau/crochet-zernio";
import type { RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { ADRESSE_FICTIVE, COMPTE, ENV, T0, TITRE, cleConversation, deposerMessage, evenement, fauxPort, fauxSite, silencerConsole } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const S = await import("@/services/mots-service");
const Com = await import("@/services/_commun");
const E = await import("@/domaine/guide-reseau/empreinte-personne");

const SECRET_32 = "secret-fictif-site-0123456789abc"; // 32 caractères
const SECRET_31 = SECRET_32.slice(0, 31);
const SECRET_CROCHET = "secret-fictif-crochet-sans-repli-01";
const T_MOT = 1_760_781_600_000;
const RUN: RunLu = { email: "lecteur-fictif@example.test", mot: "guide", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2" };
const BASE_MOT = { PARCOURS_MOT_ENABLED: "1", ZERNIO_WEBHOOK_SECRET: SECRET_CROCHET, SITE_VIDEOS_URL: "https://site.exemple", [E.VARIABLE_SECRET_EMPREINTE]: "secret-fictif-empreinte-sans-repli-0123456789" };
const SANS_REPLI = (secretVideos: string | undefined) => ({ ...BASE_MOT, SITE_VIDEOS_SECRET: secretVideos });

async function deposerMot(env: Record<string, string | undefined>, idEv: string, mot: string) {
  const o = { id: idEv, event: "workflow.run.completed", timestamp: new Date(T_MOT).toISOString(), execution: { id: `run_${idEv}_0001`, status: "completed" }, contact: { id: `ct_${idEv}` }, trigger: { type: "keyword", text: mot } };
  const corps = Buffer.from(JSON.stringify(o));
  await pm.recevoirCrochetZernio({ corps, idEvenement: idEv, signature: signatureZernio(SECRET_CROCHET, corps) }, { env, maintenantMs: T_MOT });
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  await Com.ecrireParametre(S.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterLecteurRuns(null);
  pm.injecterTransportSite(null);
  S.injecterLecteurOpposition(null);
  S.injecterTransportOpposition(null);
});

describe("guide (file d'envoi) : le secret vient seulement de SITE_GUIDES_RESEAU_SECRET", () => {
  const passage = async (env: Record<string, string | undefined>) => {
    await deposerMot({ ...BASE_MOT, SITE_GUIDES_RESEAU_SECRET: SECRET_32 }, "evt_g", "GUIDE");
    const vus: unknown[] = [];
    pm.injecterTransportSite(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    pm.injecterLecteurRuns(async () => ({ ...RUN }));
    await pm.traiterOutboxZernio({ env, maintenantMs: T_MOT });
    return vus;
  };
  it("seul SITE_VIDEOS_SECRET (32 car.) posé : aucun appel au site", async () => {
    expect(await passage(SANS_REPLI(SECRET_32))).toHaveLength(0);
  });
  it("même avec un transport injecté, pas de secret : transportDuSite = null", () => {
    pm.injecterTransportSite(async () => ({ statut: 200, corps: {} }));
    expect(pm.transportDuSite(SANS_REPLI(SECRET_32))).toBeNull();
    expect(pm.transportDuSite({})).toBeNull();
  });
  it("secret de 31 caractères refusé ; 32 caractères accepté (avec ou sans transport injecté)", () => {
    expect(pm.transportDuSite({ ...BASE_MOT, SITE_GUIDES_RESEAU_SECRET: SECRET_31 })).toBeNull();
    expect(pm.transportDuSite({ ...BASE_MOT, SITE_GUIDES_RESEAU_SECRET: SECRET_32 })?.secret).toBe(SECRET_32);
    pm.injecterTransportSite(async () => ({ statut: 200, corps: {} }));
    expect(pm.transportDuSite({ ...BASE_MOT, SITE_GUIDES_RESEAU_SECRET: SECRET_31 })).toBeNull();
    expect(pm.transportDuSite({ ...BASE_MOT, SITE_GUIDES_RESEAU_SECRET: SECRET_32 })?.secret).toBe(SECRET_32);
  });
});

describe("guide (conversation) : seul SITE_VIDEOS_SECRET posé => événement reporté, alerte « site non relié »", () => {
  it("aucun appel au site, événement reporté, une alerte", async () => {
    const port = fauxPort();
    const site = fauxSite();
    pm.injecterTransportSite(site.transport);
    const env = { ...ENV, SITE_GUIDES_RESEAU_SECRET: undefined, SITE_VIDEOS_SECRET: SECRET_32 };
    const avant = (await depots().notifications.lister(() => true)).length;
    // état « attente_email » : la prochaine étape est la demande de guide au site.
    const cle = cleConversation("auteur-fictif-400");
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cle]: { etat: "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia", cleIdempotenceGuide: "b".repeat(64), creeLe: new Date(T0 - 1000).toISOString(), m1Le: new Date(T0).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [] } });
    port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
    const id = await deposerMessage(depots, {});
    await C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: T0 });
    expect(port.lire).toBe(1);
    expect(site.vus).toHaveLength(0);
    const ev = await evenement(depots, id);
    expect(ev.traite).toBe(false);
    expect(ev.charge.prochainEssaiLe).toBeGreaterThan(T0);
    expect((await depots().notifications.lister(() => true)).length - avant).toBe(1);
  });
});

describe("opposition (STOP) : le secret vient seulement de SITE_GUIDES_RESEAU_SECRET", () => {
  const passage = async (secretGuides: string | undefined, secretVideos: string | undefined) => {
    await deposerMot(BASE_MOT, "evt_o", "stop");
    const vus: unknown[] = [];
    S.injecterLecteurOpposition(async () => ({ email: RUN.email, reseau: "instagram", occurredAt: new Date(T_MOT).toISOString() }));
    S.injecterTransportOpposition(async (r) => (vus.push(r), { statut: 200, corps: {} }));
    const rap = await S.traiterOppositions({ env: { ...BASE_MOT, SITE_GUIDES_RESEAU_SECRET: secretGuides, SITE_VIDEOS_SECRET: secretVideos } });
    return { vus, rap };
  };
  it("seul SITE_VIDEOS_SECRET (32 car.) posé : aucun appel au site, opposition prise en compte localement", async () => {
    const { vus, rap } = await passage(undefined, SECRET_32);
    expect(vus).toHaveLength(0);
    expect(rap).toMatchObject({ prises: 1, transmises: 0 });
  });
  it("secret de 31 caractères refusé : aucun appel", async () => {
    const { vus, rap } = await passage(SECRET_31, undefined);
    expect(vus).toHaveLength(0);
    expect(rap.transmises).toBe(0);
  });
  it("secret de 32 caractères accepté : transmis, signé avec ce secret", async () => {
    const { vus, rap } = await passage(SECRET_32, undefined);
    expect(vus).toHaveLength(1);
    expect(rap).toMatchObject({ prises: 1, transmises: 1 });
  });
});
