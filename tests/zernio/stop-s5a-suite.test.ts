/**
 * STOP-S5a-SUITE · réserves R2 à R8 de la relecture de la PR 430. Données 100 % fictives ; site et port FAUX ; aucun envoi réel.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("S5a-suite R2 : la réduction continue après un doute du site", () => {
  const ENV_RED = { ...ENV, PARCOURS_REDUCTION_IDS: "1" };
  const semerEvenements = async (refs: Array<string | null>) => {
    const tout = await conversations();
    const date = new Date(T0 - 31 * 24 * 3600 * S).toISOString();
    for (let i = 0; i < refs.length; i++) {
      tout[cleConversation(`r-${i}`)] = graineConv("termine", refs[i] ? { refLienConv: refs[i] } : {});
      await depots().evenementsFournisseurs.enregistrer({
        id: `evf-red-${i}`, fournisseur: "zernio", idEvenement: `evt-red-${i}`, type: "zernio.commentaire",
        recuLe: date, traite: true, creeLe: date, modifieLe: date,
        charge: { idCommentaire: `com-red-${i}`, idPostPlateforme: "post-plateforme-fictif-200", idCompte: COMPTE, reseau: "instagram", idAuteur: `r-${i}`, proprio: false, motSeul: "GUIDE", estReponse: false, etat: "termine", dernierCode: null },
      } as any);
    }
    await Com.ecrireParametre(C.PARAM_CONVERSATIONS, tout);
  };
  const reduit = async (i: number) => typeof (await depots().evenementsFournisseurs.lister((e: any) => e.id === `evf-red-${i}`))[0].charge.idsReduitsLe === "string";
  it("le premier identifiant douteux (preuve du site manquante) n'empêche pas de réduire les suivants ; lui-même reste intact", async () => {
    await semerEvenements([ref(0), null, null]);
    expect(await C.reduireIdentifiants({ env: ENV_RED, maintenantMs: T0 })).toBe(2);
    expect(await reduit(0)).toBe(false);
    expect(await reduit(1)).toBe(true);
    expect(await reduit(2)).toBe(true);
  });
  it("témoin : registre illisible => on ne réduit toujours plus rien dans le passage", async () => {
    await semerEvenements([null, null]);
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_MOTS, "pas une liste");
    expect(await C.reduireIdentifiants({ env: ENV_RED, maintenantMs: T0 })).toBe(0);
    expect(await reduit(0)).toBe(false);
    expect(await reduit(1)).toBe(false);
  });
});

describe("S5a-suite R3 : référence « opposée » sans clé de conversation", () => {
  it("elle est comptée dans l'alerte horaire (un nombre, cloche seulement) et reste INCONNUE", async () => {
    await semerBeaucoup(2);
    opposeesSite.add(ref(7));
    opposeesSite.add(ref(8));
    OPP.demanderVerificationSite([ref(0), ref(7), ref(8)]);
    await importer(T0);
    const al = await alertes();
    expect(al).toHaveLength(1);
    expect(al[0].message.match(/\d+/g)).toEqual(["2"]);
    expect(al[0].envoi).toBeUndefined();
    expect(Object.keys(OPP.lireVerifs(await Com.lireParametre<any>(OPP.PARAM_OPPOSITIONS_SITE, null)))).toEqual([ref(0)]);
  });
  it("témoin : toutes les références ont une clé => aucune alerte", async () => {
    await semerBeaucoup(2);
    opposeesSite.add(ref(1));
    OPP.demanderVerificationSite([ref(0), ref(1)]);
    await importer(T0);
    expect(await alertes()).toHaveLength(0);
  });
});

describe("S5a-suite R4 : AbortSignal sur le délai", () => {
  it("la requête porte un signal, annulé à 5 s", async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(T0);
    await semerBeaucoup(1);
    OPP.demanderVerificationSite([ref(0)]);
    statutImport = -1;
    const p = importer(T0);
    await vi.advanceTimersByTimeAsync(4999);
    expect(signaux).toHaveLength(1);
    expect(signaux[0]).toBeInstanceOf(AbortSignal);
    expect(signaux[0]!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(signaux[0]!.aborted).toBe(true);
  });
});

describe("S5a-suite R5 : compteur des réponses illisibles", () => {
  it("compte les réponses 200 mal formées, pas les pannes ni les réponses valides", async () => {
    await semerBeaucoup(2);
    expect(IMP.reponsesIllisiblesSite()).toBe(0);
    OPP.demanderVerificationSite([ref(0)]);
    corpsImport = () => ({ ok: true, schemaVersion: 1, resultats: [] });
    await importer(T0);
    expect(IMP.reponsesIllisiblesSite()).toBe(1);
    statutImport = 503;
    OPP.demanderVerificationSite([ref(0)]);
    await importer(T0 + 61 * S);
    expect(IMP.reponsesIllisiblesSite()).toBe(1);
    statutImport = 200;
    corpsImport = null;
    OPP.demanderVerificationSite([ref(0)]);
    await importer(T0 + 122 * S);
    expect(IMP.reponsesIllisiblesSite()).toBe(1);
    corpsImport = () => "n'importe quoi";
    OPP.demanderVerificationSite([ref(1)]);
    await importer(T0 + 200 * S);
    expect(IMP.reponsesIllisiblesSite()).toBe(2);
  });
});

describe("S5a-suite R6 : débordement de la mémoire de 500 demandes", () => {
  it("alerte cloche (un nombre), une fois ; le compteur est remis à zéro après l'envoi", async () => {
    OPP.demanderVerificationSite(Array.from({ length: 600 }, (_, i) => ref(i)));
    expect(OPP.debordementsSite()).toBe(100);
    await importer(T0);
    const al = await alertes();
    expect(al).toHaveLength(1);
    expect(al[0].message.match(/\d+/g)).toEqual(["100"]);
    expect(al[0].envoi).toBeUndefined();
    expect(OPP.debordementsSite()).toBe(0);
  });
  it("témoin : 500 demandes, aucun débordement => aucune alerte", async () => {
    OPP.demanderVerificationSite(Array.from({ length: 500 }, (_, i) => ref(i)));
    await importer(T0);
    expect(await alertes()).toHaveLength(0);
  });
});

describe("S5a-suite R8 : la mémoire est propre à chaque processus", () => {
  it("le dit dans les sources, aux deux endroits", () => {
    for (const f of ["src/services/oppositions-mots.ts", "src/services/oppositions-import-site.ts"]) {
      expect(readFileSync(join(process.cwd(), f), "utf8")).toMatch(/propre à chaque processus/);
    }
  });
});
