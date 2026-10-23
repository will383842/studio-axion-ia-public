/**
 * Portage phase 2 · P3 : l'écran fourni est derrière `casConcret.ecranFourni` (éteint par défaut). Éteint : ni lien
 * « Fournir cet écran », ni page, ni dépôt, et la fabrication ignore tout écran déjà gardé. Allumé : comme #167.
 * Base en mémoire, aucun appel réel, `fetch` interdit.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { deposerFichierSimule } = await import("@/services/fichiers");
const { ecrireParametre } = await import("@/services/_commun");
const ecrans = await import("@/components/formats/cas-concret/ecran-fourni/service");
const { versVueCas } = await import("@/components/formats/cas-concret/entree/vue");
const { casConsole } = await import("../p2c/cas-console");

const MDP = "cas-concret-p3";
const CAS = "recrutement-apporteurs";
const GARDE = { [CAS]: [{ etapeCas: 4, cle: "studio/dev/entree/x.png", mime: "image/png", masques: [], attesteLe: "2026-10-13T08:00:00.000Z" }] };
const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.stubGlobal("fetch", () => {
    throw new Error("fetch interdit");
  });
});

describe("P3 · écran fourni éteint par défaut", () => {
  it("la fabrication ignore un écran déjà gardé tant que le réglage est éteint", async () => {
    await ecrireParametre(ecrans.PARAM_ECRANS_FOURNIS, GARDE);
    expect(await ecrans.ecransFournisPourFabrication(CAS)).toEqual([]);
    await ecrireParametre("casConcret.ecranFourni", true);
    expect(await ecrans.ecransFournisPourFabrication(CAS)).toHaveLength(1);
  });

  it("le dépôt est refusé sans appel quand le réglage est éteint, et rien n'est gardé", async () => {
    const f = await deposerFichierSimule({ nom: "e.png", mime: "image/png", taille: 1200, typeEntite: ecrans.TYPE_ENVOI_ECRAN, entiteId: CAS });
    await expect(ecrans.poserEcranFourni({ casId: CAS, etapeCas: 4, fichierId: f.id, masques: [], attestation: true })).rejects.toThrow(/pas ouvert/);
    await ecrireParametre("casConcret.ecranFourni", true);
    expect(await ecrans.ecransFournisDuCas(CAS)).toEqual([]);
  });

  it("la feuille ne propose « Fournir cet écran » que si le réglage est allumé (5e argument de la vue)", () => {
    const formation = casConsole();
    expect(versVueCas(formation, "e", true).ecransAFournir).toBeUndefined();
    expect(versVueCas(formation, "e", true, undefined, true).ecransAFournir).toEqual([4]);
  });

  it("la page de l'écran fourni répond 404 tant que le réglage est éteint ; la page des cas le lit ; la fabrication passe par le service gardé", () => {
    const page = lire("src/app/(studio)/cas-concret/ecran-fourni/[casId]/page.tsx");
    expect(page).toContain("REGLAGES_CAS_CONCRET.ecranFourni");
    expect(page).toMatch(/!\(await reglageAllume\([^)]*\)\)\)?\s*notFound\(\)|if \(!.*reglageAllume.*\) notFound\(\)/);
    expect(lire("src/app/(studio)/cas-concret/page.tsx")).toContain("REGLAGES_CAS_CONCRET.ecranFourni");
    expect(lire("src/services/cas-concret-branchements.ts")).toContain("ecransFournisPourFabrication");
  });
});

describe("P3 · écran fourni : retrait et étape gardés comme le dépôt (relecture Opus)", () => {
  it("le retrait n'écrit rien tant que le réglage est éteint, ni pour un cas inconnu", async () => {
    await ecrireParametre(ecrans.PARAM_ECRANS_FOURNIS, GARDE);
    await expect(ecrans.retirerEcranFourni(CAS, 4)).rejects.toThrow(/pas ouvert/);
    await ecrireParametre("casConcret.ecranFourni", true);
    expect(await ecrans.ecransFournisDuCas(CAS)).toHaveLength(1);
    await expect(ecrans.retirerEcranFourni("cas-qui-n-existe-pas", 4)).rejects.toThrow(/n'existe plus/);
    const { lireParametre } = await import("@/services/_commun");
    expect(Object.keys(await lireParametre<Record<string, unknown>>(ecrans.PARAM_ECRANS_FOURNIS, {}))).toEqual([CAS]);
  });

  it("une étape qui n'est pas un nombre entier est refusée : rien n'est gardé en silence", async () => {
    await ecrireParametre("casConcret.ecranFourni", true);
    const f = await deposerFichierSimule({ nom: "e.png", mime: "image/png", taille: 1200, typeEntite: ecrans.TYPE_ENVOI_ECRAN, entiteId: CAS });
    await expect(ecrans.poserEcranFourni({ casId: CAS, etapeCas: "4" as unknown as number, fichierId: f.id, masques: [], attestation: true })).rejects.toThrow(/aucune étape/);
    expect(await ecrans.ecransFournisDuCas(CAS)).toEqual([]);
  });
});
