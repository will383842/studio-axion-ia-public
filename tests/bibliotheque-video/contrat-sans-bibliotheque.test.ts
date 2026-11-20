/**
 * C1-U10 : contrat « sans bibliothèque » sur les moteurs déjà testés par `testerMoteurVideo`, avec la même fabrique de commande
 * (cas concret, avocat, simulation). Aucun moteur ne lit la bibliothèque aujourd'hui.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { banc } from "../cas-concret/moteur/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { construireCommande } = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { moteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { testerMoteurSansBibliotheque } = await import("@/moteurs/contrat");

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const empreinte = await hash("essai-c1-u10", { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

// Cas concret : même fabrique que tests/cas-concret/contrat.test.ts:16.
const b = banc();
testerMoteurSansBibliotheque(b.moteur, async () => b.commande());

// Avocat : même fabrique que tests/montage-avocat.contrat.test.ts:83.
testerMoteurSansBibliotheque(moteurMontageAvocat, async () => {
  reinitialiserDepots();
  await ecrireParametre("bibliothequeVideo.avocat", false); // v20g : avocat allumé par défaut, `false` écrit en base
  return construireCommande("v-03");
});

// Simulation : même fabrique que tests/services.test.ts:35.
testerMoteurSansBibliotheque(moteurSimulation, async () => {
  reinitialiserDepots();
  await ecrireParametre("bibliothequeVideo.avocat", false); // v20g : la vidéo v-03 est au format avocat
  return construireCommande("v-03");
});
