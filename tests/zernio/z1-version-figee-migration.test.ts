/** Lot Z1 · version du corps figée : migration douce des conversations déjà en cours, et 409 cle_reutilisee définitif. Données 100 % fictives. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { corpsDemandeGuide, type RunLu } from "@/domaine/guide-reseau/crochet-zernio";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerMessage, fauxPort, fauxSite, silencerConsole, validerGuideAuParcours, ADRESSE_FICTIVE } from "./aides/conversation";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const ENV_V3 = { ...ENV, ORIGINE_V3_ENABLED: "1", ORIGINE_V3_PREFIXES_COMPTES: "/compte-test/", ORIGINE_V3_COMPTES: COMPTE };
const A = "auteur-fictif-400";
const CLE = "b".repeat(64);
const OCCURRED_AT = new Date(T0 - 3600_000).toISOString();
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = (env: Record<string, string | undefined>, ms = T0) => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const graine = (extra: Record<string, unknown>) => Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: {
  etat: "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-graine", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v2", guide: "guide-ia",
  cleIdempotenceGuide: CLE, creeLe: new Date(T0 - 50 * 3600_000).toISOString(), m1Le: new Date(T0).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0, prochainEssaiLe: null, dernierCode: null, alias: [], ...extra,
} });

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site = fauxSite();
  pm.injecterTransportSite(site.transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  port.reponses.texte = () => `mon adresse : ${ADRESSE_FICTIVE}`;
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("Z1 · version du corps figée", () => {
  it("état ancien (occurredAt renseigné, sans versionCorpsGuide), interrupteur et compte allumés : corps v1 identique octet pour octet, versionCorpsGuide=1 écrit", async () => {
    await graine({ occurredAt: OCCURRED_AT, idMessageAdresse: "msg-ancien" });
    await deposerMessage(depots, {});
    await passer(ENV_V3, T0 + 1000);
    expect(site.vus).toHaveLength(1);
    const run: RunLu = { email: ADRESSE_FICTIVE, mot: "GUIDE", reseau: "instagram", guide: "guide-ia", versionTexteM1: "mp-m1-v2", occurredAt: OCCURRED_AT };
    expect(Buffer.from(site.vus[0].corps, "utf8").equals(Buffer.from(corpsDemandeGuide(run, CLE), "utf8"))).toBe(true);
    expect((await etatDe()).versionCorpsGuide).toBe(1);
  });

  it("témoin : état neuf (occurredAt absent), interrupteur et compte allumés : corps v3 figé", async () => {
    await graine({});
    await deposerMessage(depots, {});
    await passer(ENV_V3, T0 + 1000);
    expect(JSON.parse(site.vus[0].corps).schemaVersion).toBe(3);
    expect((await etatDe()).versionCorpsGuide).toBe(3);
  });

  it("422 sur le corps v3 puis 409 cle_reutilisee : refus définitif, pas de boucle", async () => {
    await graine({});
    await deposerMessage(depots, {});
    const rep = [{ statut: 422, corps: { erreur: "invalide" } }, { statut: 409, corps: { erreur: "cle_reutilisee" } }];
    site.reponses = () => rep[Math.min(site.vus.length - 1, rep.length - 1)];
    await passer(ENV_V3, T0 + 1000);
    expect(site.vus).toHaveLength(2);
    expect(JSON.parse(site.vus[0].corps).schemaVersion).toBe(3);
    expect(JSON.parse(site.vus[1].corps).schemaVersion).toBe(1);
    expect((await etatDe()).etat).toBe("site_refuse");
    await passer(ENV_V3, T0 + 3_600_000);
    await passer(ENV_V3, T0 + 7_200_000);
    expect(site.vus).toHaveLength(2);
  });
});
