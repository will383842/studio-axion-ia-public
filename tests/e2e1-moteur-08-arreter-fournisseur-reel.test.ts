/**
 * E2E-1 n° 8 (MINEUR, 03/10) — « Arrêter » une fabrication dont la voix est lue : la dépense porte le fournisseur RÉEL
 * de chaque étape (la voix au nom de sa voix, ex. HeyGen), plus « montage-avocat ». Et la voix lue compte même si son
 * étape n'est pas finie (elle est payée). Aucun appel payant : voix d'essai qui se présente comme HeyGen.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { FournisseurVoix } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");

const MDP = "e2e1-moteur-arreter";

beforeAll(async () => {
  process.env.SESSION_SECRET = "i".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

describe("E2E-1 n° 8 · « Arrêter » : fournisseur réel de chaque étape", () => {
  it("moteur avocat : voix lue puis « Arrêter » → ligne « Voix » au nom de HeyGen, jamais « montage-avocat »", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const heygenEssai: FournisseurVoix = { ...fournisseurVoixSimulation, id: "heygen" };
    const m = creerMoteurMontageAvocat({ voix: () => heygenEssai });
    await boucle.contenuDuTour({ choisirMoteur: () => m }); // voix lue (payée), étape pas encore finie
    const r = await travaux.annulerTravail(travailId, () => m);
    expect(r!.depense.centimes).toBeGreaterThan(0);
    const lignes = (await depots().depenses.lister((d) => d.travailId === travailId)).flatMap((d) => d.lignes);
    expect(lignes).toEqual([expect.objectContaining({ etape: "Voix", fournisseur: "heygen" })]);
    expect(lignes.some((l) => l.fournisseur === "montage-avocat")).toBe(false);
  });

  it("moteur sans liste propre : chaque étape terminée prend le fournisseur de sa ligne estimée", async () => {
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const c = (await depots().versions.obtenir((await depots().travaux.obtenir(travailId))!.versionId!))!.commande;
    const estimees = (await moteurSimulation.estimer(c)).lignes;
    // Toutes les étapes simulées vont au bout, sauf la dernière : on arrête juste avant.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (let i = 0; i < 400; i++) {
        const t = (await depots().travaux.obtenir(travailId))!;
        const restantes = t.etapes.filter((e) => e.statut !== "terminee");
        if (restantes.length <= 1 || t.statut === "termine") break;
        vi.setSystemTime(Date.now() + 1000);
        await boucle.contenuDuTour({ choisirMoteur: () => moteurSimulation });
      }
    } finally {
      vi.useRealTimers();
    }
    await travaux.annulerTravail(travailId, () => moteurSimulation);
    const lignes = (await depots().depenses.lister((d) => d.travailId === travailId)).flatMap((d) => d.lignes);
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes) expect(estimees.map((e) => e.fournisseur)).toContain(l.fournisseur);
  });
});
