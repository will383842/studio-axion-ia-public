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
  it("signature de plus de 800 caractères : refus", () => {
    expect(() => lireSemaineUsine({ propositions: [ok(1, { signature: "s".repeat(801) })] })).toThrow(/signature/);
    expect(lireSemaineUsine({ propositions: [ok(1, { signature: "s".repeat(800) })] })).toHaveLength(1);
  });
  it("texte de plus de 1 000 caractères : refus", () => {
    expect(() => lireSemaineUsine({ propositions: [ok(1, { douleur: { code: "d", dite: "x".repeat(1001) } })] })).toThrow(/1 000/);
  });
  it("parts trop nombreuses ou trop longues : refus", () => {
    const trop = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`p${i}`, "v"]));
    expect(() => lireSemaineUsine({ propositions: [ok(1, { parts: trop })] })).toThrow(/parts/);
    expect(() => lireSemaineUsine({ propositions: [ok(1, { parts: { a: "v".repeat(201) } })] })).toThrow(/parts/);
    expect(() => lireSemaineUsine({ propositions: [ok(1, { parts: { ["k".repeat(81)]: "v" } })] })).toThrow(/parts/);
    expect(lireSemaineUsine({ propositions: [ok(1, { parts: { a: "v".repeat(200), b: null } })] })[0].sujet?.parts.b).toBeNull();
  });
});
