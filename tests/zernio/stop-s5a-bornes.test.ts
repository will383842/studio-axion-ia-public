/**
 * STOP-S5a-SUITE · bornes de la relecture Opus (doutes bornés, alerte de débordement, réponses illisibles). Données 100 % fictives ; site et port FAUX ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHEMIN_OPPOSITIONS_PAR_CONV } from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import {
  COMPTE,
  ENV as ENV_BASE,
  T0,
  cleConversation,
  fauxPort,
  silencerConsole,
  validerGuideAuParcours,
} from "./aides/conversation";
import {
  graineConv,
  lectureParMessage,
  siteDouble,
} from "./aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const C = await import("@/services/parcours-conversation");
const OT = await import("@/services/oppositions-transmission");
const OPP = await import("@/services/oppositions-mots");
const IMP = await import("@/services/oppositions-import-site");
const MS = await import("@/services/mots-service");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");

const ENV = { ...ENV_BASE, OPPOSITIONS_SITE_IMPORT_ENABLED: "1", OPPOSITIONS_PAR_REF_ENABLED: "1" };
const ref = (i: number): string => `c1_${String(i).padStart(22, "0")}`;
const S = 1000;
const TITRES = ["Oppositions du site non vérifiées", "Site non relié (oppositions)", "Références de lien illisibles", "Demandes de vérification du site en débordement", "Oppositions du site sans conversation"];

let sd: ReturnType<typeof siteDouble>;
let port: ReturnType<typeof fauxPort>;
let statutImport = 200;
let opposeesSite = new Set<string>();
let corpsImport: ((convs: string[]) => unknown) | null = null;
let signaux: Array<AbortSignal | undefined> = [];
let textes: Record<string, string> = {};

const transport = async (r: RequeteSignee) => {
  if (r.chemin !== CHEMIN_OPPOSITIONS_PAR_CONV) return sd.transport(r);
  signaux.push((r as any).signal);
  const convs = (JSON.parse(r.corps) as { convs: string[] }).convs;
  if (statutImport === -1) await new Promise(() => undefined);
  if (statutImport !== 200) return { statut: statutImport, corps: {} };
  const corps = corpsImport ? corpsImport(convs) : { ok: true, schemaVersion: 1, resultats: convs.map((c) => ({ conv: c, opposee: opposeesSite.has(c) })) };
  return { statut: 200, corps };
};
const conversations = () => Com.lireParametre<Record<string, any>>(C.PARAM_CONVERSATIONS, {});
const horloge = (ms: number): void => void vi.setSystemTime(ms);
const importer = (ms = T0) => (horloge(ms), IMP.verifierOppositionsSite({ env: ENV, maintenantMs: ms }));
const alertes = async () => (await depots().notifications.lister((x: any) => TITRES.includes(x.titre))) as any[];
const nettoyerGlobal = () => {
  delete (globalThis as any).__studioOppositionsSite;
  IMP.reinitialiserImportOppositionsSite();
  OPP.reinitialiserDemandesSite();
};
const semerBeaucoup = async (n: number) => {
  const tout = await conversations();
  for (let i = 0; i < n; i++) tout[cleConversation(`p-${i}`)] = graineConv("attente_email", { refLienConv: ref(i) });
  await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  reinitialiserDepots();
  C.reinitialiserParcoursConversation();
  OT.reinitialiserOppositionsTransmission();
  nettoyerGlobal();
  pm.reinitialiserGardesParcours();
  silencerConsole();
  port = fauxPort();
  sd = siteDouble();
  statutImport = 200;
  opposeesSite = new Set();
  corpsImport = null;
  signaux = [];
  textes = {};
  lectureParMessage(port, textes);
  pm.injecterTransportSite(transport);
  await Com.ecrireParametre(MS.PARAM_REGISTRE_MOTS, { [`GUIDE|${COMPTE}`]: { mot: "GUIDE", compte: COMPTE, etat: "actif", idWorkflow: null, raison: null, modifieLe: "x" } });
  await validerGuideAuParcours();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
  nettoyerGlobal();
});


describe("S5a-suite bornes : les doutes du site sont bornés par passage", () => {
  const ENV_RED = { ...ENV, PARCOURS_REDUCTION_IDS: "1" };
  const semer = async (n: number) => {
    const tout = await conversations();
    const date = new Date(T0 - 31 * 24 * 3600 * S).toISOString();
    for (let i = 0; i < n; i++) {
      tout[cleConversation(`r-${i}`)] = graineConv("termine", { refLienConv: ref(i) });
      await depots().evenementsFournisseurs.enregistrer({
        id: `evf-red-${i}`, fournisseur: "zernio", idEvenement: `evt-red-${i}`, type: "zernio.commentaire",
        recuLe: date, traite: true, creeLe: date, modifieLe: date,
        charge: { idCommentaire: `com-red-${i}`, idPostPlateforme: "post-plateforme-fictif-200", idCompte: COMPTE, reseau: "instagram", idAuteur: `r-${i}`, proprio: false, motSeul: "GUIDE", estReponse: false, etat: "termine", dernierCode: null },
      } as any);
    }
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
  };
  it("600 événements douteux : au plus 50 demandes au site par passage, aucun débordement, aucun événement réduit", async () => {
    await semer(600);
    expect(await C.reduireIdentifiants({ env: ENV_RED, maintenantMs: T0 })).toBe(0);
    expect(OPP.debordementsSite()).toBe(0);
    expect(OPP.prendreDemandesSite(1000).length).toBeLessThanOrEqual(50);
    const reduits = (await depots().evenementsFournisseurs.lister((e: any) => typeof e.charge.idsReduitsLe === "string")).length;
    expect(reduits).toBe(0);
  });
});

describe("S5a-suite bornes : l'alerte de débordement a son propre créneau horaire", () => {
  it("une alerte « échec » récente ne masque pas l'alerte de débordement", async () => {
    statutImport = 503;
    OPP.demanderVerificationSite(Array.from({ length: 600 }, (_, i) => ref(i)));
    await importer(T0);
    const titres = (await alertes()).map((a) => a.titre);
    expect(titres).toContain("Oppositions du site non vérifiées");
    expect(titres).toContain("Demandes de vérification du site en débordement");
    expect(OPP.debordementsSite()).toBe(0);
  });
  it("le créneau reste horaire : un second débordement dans l'heure n'envoie rien de plus", async () => {
    OPP.demanderVerificationSite(Array.from({ length: 600 }, (_, i) => ref(i)));
    await importer(T0);
    OPP.demanderVerificationSite(Array.from({ length: 600 }, (_, i) => ref(1000 + i)));
    await importer(T0 + 61 * S);
    expect((await alertes()).filter((a) => a.titre === "Demandes de vérification du site en débordement")).toHaveLength(1);
  });
});

describe("S5a-suite bornes : réponses illisibles dans l'alerte horaire", () => {
  it("une réponse 200 mal formée est comptée dans l'alerte horaire (un nombre), une seule fois", async () => {
    await semerBeaucoup(1);
    OPP.demanderVerificationSite([ref(0)]);
    corpsImport = () => ({ ok: true, schemaVersion: 1, resultats: [] });
    await importer(T0); // l'alerte « échec » prend le créneau ; le compte attend, il n'est pas perdu
    expect(await alertes()).toHaveLength(1);
    corpsImport = null;
    OPP.demanderVerificationSite([ref(0)]);
    await importer(T0 + 3700 * S);
    const al = (await alertes()).filter((a) => a.titre === "Références de lien illisibles");
    expect(al).toHaveLength(1);
    expect(al[0].message.match(/\d+/g)).toEqual(["1"]);
    expect(al[0].envoi).toBeUndefined();
    OPP.demanderVerificationSite([ref(0)]);
    await importer(T0 + 7400 * S);
    expect((await alertes()).filter((a) => a.titre === "Références de lien illisibles")).toHaveLength(1);
  });
});
