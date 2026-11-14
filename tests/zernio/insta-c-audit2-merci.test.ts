/**
 * INSTA-C · second audit, V2 : le merci après la validation de la page compte dans le plafond de 3 messages Instagram par personne.
 * Données 100 % fictives ; faux site, faux port.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEXTES_MP, rendreTexteMp } from "@/domaine/guide-reseau/textes-mp";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import fixture from "./aides/confirmations-page-guide.v1.json";
import { COMPTE, ENV, T0, TITRE, cleConversation, fauxPort, silencerConsole, validerGuideAuParcours } from "./aides/conversation";

vi.mock("@/domaine/guide-reseau/versions-acceptees-site", async (orig) => {
  const r = await orig<Record<string, unknown>>();
  const { VERSIONS_SITE_TEST } = await import("./aides/versions-site-test");
  return { ...r, siteAccepteVersionM1: (v: string) => VERSIONS_SITE_TEST.has(v) };
});
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const MS = await import("@/services/mots-service");
const MM = await import("@/services/parcours-mots-multiples");
const IG = await import("@/services/parcours-instagram");

const H = 3600_000;
const A = "auteur-fictif-400";
const ENV_MERCI = { ...ENV, PARCOURS_MERCI_ENABLED: "1" };
const ref = (n: number) => createHash("sha256").update(`jeton-fictif-${n}`).digest("hex");
const texteMerci = () => rendreTexteMp("mp-merci-v1", { titre: TITRE }) as string;
const empreinteMerci = () => createHash("sha256").update(`mp-merci-v1\n${TEXTES_MP["mp-merci-v1"].texte}`).digest("hex");

let port: ReturnType<typeof fauxPort>;
const site = { file: [] as Array<{ ref: string; valideLe: string }>, accuses: [] as RequeteSignee[] };
const transport = async (r: RequeteSignee) => {
  if (r.chemin === fixture.lecture.chemin) return { statut: 200, corps: { ok: true, schemaVersion: 1, confirmations: site.file } };
  if (r.chemin === fixture.accuse.chemin) return (site.accuses.push(r), { statut: 200, corps: { ok: true, schemaVersion: 1, recus: 1 } });
  return { statut: 404, corps: {} };
};
const passer = (ms = T0) => C.traiterMercis({ port: port.port, comptesPermis: [COMPTE], titreGuide: TITRE, env: ENV_MERCI, maintenantMs: ms });
const etatDe = async () => (await Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {}))[cleConversation(A)];
const merciEnvoyes = () => port.envoyes.filter((e) => e.texte === texteMerci());

async function poserPersonne(dates: Record<string, string>): Promise<void> {
  const cle = cleConversation(A);
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, {
    [cle]: {
      etat: "attente_email", reseau: "instagram", idCompte: COMPTE, idCommentaire: "com-fictif-1", idPostPlateforme: "post-plateforme-fictif-200", versionTexteM1: "mp-m1-v4-1", guide: "guide-ia",
      cleIdempotenceGuide: "cle-a", creeLe: new Date(T0 - 2 * H).toISOString(), m1Le: new Date(T0 - 2 * H).toISOString(), occurredAt: null, m2Envoye: false, essaisSite: 0, essaisPub: 0, essaisM1: 0,
      prochainEssaiLe: null, dernierCode: null, alias: [], refLienConv: "c1_AbCdEf0123456789_-xyZQ", empreintesLien: [ref(1)],
      derniereActiviteLe: new Date(T0 - H).toISOString(), idMessageDernier: "msg-dernier", ...dates,
    },
  });
  const m = new Date(T0 - H).toISOString();
  await depots().evenementsFournisseurs.enregistrer({ id: "evf-dernier", fournisseur: "zernio", idEvenement: "evt-dernier", type: "zernio.message", recuLe: m, traite: true, creeLe: m, modifieLe: m, charge: { idMessage: "msg-dernier", idConversation: "conv-fictive-700", idCompte: COMPTE, idExpediteur: A, etat: "termine" } });
}

beforeEach(async () => {
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  site.file = [{ ref: ref(1), valideLe: new Date(T0 - 60_000).toISOString() }];
  site.accuses.length = 0;
  pm.injecterTransportSite(transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
  await Com.ecrireParametre("parcours.validation.merci", { empreinte: empreinteMerci() });
  await Com.ecrireParametre(MM.PARAM_MOTS_MULTIPLES, true);
  await Com.ecrireParametre(IG.PARAM_INSTAGRAM_SUIVRE, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
});

describe("V2 · merci et plafond de 3 messages Instagram", () => {
  it("suivre + pas encore + lien envoyés dans les 24 h, puis validation de la page : le merci NE part PAS, la page est accusée", async () => {
    await poserPersonne({ m1Le: new Date(T0 - 100_000).toISOString(), pasEncoreLe: new Date(T0 - 90_000).toISOString(), lienIgLe: new Date(T0 - 80_000).toISOString() });
    const r = await passer();
    expect(r.envoyes).toBe(0);
    expect(merciEnvoyes()).toHaveLength(0);
    expect(site.accuses.length).toBeGreaterThan(0);
  });
  it("sous le plafond : le merci part, sa date d'essai est écrite avant l'envoi (merciEssaiLe)", async () => {
    await poserPersonne({ m1Le: new Date(T0 - 100_000).toISOString(), lienIgLe: new Date(T0 - 80_000).toISOString() });
    const r = await passer();
    expect(r.envoyes).toBe(1);
    expect(merciEnvoyes()).toHaveLength(1);
    expect(typeof (await etatDe()).merciEssaiLe).toBe("string");
  });
  it("réseau Facebook : plafond non lu, le merci part", async () => {
    await poserPersonne({ reseau: "facebook", m1Le: new Date(T0 - 100_000).toISOString(), pasEncoreLe: new Date(T0 - 90_000).toISOString(), lienIgLe: new Date(T0 - 80_000).toISOString(), m2Le: new Date(T0 - 70_000).toISOString() });
    const r = await passer();
    expect(r.envoyes).toBe(1);
  });
});
