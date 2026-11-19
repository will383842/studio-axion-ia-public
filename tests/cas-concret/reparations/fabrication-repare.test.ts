/**
 * S-04a-CAS-CONCRET-REPARATIONS · le branchement des réparations dans la vraie fabrication (doubles du moteur) :
 * R09 (marque perdue) et CC11 (calage impossible → « calage approché » + réserve « À vérifier »).
 * Les refus de contenu restent des refus.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";
import { fabriquerCasConcret, ErreurFabricationCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const refusCalage = vi.hoisted(() => ({ message: null as string | null }));
vi.mock("@/moteurs/montage-cas-concret/calage", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/moteurs/montage-cas-concret/calage")>();
  return { ...vrai, calerFiche: ((...a: Parameters<typeof vrai.calerFiche>) => (refusCalage.message ? { ok: false, problemes: [refusCalage.message] } : vrai.calerFiche(...a))) as typeof vrai.calerFiche };
});
import { doubles } from "../fabriquer/doubles";

/** La fiche que l'écriture simulée rend pour ce cas (récupérée par le chemin réel). */
async function ficheEcrite(): Promise<Record<string, unknown>> {
  let prise: Record<string, unknown> | null = null;
  const d = doubles({ retoucherFiche: (f) => ((prise = structuredClone(f)), f) });
  await fabriquerCasConcret(d.options);
  return prise!;
}

/** La fiche est fournie (l'écriture est sautée) : la marque n'est plus posée par le Studio. */
function avecFiche(d: ReturnType<typeof doubles>, fiche: unknown) {
  d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
  d.options.lireFiche = async () => structuredClone(fiche);
  return d;
}

async function sansMarque(): Promise<Record<string, unknown>> {
  const f = await ficheEcrite();
  (f.ecrans as { marque: string }[])[1].marque = "www.Axion-IA.com";
  return f;
}

async function refus(d: ReturnType<typeof doubles>) {
  try {
    await fabriquerCasConcret(d.options);
  } catch (e) {
    if (e instanceof ErreurFabricationCasConcret) return e;
    throw e;
  }
  return null;
}

describe("e) R09 : un écran sans la marque", () => {
  it("la fabrication finit, la marque est remise et dite en « À vérifier »", async () => {
    const d = avecFiche(doubles(), await sansMarque());
    const r = await fabriquerCasConcret(d.options);
    expect(r.fiche.ecrans.every((e) => e.marque === "axion-ia.com")).toBe(true);
    expect(r.remarquesScript.join(" ")).toContain("marque remise");
  });
  it("g) une fiche juste du premier coup : aucune réserve en plus", async () => {
    const r = await fabriquerCasConcret(doubles().options);
    expect(r.remarquesScript.join(" ")).not.toContain("marque remise");
    expect(r.reservesVoix.join(" ")).not.toContain("Calage approché");
  });
  it("contre-épreuve : un autre refus (réseau absent) reste un refus", async () => {
    const e = await refus(avecFiche(doubles({ reseaux: [] }), await sansMarque()));
    expect(e?.etape).toBe("fiche");
  });
});

/** Le calage exact est refusé à la demande (tout le reste de la chaîne est le vrai code). */
describe("c) CC11 : calage exact impossible", () => {
  it("la fabrication finit en « calage approché », avec la réserve « À vérifier »", async () => {
    refusCalage.message = "Écran e03 · l'écran ne dure pas (début 5000 ms, fin 5000 ms) : ses mots ne sont pas dits après ceux de l'écran précédent.";
    const r = await fabriquerCasConcret(doubles().options);
    expect(r.reservesVoix).toContain("Calage approché : écrans répartis sur la voix sans heures exactes. À vérifier.");
    expect(r.fiche.ecrans.length).toBeGreaterThan(0);
  });
  it("d) contre-épreuve : « aucun mot entendu » reste un refus d'étape calage, mots inchangés", async () => {
    refusCalage.message = "Aucun mot entendu dans la voix : il n'y a rien à caler.";
    const e = await refus(doubles());
    expect(e?.etape).toBe("calage");
    expect(e?.raisons.join(" ")).toContain("Aucun mot entendu");
  });
  it("sans refus du calage exact : aucune réserve de calage approché", async () => {
    refusCalage.message = null;
    const r = await fabriquerCasConcret(doubles().options);
    expect(r.reservesVoix.join(" ")).not.toContain("Calage approché");
  });
});

describe("f) CC8 : le script modifié est jugé comme à la fabrication", () => {
  const MDP = "reparations-cc8";
  const CAS = "recrutement-apporteurs";
  beforeAll(async () => {
    process.env.SESSION_SECRET = "t".repeat(48);
    const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  });
  beforeEach(async () => {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    reinitialiserDepots();
    reinitialiserRequete();
    await (await import("@/services/auth")).seConnecter(MDP, false);
  });
  afterEach(() => vi.restoreAllMocks());

  it("une remarque (le texte tutoie) : refusée avant, acceptée maintenant, la remarque est rendue", async () => {
    const scripts = await import("@/services/cas-concret-scripts");
    const m = [{ rang: 1, texteDit: "On recrute tes collaborateurs sans" }];
    const p = await scripts.controlerScriptValideCasConcret(CAS, m);
    expect(p.filter((x) => x.niveau === "bloquant")).toEqual([]);
    expect(p.some((x) => x.niveau === "info" && /tutoie/.test(x.texte))).toBe(true);
    const r = await scripts.modifierScriptValideCasConcret(CAS, m);
    expect(r.modifie).toBe(true);
  });
  it("un mot interdit ajouté reste refusé", async () => {
    const scripts = await import("@/services/cas-concret-scripts");
    const { depots } = await import("@/donnees/memoire");
    const T0 = "2026-10-01T10:00:00.000Z";
    await depots().contexteAxion.enregistrer({ id: "contexte-axion-v1", version: 1, positionIds: [], piliers: [], interdits: [], jargonAutorise: [], jargonInterdit: ["bidule"], promessesInterdites: [], carnetVoix: [], termesVagues: [], rolesDestinataires: [], creeLe: T0, modifieLe: T0 });
    const m = [{ rang: 1, texteDit: "On recrute nos bidule sans" }];
    const p = await scripts.controlerScriptValideCasConcret(CAS, m);
    expect(p.some((x) => x.niveau === "bloquant" && /bidule|interdit/i.test(x.texte))).toBe(true);
    await expect(scripts.modifierScriptValideCasConcret(CAS, m)).rejects.toThrow(/ne passe pas les contrôles/);
  });
  it("un chiffre tiré d'un fait reste refusé", async () => {
    const scripts = await import("@/services/cas-concret-scripts");
    await expect(scripts.modifierScriptValideCasConcret(CAS, [{ rang: 2, ecrits: ["5 minutes", null, null, null] }])).rejects.toThrow(/vient d'un fait du cas/);
  });
});

describe("e bis) R09 : une AUTRE adresse écrite reste un refus", () => {
  it("la marque « autre-site.fr » n'est pas remise : échec « fiche », avant toute voix", async () => {
    const f = await ficheEcrite();
    (f.ecrans as { marque: string }[])[1].marque = "autre-site.fr";
    const d = avecFiche(doubles(), f);
    const err = await refus(d);
    expect(err?.etape).toBe("fiche");
    expect(err?.message).toMatch(/marque/i);
    expect(d.reservationsVoix).toHaveLength(0);
  });
});
