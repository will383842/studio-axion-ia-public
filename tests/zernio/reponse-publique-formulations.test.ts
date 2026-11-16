/**
 * Réponse publique au commentaire : le texte vient du groupe « pub-commentaire » quand une formulation est VALIDÉE par le fondateur
 * (Facebook), sinon « mp-pub-igfb-v1 » comme avant. Instagram inchangé. Données 100 % fictives ; port faux.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GROUPES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import { COMPTE, ENV, T0, TITRE, cleConversation, deposerCommentaire, fauxPort, fauxSite, silencerConsole, validerFormulationsAuParcours, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
  return { ...r, siteAccepteVersionM1: (v: string) => VERSIONS_SITE_TEST.has(v) };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");

const A = "auteur-fictif-400";
const PUB = GROUPES_MP["pub-commentaire"] as readonly string[];
const ANCIEN = rendreTexteMp("mp-pub-igfb-v1", {});
let port: ReturnType<typeof fauxPort>;
let site: ReturnType<typeof fauxSite>;
const passer = () => C.traiterConversations({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV, maintenantMs: T0 });
const etatDe = async () => (await Com.lireParametre<Record<string, { formulations?: Record<string, string> }>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];

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
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("réponse publique : formulation validée", () => {
  it("Facebook, formulation pub-commentaire validée : texte de mp-pub-v2-*, version notée", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", PUB[0]]);
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(port.pub).toHaveLength(1);
    expect(port.pub[0].texte).toBe(rendreTexteMp(PUB[0] as never, {}));
    expect(port.pub[0].texte).not.toBe(ANCIEN);
    expect((await etatDe()).formulations?.["pub-commentaire"]).toBe(PUB[0]);
  });
  it("Facebook, aucune formulation pub-commentaire validée : texte mp-pub-igfb-v1 comme avant, rien noté", async () => {
    await deposerCommentaire(depots, { reseau: "facebook" });
    await passer();
    expect(port.pub[0].texte).toBe(ANCIEN);
    expect((await etatDe()).formulations?.["pub-commentaire"]).toBeUndefined();
  });
  it("Instagram : réponse publique inchangée même si une formulation pub-commentaire est validée", async () => {
    await validerFormulationsAuParcours(["mp-m1-v4-1", ...PUB]);
    await deposerCommentaire(depots, { reseau: "instagram" });
    await passer();
    if (port.pub.length > 0) expect(port.pub[0].texte).toBe(ANCIEN);
    expect((await etatDe())?.formulations?.["pub-commentaire"]).toBeUndefined();
  });
});
