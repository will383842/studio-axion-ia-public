/**
 * PR-B · restes de la relecture de PR-A2 côté merci : report borné (vidé à l'échéance), et la file des merci GUIDE n'est pas engorgée par
 * au moins 10 merci d'autres mots reportés en tête du lot. Données 100 % fictives ; faux site, faux port.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP } from "@/domaine/guide-reseau/textes-mp";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import fixture from "./aides/confirmations-page-guide.v1.json";
import { COMPTE, ENV, T0, TITRE, cleConversation, fauxPort, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
  return { ...r, siteAccepteVersionM1: (v: string) => VERSIONS_SITE_TEST.has(v) };
});
vi.mock("@/services/cibles-site", async (orig) => ({ ...(await orig<Record<string, unknown>>()), lireCiblesSite: async () => (cat.lectures++, cat.site) }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const MM = await import("@/services/parcours-mots-multiples");

const H = 3600_000;
const CODE = "gde-essai01";
const cat = vi.hoisted(() => ({ site: null as unknown, lectures: 0 }));
const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
const ref = (n: number) => createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");
const auteur = (n: number) => `auteur-fictif-${500 + n}`;
const empreinteMerci = () => createHash("sha256").update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`).digest("hex");
const CLE_PROCESSUS = Symbol.for("studio-axion-ia.parcours-conversation");
const reportes = (): Record<string, number> => (globalThis as any)[CLE_PROCESSUS]?.mercisReportes ?? {};

let port: ReturnType<typeof fauxPort>;
const site = { file: [] as Array<{ ref: string; valideLe: string }>, accuses: [] as RequeteSignee[], limites: [] as number[] };
const transport = async (r: RequeteSignee) => {
  if (r.chemin === fixture.lecture.chemin) {
    const limite = (JSON.parse(r.corps) as { limite: number }).limite;
    site.limites.push(limite);
    return { statut: 200, corps: { ok: true, schemaVersion: 1, confirmations: site.file.slice(0, limite) } };
  }
  if (r.chemin === fixture.accuse.chemin) return (site.accuses.push(r), { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } });
  return { statut: 404, corps: {} };
};
const passer = (ms = T0) => C.traiterMercis({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV_MERCI, maintenantMs: ms });
const catalogue = () => ({
  catalogue: [
    { code: "guide-ia", type: "guide" as const, titre: "Titre guide-ia", actif: true, test: false },
    { code: CODE, type: "guide" as const, titre: "Titre essai", actif: true, test: false },
  ],
  liaisons: [
    { mot: "GUIDE", reseau: "tous" as const, codeCible: "guide-ia", actif: true },
    { mot: "CHATGPT", reseau: "tous" as const, codeCible: CODE, actif: true },
  ],
  luLe: T0, ignores: 0, depuisCopie: false,
});
const personne = (n: number, mot: string, guide: string) => ({
  etat: "attente_email", reseau: "facebook", idCompte: COMPTE, idCommentaire: `com-fictif-${n}`, idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v4-1", guide, mot, titreCible: mot === "GUIDE" ? TITRE : "Titre essai",
  cleIdempotenceGuide: `cle-${n}`, creeLe: new Date(T0 - 2 * H).toISOString(), m1Le: new Date(T0 - 2 * H).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0,
  prochainEssaiLe: null, dernierCode: null, alias: [], refLienConv: `c1_AbCdEf012345678${String(n).padStart(2, "0")}_-xyZQ`, empreintesLien: [ref(n)],
  derniereActiviteLe: new Date(T0 - H).toISOString(), idMessageDernier: `msg-dernier-${n}`,
});
/** `nAutres` merci de mot CHATGPT (refs 1..nAutres) puis UN merci GUIDE (ref nAutres+1), dans cet ordre dans la file du site. */
async function poser(nAutres: number): Promise<number> {
  const guideN = nAutres + 1;
  const convs: Record<string, unknown> = {};
  const m = new Date(T0 - H).toISOString();
  for (let n = 1; n <= guideN; n++) {
    convs[cleConversation(auteur(n))] = personne(n, n === guideN ? "GUIDE" : "CHATGPT", n === guideN ? "guide-ia" : CODE);
    await depots().evenementsFournisseurs.enregistrer({ id: `evf-dernier-${n}`, fournisseur: "zernio", idEvenement: `evt-dernier-${n}`, type: "zernio.message", recuLe: m, traite: true, creeLe: m, modifieLe: m, charge: { idMessage: `msg-dernier-${n}`, idConversation: `conv-fictive-${n}`, idCompte: COMPTE, idExpediteur: auteur(n), etat: "termine" } });
  }
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, convs);
  site.file = Array.from({ length: guideN }, (_, i) => ({ ref: ref(i + 1), valideLe: new Date(T0 - 60_000).toISOString() }));
  return guideN;
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  cat.site = null; // site illisible : les merci des autres mots sont REPORTÉS
  site.accuses.length = 0;
  site.limites.length = 0;
  pm.injecterTransportSite(transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
    [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
    [`CHATGPT|${COMPTE}`]: { mot: "CHATGPT", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
  });
  await validerGuideAuParcours();
  await Com.ecrireParametre("parcours.validation.merci", { empreinte: empreinteMerci() });
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  // Textes de CHATGPT validés site lisible ; le site devient illisible ensuite.
  cat.site = catalogue();
  const { validerTextesMot, apercuTextesMot } = await import("@/services/mots-validation-par-mot");
  const ap = (await apercuTextesMot({ mot: "CHATGPT", env: ENV_MERCI, maintenantMs: T0 })).find((x) => x.reseau === "facebook")!;
  if (!ap.ok) throw new Error(`aperçu refusé : ${ap.raison}`);
  const v = await validerTextesMot({ mot: "CHATGPT", reseau: "facebook", empreinteVue: ap.empreinte, confirmeParOperateur: true, env: ENV_MERCI, maintenantMs: T0 });
  if (!v.ok) throw new Error(v.raison);
  cat.site = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("report borné : vidé à l'échéance", () => {
  it("un merci reporté dont la ref n'est plus proposée par le site ne reste pas en mémoire après l'échéance", async () => {
    await poser(2);
    await passer(T0 + 2 * H);
    expect(Object.keys(reportes()).sort()).toEqual([ref(1), ref(2)].sort()); // 2 merci CHATGPT reportés, le GUIDE (ref 3) est parti
    site.file = []; // le site ne les propose plus (fenêtre close)
    await passer(T0 + 2 * H + 10_000); // avant l'échéance : le report est encore là
    expect(Object.keys(reportes())).toHaveLength(2);
    await passer(T0 + 2 * H + 120_000); // échéance passée
    expect(reportes()).toEqual({});
  });
});

describe("engorgement : au moins 10 merci d'autres mots reportés en tête ne bloquent pas les merci GUIDE derrière", () => {
  it("10 merci CHATGPT reportés devant 1 merci GUIDE : le GUIDE part, dans le même passage ou au suivant, sans doublon", async () => {
    const guideN = await poser(10);
    const r1 = await passer(T0 + 2 * H);
    expect(r1.envoyes).toBe(1); // lot de 10 entièrement reporté : relecture élargie, le GUIDE est atteint
    expect(port.envoyes).toHaveLength(1);
    expect((await Com.lireParametre<Record<string, any>>("parcours.merci.journal", {}))[ref(guideN)]).toBeDefined();
    expect(Object.keys(reportes())).toHaveLength(10);
    // Les reportés ne sont pas retraités avant l'échéance, rien ne part deux fois.
    await passer(T0 + 2 * H + 10_000);
    expect(port.envoyes).toHaveLength(1);
  });
  it("sans merci reporté : la lecture reste exactement { limite: 10 } (rien ne change tant qu'il n'y a rien à sauter)", async () => {
    cat.site = catalogue();
    await poser(1);
    await passer(T0 + 2 * H);
    expect(site.limites).toEqual([10]);
  });
  it("les reportés actifs sont sautés sans toucher au site ni au registre", async () => {
    await poser(10);
    await passer(T0 + 2 * H);
    const lectures = cat.lectures;
    site.limites.length = 0;
    await passer(T0 + 2 * H + 10_000);
    expect(site.limites[0]).toBeGreaterThan(10); // les reportés sont comptés dans la lecture : le lot utile reste de 10
    expect(cat.lectures).toBe(lectures);
    expect(site.accuses.some((a) => JSON.stringify(a).includes(ref(1)))).toBe(false);
  });
});
