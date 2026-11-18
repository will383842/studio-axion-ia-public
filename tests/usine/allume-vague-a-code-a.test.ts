/**
 * ALLUME-VAGUE-A-CODE-a · deux réglages allumés PAR DÉFAUT DANS LE CODE (autorisation de Williams 17/11 22:25) :
 * `dosageMotion.actif` (absent = allumé) et `casConcret.cameraPlus` (absent = 1,048). Une valeur écrite en base l'emporte
 * (`false` / `1.035` éteignent). Prix identiques : 0 € de plus. Vraies fonctions de service, dépôts mémoire, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const casConcret = await import("@/services/cas-concret");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { avecDosageMotion } = await import("@/services/dosage-motion");
const { dosagePourEcran } = await import("@/services/dosage-motion-ecran");
const { DOSAGE_DEFAUT_CODE } = await import("@/briques/dosage-motion/crans");
const { lireEntreesCasConcret } = await import("@/moteurs/montage-cas-concret/etapes");
const { tirer } = await import("@/moteurs/montage-cas-concret/variete");
const { moteurDeCommande } = await import("@/moteurs");

import type { CommandeFabrication } from "@/domaine/types";

const MDP = "allume-vague-a-code-a";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];
const RACINE = join(__dirname, "..", "..");

beforeAll(async () => {
  process.env.SESSION_SECRET = "a".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  await ecrireParametre("moteur.avocat", "montage-avocat");
});

const commande = () =>
  ({ moteurId: "montage-avocat", intensite: { niveau: "equilibre", bruitages: "aucun" }, sousTitres: { base: "karaoke", intensite: "equilibre" } }) as unknown as CommandeFabrication;

describe("groupe 1 · dosage de l'animation", () => {
  it("(a) rien en base : la commande de l'avocat porte equilibre / generateur, intensité inchangée", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const c = commande();
    const r = (await avecDosageMotion(v, c)) as unknown as { dosageMotion: unknown; intensite: unknown };
    expect(r.dosageMotion).toEqual({ cran: "equilibre", choisiPar: "generateur" });
    expect(r.intensite).toEqual(c.intensite);
  });

  it("(a) rien en base : le choix « Animations » apparaît pour l'avocat (actif, defaut equilibre)", async () => {
    const r = await dosagePourEcran({ id: "avocat", moteur: "simulation" });
    expect(r).toEqual({ actif: true, generateur: "avocat", defaut: "equilibre" });
  });

  it("(b) false en base : même objet qu'avant (toBe), aucune clé, aucune carte", async () => {
    await ecrireParametre("dosageMotion.actif", false);
    const v = (await depots().videos.obtenir("v-03"))!;
    const c = commande();
    expect(await avecDosageMotion(v, c)).toBe(c);
    expect("dosageMotion" in c).toBe(false);
    expect(await dosagePourEcran({ id: "avocat", moteur: "simulation" })).toBeUndefined();
  });

  it("(c) le fil : la fabrication appelle avecDosageMotion ; DOSAGE_DEFAUT_CODE inchangé (equilibre partout sauf face caméra animée)", () => {
    expect(readFileSync(join(RACINE, "src/services/fabrication.ts"), "utf8")).toContain("avecDosageMotion(");
    expect(DOSAGE_DEFAUT_CODE.avocat).toBe("equilibre");
    expect(DOSAGE_DEFAUT_CODE.tableau).toBe("equilibre");
    expect(DOSAGE_DEFAUT_CODE["cas-concret"]).toBe("equilibre");
  });
});

describe("groupe 4 · caméra un peu plus ample du cas concret", () => {
  const entreesEcrites = async (): Promise<Record<string, unknown>> => {
    const r = await casConcret.preparerEtLancer(
      { casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT },
      { lancer: vi.fn(async () => ({ travailId: "t-allume-a" })) },
    );
    expect(r.statut).toBe("lancee");
    const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
    return (v!.entrees as { casConcret: Record<string, unknown> }).casConcret;
  };

  it("(a) rien en base : les entrées figées portent cameraPlus 1,048, relues par le moteur, posé sur le tirage", async () => {
    const e = await entreesEcrites();
    expect(e.cameraPlus).toBe(1.048);
    const relu = lireEntreesCasConcret({ casConcret: e } as never);
    expect(relu.cameraPlus).toBe(1.048);
    const t = tirer({ videoId: "video-allume-a", canaux: RESEAUX, historique: [], cameraPlus: relu.cameraPlus });
    expect(t.cameraPlus).toBe(1.048);
  });

  it("(b) 1.035 en base : aucune clé cameraPlus", async () => {
    await ecrireParametre("casConcret.cameraPlus", 1.035);
    expect(Object.keys(await entreesEcrites())).not.toContain("cameraPlus");
  });

  it("(c) le fil : fabriquer.ts passe cameraPlus à tirer", () => {
    expect(readFileSync(join(RACINE, "src/moteurs/montage-cas-concret/fabriquer.ts"), "utf8")).toMatch(/cameraPlus/);
  });
});

describe("groupe 6 · prix : 0 € de plus", () => {
  it("avocat : estimation identique, rien en base contre dosageMotion.actif = false", async () => {
    const v = (await depots().videos.obtenir("v-03"))!;
    const s = (await depots().scripts.obtenir(v.scriptId!))!;
    const mesurer = async () => {
      const c = await fabrication.construireCommande("v-03");
      const e = await fabrication.construireCommandeEstimation(v, s);
      return { prix: await moteurDeCommande(c).estimer(c), prixE: await moteurDeCommande(e).estimer(e) };
    };
    vi.useFakeTimers({ now: new Date("2026-11-16T10:00:00Z"), toFake: ["Date"] });
    try {
      const defaut = await mesurer();
      await ecrireParametre("dosageMotion.actif", false);
      expect(await mesurer()).toStrictEqual(defaut);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cas concret : estimation identique, rien en base contre 1.035 en base", async () => {
    const estimer = () => casConcret.estimerCas("recrutement-apporteurs", RESEAUX, true);
    const defaut = await estimer();
    await ecrireParametre("casConcret.cameraPlus", 1.035);
    expect(await lireParametre("casConcret.cameraPlus", null)).toBe(1.035);
    expect(await estimer()).toStrictEqual(defaut);
  });
});
