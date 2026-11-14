/**
 * PR-A2 · merci et site illisible : le merci d'un mot autre que GUIDE est REPORTÉ (report propre à sa ref), jamais « non envoyé » ; les autres merci ne sont pas bloqués.
 * Données 100 % fictives ; faux site, faux port.
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
const A = "auteur-fictif-400";
const B = "auteur-fictif-401";
const CODE = "gde-essai01";
const cat = vi.hoisted(() => ({ site: null as unknown, lectures: 0 }));
const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
const PARAM_JOURNAL = "parcours.merci.journal";
const ref = (n: number) => createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");
const empreinteMerci = () => createHash("sha256").update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`).digest("hex");

let port: ReturnType<typeof fauxPort>;
const site = { file: [] as Array<{ ref: string; valideLe: string }>, accuses: [] as RequeteSignee[] };
const transport = async (r: RequeteSignee) => {
  if (r.chemin === fixture.lecture.chemin) return { statut: 200, corps: { ok: true, schemaVersion: 1, confirmations: site.file } };
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
const journal = () => Com.lireParametre<Record<string, any>>(PARAM_JOURNAL, {});
const personne = (auteur: string, n: number, mot: string, guide: string) => ({
  etat: "attente_email", reseau: "facebook", idCompte: COMPTE, idCommentaire: `com-fictif-${n}`, idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v4-1", guide, mot, titreCible: mot === "GUIDE" ? TITRE : "Titre essai",
  cleIdempotenceGuide: `cle-${n}`, creeLe: new Date(T0 - 2 * H).toISOString(), m1Le: new Date(T0 - 2 * H).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0,
  prochainEssaiLe: null, dernierCode: null, alias: [], refLienConv: `c1_AbCdEf012345678${n}_-xyZQ`, empreintesLien: [ref(n)],
  derniereActiviteLe: new Date(T0 - H).toISOString(), idMessageDernier: `msg-dernier-${n}`,
});
async function poser(): Promise<void> {
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, { [cleConversation(A)]: personne(A, 1, "CHATGPT", CODE), [cleConversation(B)]: personne(B, 2, "GUIDE", "guide-ia") });
  const m = new Date(T0 - H).toISOString();
  for (const [n, auteur] of [[1, A], [2, B]] as const)
    await depots().evenementsFournisseurs.enregistrer({ id: `evf-dernier-${n}`, fournisseur: "zernio", idEvenement: `evt-dernier-${n}`, type: "zernio.message", recuLe: m, traite: true, creeLe: m, modifieLe: m, charge: { idMessage: `msg-dernier-${n}`, idConversation: `conv-fictive-70${n}`, idCompte: COMPTE, idExpediteur: auteur, etat: "termine" } });
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  cat.site = catalogue();
  site.file = [{ ref: ref(1), valideLe: new Date(T0 - 60_000).toISOString() }, { ref: ref(2), valideLe: new Date(T0 - 60_000).toISOString() }];
  site.accuses.length = 0;
  pm.injecterTransportSite(transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, {
    [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
    [`CHATGPT|${COMPTE}`]: { mot: "CHATGPT", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" },
  });
  await validerGuideAuParcours();
  await Com.ecrireParametre("parcours.validation.merci", { empreinte: empreinteMerci() });
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await poser();
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("R1 · merci d'un mot autre que GUIDE, site illisible", () => {
  it("REPORTÉ (rien au registre, pas d'accusé), le merci GUIDE suivant part ; le site revient : le merci reporté part UNE fois", async () => {
    // Site lisible pour valider le texte du mot, puis illisible au moment du merci.
    const { validerTextesMot, apercuTextesMot } = await import("@/services/mots-validation-par-mot");
    const ap = (await apercuTextesMot({ mot: "CHATGPT", env: ENV_MERCI, maintenantMs: T0 })).find((x) => x.reseau === "facebook")!;
    if (!ap.ok) throw new Error(`aperçu refusé : ${ap.raison}`);
    const v = await validerTextesMot({ mot: "CHATGPT", reseau: "facebook", empreinteVue: ap.empreinte, confirmeParOperateur: true, env: ENV_MERCI, maintenantMs: T0 });
    if (!v.ok) throw new Error(v.raison);
    cat.site = null;
    const r = await passer(T0 + 2 * 3600_000);
    expect(r.envoyes).toBe(1); // le merci GUIDE (ref 2), derrière le merci reporté (ref 1), n'est pas bloqué
    expect((await journal())[ref(1)]).toBeUndefined(); // ni « non_envoye », ni accusé
    expect(site.accuses.some((a) => JSON.stringify(a).includes(ref(1)))).toBe(false);
    // Avant l'échéance du report : on n'y touche pas.
    const lectures = cat.lectures;
    await passer(T0 + 2 * 3600_000 + 10_000);
    expect(cat.lectures).toBe(lectures); // report respecté : le site n'est pas relu pour cette ref
    expect((await journal())[ref(1)]).toBeUndefined();
    // Site revenu, échéance passée : le merci part, une seule fois.
    cat.site = catalogue();
    const apres = await passer(T0 + 2 * 3600_000 + 120_000);
    expect(apres.envoyes).toBe(1);
    expect((await journal())[ref(1)]).toMatchObject({ etat: expect.stringMatching(/envoye|accuse/) });
    await passer(T0 + 2 * 3600_000 + 240_000);
    expect(port.envoyes).toHaveLength(2);
  });
});
