/** S1 suite : « Retenir ce sujet » ne crée qu'UN sujet (vrai `ecrireSujetDeLUsine`, dépôt en mémoire) ; bornes de `lireSemaineUsine`. Seul `fetch` est une doublure. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { retenirSujetSemaineAction } = await import("@/app/(studio)/calendrier/retenir-sujet");
const { PARAM_DERNIERE_SEMAINE } = await import("@/services/proposer-semaine");
const { ecrireParametre } = await import("@/services/_commun");
const { lireSemaineUsine } = await import("@/services/usine-porte");
const { listerFormatsActifs } = await import("@/formats");

const DEBUT = "2026-11-23";
const idee = (signature: string) => ({
  signature,
  parts: { metier: "plombier", douleur: "d12", actualite: null },
  metier: "Plombier",
  taille: "TPE",
  douleur: "Les devis traînent trois jours.",
  casUsage: "Un devis envoyé dans l'heure.",
  format: listerFormatsActifs()[0].id,
});

describe("« Retenir ce sujet » : un seul sujet (vrai ecrireSujetDeLUsine)", () => {
  const appels: string[] = [];
  beforeAll(async () => {
    const { hash } = await import("@node-rs/argon2");
    process.env.SESSION_SECRET = "a".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("essai-s1", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    appels.length = 0;
    await auth.seConnecter("essai-s1", false);
    process.env.USINE_URL = "https://usine.test";
    process.env.USINE_PORTE_SECRET = "x".repeat(40);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { appels.push(String(url)); return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }); }));
    await ecrireParametre(PARAM_DERNIERE_SEMAINE, { debut: DEBUT, propositions: [{ cle: "k1", jour: "2026-11-24", reseau: "instagram", sujet: idee("sig-unique") }] });
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.USINE_URL; delete process.env.USINE_PORTE_SECRET; });

  it("5 demandes simultanées puis un rejeu : UN sujet, un seul appel retenir", async () => {
    const rs = await Promise.all(Array.from({ length: 5 }, () => retenirSujetSemaineAction(DEBUT, "k1")));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    const rejeu = await retenirSujetSemaineAction(DEBUT, "k1");
    expect(rejeu.ok).toBe(false);
    if (!rejeu.ok) expect(JSON.stringify(rejeu)).toContain("Ce sujet est déjà retenu.");
    const sujets = await depots().scriptsMaitres.lister((m) => m.origineUsine?.signature === "sig-unique");
    expect(sujets).toHaveLength(1);
    expect(appels.filter((u) => u.includes("/sujets/retenir"))).toHaveLength(1);
  });
  it("un sujet archivé ne bloque pas une nouvelle demande", async () => {
    expect((await retenirSujetSemaineAction(DEBUT, "k1")).ok).toBe(true);
    const [s] = await depots().scriptsMaitres.lister((m) => m.origineUsine?.signature === "sig-unique");
    await depots().scriptsMaitres.modifier(s.id, { archiveLe: new Date().toISOString() });
    expect((await retenirSujetSemaineAction(DEBUT, "k1")).ok).toBe(true);
  });
});

describe("lireSemaineUsine : bornes", () => {
  const brut = (sujet: Record<string, unknown> = {}) => ({ metier: { code: "m", libelle: "M" }, taille: { code: "t", libelle: "T" }, douleur: { code: "d", dite: "Une douleur." }, ...sujet });
  const ok = (i: number, sujet: Record<string, unknown> = {}) => ({ cle: `k${i}`, jour: "2026-11-24", reseau: "instagram", type: "video", sujet: { signature: `s${i}`, parts: {}, ...brut(), ...sujet } });

  it("51 propositions : refus clair", () => {
    expect(() => lireSemaineUsine({ propositions: Array.from({ length: 51 }, (_, i) => ok(i)) })).toThrow(/50/);
    expect(lireSemaineUsine({ propositions: Array.from({ length: 50 }, (_, i) => ok(i)) })).toHaveLength(50);
  });
  it("signature de plus de 800 caractères : sujet écarté", () => {
    expect(lireSemaineUsine({ propositions: [ok(1, { signature: "s".repeat(801) })] })[0].sujet).toBeUndefined();
    expect(lireSemaineUsine({ propositions: [ok(1, { signature: "s".repeat(800) })] })).toHaveLength(1);
  });
  it("texte de plus de 1 000 caractères : sujet écarté, semaine gardée", () => {
    const l = lireSemaineUsine({ propositions: [ok(1, { douleur: { code: "d", dite: "x".repeat(1001) } })] });
    expect(l).toHaveLength(1);
    expect(l[0].sujet).toBeUndefined();
  });
  it("parts trop nombreuses ou trop longues : sujet écarté", () => {
    const trop = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`p${i}`, "v"]));
    expect(lireSemaineUsine({ propositions: [ok(1, { parts: trop })] })[0].sujet).toBeUndefined();
    expect(lireSemaineUsine({ propositions: [ok(1, { parts: { a: "v".repeat(201) } })] })[0].sujet).toBeUndefined();
    expect(lireSemaineUsine({ propositions: [ok(1, { parts: { ["k".repeat(81)]: "v" } })] })[0].sujet).toBeUndefined();
    expect(lireSemaineUsine({ propositions: [ok(1, { parts: { a: "v".repeat(200), b: null } })] })[0].sujet?.parts.b).toBeNull();
  });
});

describe("S1 suite 2 : semaine honnête acceptée, sujet trop grand écarté", () => {
  const base = (sujet: Record<string, unknown>) => ({ cle: "k1", jour: "2026-11-24", reseau: "instagram", type: "video", sujet: { signature: "s1", parts: {}, metier: { code: "m", libelle: "M" }, taille: { code: "t", libelle: "T" }, douleur: { code: "d", dite: "Une douleur." }, ...sujet } });
  it("cas d'usage 550 + 550 : semaine acceptée, sujet gardé", () => {
    const l = lireSemaineUsine({ propositions: [base({ cas_usage: { code: "c", titre: "a".repeat(550), ce_que_ca_change: "b".repeat(550) } })] });
    expect(l).toHaveLength(1);
    expect(l[0].sujet?.casUsage.length).toBeGreaterThan(1000);
  });
  it("cinq fins de 250 : semaine acceptée, sujet gardé", () => {
    const fins = Object.fromEntries(["a", "b", "c", "d", "e"].map((k, i) => [k, { dit: String(i).repeat(250) }]));
    const l = lireSemaineUsine({ propositions: [base({ fins })] });
    expect(l[0].sujet).toBeDefined();
  });
  it("texte de 200 000 : semaine acceptée, cette carte sans sujet, rien d'énorme gardé", () => {
    const l = lireSemaineUsine({ propositions: [base({ douleur: { code: "d", dite: "x".repeat(200000) } }), { ...base({}), cle: "k2" }] });
    expect(l).toHaveLength(2);
    expect(l[0].sujet).toBeUndefined();
    expect(l[1].sujet).toBeDefined();
    expect(JSON.stringify(l).length).toBeLessThan(5000);
  });
});

describe("S1 suite 2 : l'Usine est prévenue au rejeu après une panne de retenir", () => {
  let statut = 500;
  const appels: string[] = [];
  beforeAll(async () => {
    const { hash } = await import("@node-rs/argon2");
    process.env.SESSION_SECRET = "a".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash("essai-s1", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    appels.length = 0;
    statut = 500;
    await auth.seConnecter("essai-s1", false);
    process.env.USINE_URL = "https://usine.test";
    process.env.USINE_PORTE_SECRET = "x".repeat(40);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { appels.push(String(url)); return new Response(JSON.stringify({ ok: statut === 200, deja: true }), { status: statut, headers: { "content-type": "application/json" } }); }));
    await ecrireParametre(PARAM_DERNIERE_SEMAINE, { debut: DEBUT, propositions: [{ cle: "k1", jour: "2026-11-24", reseau: "instagram", sujet: idee("sig-panne") }] });
  });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.USINE_URL; delete process.env.USINE_PORTE_SECRET; });
  const nbRetenir = () => appels.filter((u) => u.includes("/sujets/retenir")).length;

  it("500 puis rejeu : un seul sujet, rappel, champ posé ; rejeu suivant : aucun appel", async () => {
    const r1 = await retenirSujetSemaineAction(DEBUT, "k1");
    expect(r1.ok && r1.donnees.rappelUsine).toBe(true);
    expect(nbRetenir()).toBe(1);
    statut = 200;
    const r2 = await retenirSujetSemaineAction(DEBUT, "k1");
    expect(r2.ok).toBe(false);
    expect(JSON.stringify(r2)).toContain("Ce sujet est déjà retenu.");
    expect(nbRetenir()).toBe(2);
    const sujets = await depots().scriptsMaitres.lister((m) => m.origineUsine?.signature === "sig-panne");
    expect(sujets).toHaveLength(1);
    expect(typeof sujets[0].origineUsine?.prevenueLe).toBe("string");
    await retenirSujetSemaineAction(DEBUT, "k1");
    expect(nbRetenir()).toBe(2);
  });
  it("succès au premier coup : champ posé, aucun rappel au rejeu", async () => {
    statut = 200;
    expect((await retenirSujetSemaineAction(DEBUT, "k1")).ok).toBe(true);
    await retenirSujetSemaineAction(DEBUT, "k1");
    expect(nbRetenir()).toBe(1);
  });
});
