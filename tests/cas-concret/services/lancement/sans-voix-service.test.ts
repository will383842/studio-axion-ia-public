/**
 * CC-SV · mode sans voix : `estimerCas` et `preparerEtLancer` (aucune voix requise, total 0 €), et les outils de commande
 * (aucune voix lue, garde de production non relâchée pour le reste, L1-05 entière). Doubles seulement : rien n'est dépensé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../../../helpers/script-relu";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const b = await import("@/services/cas-concret-branchements");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { VoixNonEpingleeError } = await import("@/briques/voix-maitre");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");
const { estimerDepuisCas } = await import("@/moteurs/montage-cas-concret");

import type { CommandeFabrication } from "@/domaine/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";
import type { StockageFichiers } from "@/fournisseurs/types";

const MDP = "cas-concret-sans-voix";
const RESEAUX = ["facebook", "instagram"];
const CAS = "recrutement-apporteurs";

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

/** Aucune voix prête pour le format : « moi » n'a plus que des voix en brouillon. */
async function retirerLesVoixPretes() {
  const d = depots();
  for (const v of await d.voix.lister()) await d.voix.modifier(v.id, { statut: "brouillon" } as never);
}

describe("estimerCas · sans voix", () => {
  it("aucune ligne « voix », même total que le calcul sans voix, aucun refus « voix pas prête »", async () => {
    await retirerLesVoixPretes();
    const avec = await service.estimerCas(CAS, RESEAUX, false, { essai: true });
    const sans = await service.estimerCas(CAS, RESEAUX, false, { essai: true, sansVoix: true });
    expect(sans.refus).toBeUndefined();
    const attendu = estimerDepuisCas(trouverCas(CAS)!, RESEAUX as never, false, { voix: null }).total.centimes;
    expect(sans.centimes).toBe(attendu);
    expect(sans.centimes).toBeLessThanOrEqual(avec.centimes);
    // Voix non prête et sans le mode : refus (inchangé).
    expect(avec.refus).toBeDefined();
  });
  it("seul `sansVoix === true` allume le mode (une chaîne « true » ne saute pas le contrôle de voix)", async () => {
    await retirerLesVoixPretes();
    const f = await service.estimerCas(CAS, RESEAUX, false, { essai: true, sansVoix: "true" as never });
    expect(f.refus).toBeDefined();
  });
});

describe("preparerEtLancer · sans voix", () => {
  it("sans voix prête : lancée, sansVoix figé dans les entrées, total 0 € de voix", async () => {
    await retirerLesVoixPretes();
    const feuille = await service.estimerCas(CAS, RESEAUX, false, { essai: true, sansVoix: true });
    const lancer = vi.fn(async () => ({ travailId: "t-sv" }));
    const r = await service.preparerEtLancer({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: false, essai: true, sansVoix: true, accordCentimes: feuille.centimes, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(r.statut).toBe("lancee");
    expect(lancer).toHaveBeenCalledWith(expect.any(String), feuille.centimes);
    const video = (await depots().videos.lister((v) => v.formatId === "cas-concret"))[0];
    expect(JSON.stringify(video.entrees)).toContain('"sansVoix":true');
  });
  it("une valeur « vraie » qui n'est pas `true` ne lance rien sans voix prête", async () => {
    await retirerLesVoixPretes();
    const lancer = vi.fn(async () => ({ travailId: "t-x" }));
    const r = await service.preparerEtLancer({ casId: CAS, reseaux: RESEAUX, mot: "IA", avecMot: false, essai: true, sansVoix: "true" as never, accordCentimes: 0, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(r.statut).not.toBe("lancee");
    expect(lancer).not.toHaveBeenCalled();
  });
});

const commande = (entreesCas: Record<string, unknown>) => ({
  versionContrat: 2, moteurId: "montage-cas-concret", videoId: "v-sv", formatId: "cas-concret", versionFormat: 1, profilRenduVersion: 1, dureeCibleSec: 50, ratios: ["9:16"],
  script: { blocs: [], texteComplet: "" },
  distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "heygen", voixId: "voix-clara" }],
  styles: { sousTitres: null, decor: null, lut: null, musique: null }, briques: {},
  entrees: { casConcret: { casId: CAS, porte: "porte-a", mot: "APPORT", avecMot: true, reseaux: ["facebook"], essai: false, codeSuivi: "cc-x", ...entreesCas } },
  reglages: {}, plans: [], prononciations: [], budgetMax: { centimes: 0, devise: "EUR" }, construiteLe: "2026-10-18T09:00:00.000Z",
}) as unknown as CommandeFabrication;

function espions(rendu = true) {
  const verifierEtReserver = vi.fn(async () => {});
  const executer = vi.fn();
  const claudeActif = vi.fn(async () => true);
  const stockage = { type: "stockage", mode: "reel", preparerDepot: vi.fn(), confirmerDepot: vi.fn(), urlLecture: vi.fn(), urlLectureDuree: vi.fn(), urlDepotDuree: vi.fn() } as unknown as StockageFichiers;
  const dep = { rendu: { service: creerServiceRenduSimule(() => 0), simule: !rendu }, scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42, verifierEtReserver, executer: executer as never, claudeActif, stockage } as DependancesBranchementsCasConcret;
  return { dep, verifierEtReserver, executer };
}

describe("outilsCasConcret · sans voix, production reliée", () => {
  it("aucune voix lue, aucune ressource exigée, aucun refus STUDIO_NON_RELIE", async () => {
    const { dep, verifierEtReserver, executer } = espions();
    const prod = { ...dep, production: true } as DependancesBranchementsCasConcret;
    const lire = vi.spyOn(depots().voix, "obtenir");
    const ress = vi.spyOn(depots().ressourcesFournisseurs, "lister");
    await expect(b.outilsCasConcret(commande({ sansVoix: true }), "tr", prod)).resolves.toBeDefined();
    expect(lire).not.toHaveBeenCalled();
    expect(ress).not.toHaveBeenCalled();
    expect(verifierEtReserver).not.toHaveBeenCalled();
    expect(executer).not.toHaveBeenCalled();
  });
  it("la garde de production tient toujours pour le reste (rendu simulé : STUDIO_NON_RELIE)", async () => {
    const { dep } = espions(false);
    const prod = { ...dep, production: true } as DependancesBranchementsCasConcret;
    await expect(b.outilsCasConcret(commande({ sansVoix: true }), "tr", prod)).rejects.toThrow(b.STUDIO_NON_RELIE);
  });
});

describe("outilsCasConcret · L1-05 reste entière avec voix", () => {
  it.each([[{}], [{ sansVoix: "oui" }], [{ sansVoix: false }]])("voix elevenlabs, entrées %j : refusée, rien dépensé", async (entrees) => {
    const { dep, verifierEtReserver, executer } = espions();
    await depots().voix.modifier("voix-clara", { fournisseur: "elevenlabs" } as never);
    await expect(b.outilsCasConcret(commande(entrees), "tr", dep)).rejects.toBeInstanceOf(VoixNonEpingleeError);
    expect(verifierEtReserver).not.toHaveBeenCalled();
    expect(executer).not.toHaveBeenCalled();
  });
});
