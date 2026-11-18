/**
 * STOP-01 · le site est la référence des refus : repli fermé, refus local toujours bloquant, éteint = identique.
 * Données 100 % fictives ; site FAUX (transport injecté) ; aucun réseau, aucun envoi.
 * Rouges d'abord : R1 à R8 et D3 de usine/conception/STOP-01-CONCEPTION-2026-11-18.md.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHEMIN_OPPOSITIONS_PAR_CONV } from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import type { RequeteSignee } from "@/fournisseurs/site/types";
import { COMPTE, ENV as ENV_BASE, T0, cleConversation, silencerConsole } from "../zernio/aides/conversation";
import { graineConv } from "../zernio/aides/oppositions";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const OPP = await import("@/services/oppositions-mots");
const IMP = await import("@/services/oppositions-import-site");
const pm = await import("@/services/parcours-mot");
const Com = await import("@/services/_commun");
const PARAM_CONVERSATIONS = "parcours.conversations";

const ENV_ALLUME = { ...ENV_BASE, OPPOSITIONS_SITE_IMPORT_ENABLED: "1", OPPOSITIONS_PAR_REF_ENABLED: "1" };
const ENV_ETEINT = { ...ENV_BASE, OPPOSITIONS_PAR_REF_ENABLED: "1" };
const ref = (i: number): string => `c1_${String(i).padStart(22, "0")}`;
const S = 1000;

let appels: string[][] = [];
let statut = 200;
let opposeesSite = new Set<string>();
let corps: ((convs: string[]) => unknown) | null = null;

const transport = async (r: RequeteSignee) => {
  if (r.chemin !== CHEMIN_OPPOSITIONS_PAR_CONV) return { statut: 200, corps: {} };
  const convs = (JSON.parse(r.corps) as { convs: string[] }).convs;
  appels.push(convs);
  if (statut === -1) await new Promise(() => undefined);
  if (statut === 0) throw new Error("injoignable");
  if (statut !== 200) return { statut, corps: {} };
  return { statut: 200, corps: corps ? corps(convs) : { ok: true, schemaVersion: 1, resultats: convs.map((c) => ({ conv: c, opposee: opposeesSite.has(c) })) } };
};

const semer = async (id: string, etat: string, extra: Record<string, unknown> = {}) =>
  Com.ecrireParametre(PARAM_CONVERSATIONS, {
    ...(await Com.lireParametre<Record<string, any>>(PARAM_CONVERSATIONS, {})),
    [cleConversation(id)]: graineConv(etat, extra),
  });
const verdict = (id: string, env: Record<string, string | undefined>, ms = T0) => OPP.personneOpposeePartout({ idsBruts: [id] }, { env, maintenantMs: ms });
const importer = (env: Record<string, string | undefined>, ms = T0) => (vi.setSystemTime(ms), IMP.verifierOppositionsSite({ env, maintenantMs: ms }));
const registre = () => Com.lireParametre<any[]>(OPP.PARAM_OPPOSITIONS_MOTS, []);
const poserPreuve = (r: string, ms: number) => Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_SITE, { v: 1, verifs: { [r]: ms } });
const oppose = async (id: string) => {
  await OPP.enregistrerOpposition(id, "zernio-contact", { env: ENV_ALLUME });
};
const refus = async (f: () => Promise<unknown>) => {
  await expect(f()).rejects.toMatchObject({ name: "ErreurOppositionIllisible", code: "site_a_verifier" });
};
const nettoyer = () => {
  delete (globalThis as any).__studioOppositionsSite;
  IMP.reinitialiserImportOppositionsSite();
  OPP.reinitialiserDemandesSite();
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  reinitialiserDepots();
  nettoyer();
  silencerConsole();
  appels = [];
  statut = 200;
  opposeesSite = new Set();
  corps = null;
  pm.injecterTransportSite(transport);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  pm.injecterTransportSite(null);
  nettoyer();
});

describe("D3 compteurs de processus", () => {
  it("noterIssueVerificationSite / etatVerificationSite : nombres et états courts seulement, remis à zéro", () => {
    expect(OPP.etatVerificationSite()).toEqual({ demandes: 0, refsIllisibles: 0, debordements: 0, derniereIssue: null, derniereIssueMs: null, echecsConsecutifs: 0 });
    OPP.noterIssueVerificationSite("echec", T0);
    OPP.noterIssueVerificationSite("echec", T0 + 1);
    expect(OPP.etatVerificationSite()).toMatchObject({ derniereIssue: "echec", derniereIssueMs: T0 + 1, echecsConsecutifs: 2 });
    OPP.noterIssueVerificationSite("ok", T0 + 2);
    expect(OPP.etatVerificationSite()).toMatchObject({ derniereIssue: "ok", echecsConsecutifs: 0 });
    OPP.demanderVerificationSite([ref(1), ref(2)]);
    expect(OPP.etatVerificationSite().demandes).toBe(2);
    const copie = OPP.etatVerificationSite();
    (copie as any).demandes = 99;
    expect(OPP.etatVerificationSite().demandes).toBe(2);
    for (const v of Object.values(OPP.etatVerificationSite())) expect(["number", "string"].includes(typeof v) || v === null).toBe(true);
    OPP.reinitialiserDemandesSite();
    expect(OPP.etatVerificationSite()).toEqual({ demandes: 0, refsIllisibles: 0, debordements: 0, derniereIssue: null, derniereIssueMs: null, echecsConsecutifs: 0 });
  });
});

describe("R1 éteint : comportement identique", () => {
  it.each([undefined, "", "0", "false", "non"])("variable %j : aucune lecture du site, aucun appel, aucune demande, verdicts figés", async (v) => {
    const env = { ...ENV_ETEINT, ...(v === undefined ? {} : { OPPOSITIONS_SITE_IMPORT_ENABLED: v }) };
    await semer("sans-preuve", "attente_email", { refLienConv: ref(1) });
    await semer("opposee-etat", "oppose", { refLienConv: ref(2) });
    await semer("sans-lien", "attente_email");
    await oppose("au-registre");
    const espion = vi.spyOn(depots().parametres, "obtenir");
    const vu = async () => [
      (await verdict("sans-preuve", env)).opposee,
      (await verdict("opposee-etat", env)).opposee,
      (await verdict("sans-lien", env)).opposee,
      (await verdict("au-registre", env)).opposee,
      (await verdict("inconnue", env)).opposee,
    ];
    expect(await vu()).toEqual([false, true, false, true, false]);
    await importer(env);
    expect(await vu()).toEqual([false, true, false, true, false]);
    expect(appels).toHaveLength(0);
    expect(OPP.etatVerificationSite().demandes).toBe(0);
    const cles = new Set(espion.mock.calls.map((c) => c[0]));
    expect(cles.has(OPP.PARAM_OPPOSITIONS_SITE)).toBe(false);
    expect([...cles].every((c) => [PARAM_CONVERSATIONS, "parcours.conversations.alias", OPP.PARAM_OPPOSITIONS_MOTS].includes(c as string))).toBe(true);
    expect(await Com.lireParametre(OPP.PARAM_OPPOSITIONS_SITE, null)).toBeNull();
  });
});

describe("R2 le refus local passe toujours avant le site", () => {
  it("registre ou état « oppose » : opposée, même avec preuve fraîche « non opposée » ou site injoignable, allumé ou éteint", async () => {
    await semer("au-registre", "attente_email", { refLienConv: ref(1) });
    await semer("etat-oppose", "oppose", { refLienConv: ref(2) });
    await oppose("au-registre");
    await poserPreuve(ref(1), T0);
    await poserPreuve(ref(2), T0);
    statut = 0;
    for (const env of [ENV_ALLUME, ENV_ETEINT])
      for (const id of ["au-registre", "etat-oppose"]) expect((await verdict(id, env)).opposee).toBe(true);
    await Com.ecrireParametre(OPP.PARAM_OPPOSITIONS_SITE, null); // aucune preuve du tout
    for (const id of ["au-registre", "etat-oppose"]) expect((await verdict(id, ENV_ALLUME)).opposee).toBe(true);
    expect(appels).toHaveLength(0);
  });
});

describe("R3 / R6 le site ne fait qu'ajouter, rien n'est retiré", () => {
  it("le site répond « non opposée » pour une personne au registre : registre identique ; « opposée » : ligne ajoutée, anciennes intactes", async () => {
    await semer("au-registre", "attente_email", { refLienConv: ref(1) });
    await semer("autre", "attente_email", { refLienConv: ref(2) });
    await oppose("au-registre");
    const avant = await registre();
    expect(avant).toHaveLength(1);
    opposeesSite = new Set([ref(2)]); // pour la personne au registre (ref 1), le site répond « non opposée »
    await verdict("au-registre", ENV_ALLUME).catch(() => undefined);
    await verdict("autre", ENV_ALLUME).catch(() => undefined);
    await importer(ENV_ALLUME);
    const apres = await registre();
    expect(apres).toHaveLength(2);
    expect(apres[0]).toEqual(avant[0]);
    expect(apres[1]).toMatchObject({ source: "site", transmise: true });
    expect((await verdict("autre", ENV_ALLUME, T0 + 21 * S)).opposee).toBe(true);
  });
  it("une suite d'imports, de passages en échec et de redémarrages simulés : chaque ligne d'avant est présente, identique, à la même place", async () => {
    await semer("a", "attente_email", { refLienConv: ref(1) });
    await oppose("au-registre");
    await oppose("deuxieme");
    const avant = await registre();
    for (const [s, ms] of [[503, 0], [0, 70], [200, 140], [500, 210]] as const) {
      statut = s;
      await verdict("a", ENV_ALLUME, T0 + ms * S).catch(() => undefined);
      await importer(ENV_ALLUME, T0 + ms * S);
      nettoyer(); // redémarrage simulé
    }
    const apres = await registre();
    expect(apres.slice(0, avant.length)).toEqual(avant);
  });
});

describe("R4 allumé : repli fermé, aucun jeton", () => {
  const cas: Array<[string, () => void]> = [
    ["site injoignable", () => { statut = 0; }],
    ["500", () => { statut = 500; }],
    ["503 (site éteint)", () => { statut = 503; }],
    ["200 avec un champ en trop", () => { corps = (c) => ({ ok: true, schemaVersion: 1, resultats: c.map((x) => ({ conv: x, opposee: false, en_trop: 1 })) }); }],
    ["200 dans le désordre", () => { corps = (c) => ({ ok: true, schemaVersion: 1, resultats: [...c, ref(777)].reverse().map((x) => ({ conv: x, opposee: false })) }); }],
  ];
  it.each(cas)("%s : la personne avec lien n'obtient aucun jeton et aucune preuve n'est écrite", async (_n, regler) => {
    await semer("p", "attente_email", { refLienConv: ref(1) });
    regler();
    await refus(() => verdict("p", ENV_ALLUME));
    await importer(ENV_ALLUME, T0 + S);
    await refus(() => verdict("p", ENV_ALLUME, T0 + 2 * S));
    expect(OPP.lireVerifs(await Com.lireParametre(OPP.PARAM_OPPOSITIONS_SITE, null))[ref(1)]).toBeUndefined();
  });
  it("réponse au-delà de 5 s : l'appel est coupé, aucune preuve, aucun jeton, pas de réessai", async () => {
    await semer("p", "attente_email", { refLienConv: ref(1) });
    await refus(() => verdict("p", ENV_ALLUME));
    statut = -1;
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(T0);
    const passage = IMP.verifierOppositionsSite({ env: ENV_ALLUME, maintenantMs: T0 });
    await vi.advanceTimersByTimeAsync(5001);
    await passage;
    expect(appels).toHaveLength(1);
    expect(OPP.lireVerifs(await Com.lireParametre(OPP.PARAM_OPPOSITIONS_SITE, null))[ref(1)]).toBeUndefined();
    await refus(() => verdict("p", ENV_ALLUME, T0 + 6 * S));
  });
  it("preuve de 10 min + 1 ms : plus de jeton ; à 10 min pile : encore valable", async () => {
    await semer("p", "attente_email", { refLienConv: ref(1) });
    await poserPreuve(ref(1), T0);
    expect((await verdict("p", ENV_ALLUME, T0 + 600_000)).opposee).toBe(false);
    await refus(() => verdict("p", ENV_ALLUME, T0 + 600_001));
  });
  it("référence de lien illisible : aucun jeton, un compteur, aucune demande", async () => {
    await semer("p", "attente_email", { refLienConv: "c1_pas-conforme" });
    await refus(() => verdict("p", ENV_ALLUME));
    expect(OPP.etatVerificationSite().refsIllisibles).toBeGreaterThan(0);
    expect(appels).toHaveLength(0);
  });
});

describe("R5 pas de réessai en boucle, plafond horaire intact", () => {
  it("après un échec : aucun appel pendant 60 s ; 1000 demandes : au plus 2 appels par passage ; aucune écriture des compteurs du plafond horaire", async () => {
    const ecritures: string[] = [];
    const reel = depots().parametres.ecrire?.bind(depots().parametres);
    if (reel) vi.spyOn(depots().parametres, "ecrire").mockImplementation(((...a: any[]) => (ecritures.push(String(a[0]?.cle ?? a[0])), (reel as any)(...a))) as any);
    const ecrire = vi.spyOn(Com, "ecrireParametre");
    for (let i = 0; i < 300; i++) await semer(`p-${i}`, "attente_email", { refLienConv: ref(i) });
    for (let i = 0; i < 300; i++) await verdict(`p-${i}`, ENV_ALLUME).catch(() => undefined);
    await importer(ENV_ALLUME);
    expect(appels.length).toBeLessThanOrEqual(2);
    statut = 503;
    OPP.demanderVerificationSite([ref(1)]);
    appels = [];
    await importer(ENV_ALLUME, T0 + 20 * S);
    expect(appels).toHaveLength(1);
    await importer(ENV_ALLUME, T0 + 50 * S);
    expect(appels).toHaveLength(1);
    expect(ecrire.mock.calls.some((c) => c[0] === "parcours.conversations.compteurs")).toBe(false);
    expect(ecritures.some((c) => c.includes("compteurs"))).toBe(false);
  });
  it("l'issue du passage est notée : échec puis ok ; non-relie sans appel signé", async () => {
    await semer("p", "attente_email", { refLienConv: ref(1) });
    await verdict("p", ENV_ALLUME).catch(() => undefined);
    statut = 503;
    await importer(ENV_ALLUME);
    expect(OPP.etatVerificationSite()).toMatchObject({ derniereIssue: "echec", echecsConsecutifs: 1 });
    statut = 200;
    await verdict("p", ENV_ALLUME, T0 + 61 * S).catch(() => undefined);
    await importer(ENV_ALLUME, T0 + 61 * S);
    expect(OPP.etatVerificationSite()).toMatchObject({ derniereIssue: "ok", echecsConsecutifs: 0 });
  });
  it("aucun lot interrogé : l'issue n'est pas notée", async () => {
    await importer(ENV_ALLUME);
    expect(OPP.etatVerificationSite().derniereIssue).toBeNull();
  });
});

describe("R7 aucun identifiant dans les journaux, la cloche et la console", () => {
  it("pannes et alertes : aucun texte ne contient c1_, p1., @ ni l'identifiant d'essai", async () => {
    const jou = vi.spyOn(Com, "journaliser");
    const lignes: string[] = [];
    for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void lignes.push(a.map(String).join(" ")));
    await semer("identifiant-sensible-xyz", "attente_email", { refLienConv: ref(1) });
    await verdict("identifiant-sensible-xyz", ENV_ALLUME).catch(() => undefined);
    statut = 503;
    await importer(ENV_ALLUME);
    const notifs = (await depots().notifications.lister(() => true)) as any[];
    const textes = [...jou.mock.calls.map((c) => String(c[1])), ...lignes, ...notifs.map((n) => `${n.titre} ${n.message}`)];
    for (const t of textes) expect(t).not.toMatch(/c1_|p1\.|@|identifiant-sensible-xyz/);
  });
});
