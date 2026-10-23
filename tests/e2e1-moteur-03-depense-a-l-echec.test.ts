/**
 * E2E-1 n° 3 (MAJEUR, 03/10) — une fabrication qui échoue définitivement APRÈS avoir payé la voix enregistre cette
 * dépense (comme « Arrêter ») : budget du mois et coûts par outil justes. « Réessayer » puis la fin normale ne la
 * comptent pas une seconde fois. Une maquette en panne après la voix l'enregistre aussi. Aucun appel payant.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";
import type { ServiceRendu } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { creerMoteurMontageAvocat } = await import("@/moteurs/montage-avocat");
const { lignesRestantes } = await import("@/moteurs/couts-etapes");
const { centimes } = await import("@/lib/montants");

const MDP = "e2e1-moteur-depense";

beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  boucle.avancementsEnVol().clear();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("moteur.avocat", "montage-avocat");
  for (const x of await depots().travaux.lister((x) => x.statut === "en_cours" || x.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
});

/** studio-rendu qui refuse définitivement (son illisible) : la fabrication échoue après la lecture de la voix. */
const renduRefus: ServiceRendu = {
  soumettre: async () => {
    throw Object.assign(new Error("son illisible"), { reessayable: false });
  },
  etat: async () => ({ statut: "inconnu" }),
};

const l = (etape: string, fournisseur: string, c: number): LigneCout => ({ etape, fournisseur, unite: "forfait", quantite: 1, prixUnitaire: centimes(c), total: centimes(c), nature: "reel" });

describe("E2E-1 n° 3 · dépense des étapes payées à l'échec", () => {
  it("refus définitif après la voix : la voix payée est enregistrée (vidéo, version, dépense du travail)", async () => {
    const { travailId, versionId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const coutAvant = (await depots().videos.obtenir("v-03"))!.coutReel?.centimes ?? 0;
    const m = creerMoteurMontageAvocat({ rendu: renduRefus });
    await boucle.contenuDuTour({ choisirMoteur: () => m }); // lecture de la voix (payée), gardée
    await boucle.contenuDuTour({ choisirMoteur: () => m }); // analyse refusée : abandon
    const t = (await depots().travaux.obtenir(travailId))!;
    expect(t.statut).toBe("echec");
    const voix = (t.parametres?.voix as { brut: { coutCentimes: number } }).brut.coutCentimes;
    expect(voix).toBeGreaterThan(0);
    const deps = await depots().depenses.lister((d) => d.travailId === travailId);
    expect(deps).toHaveLength(1);
    expect(deps[0].lignes).toEqual([expect.objectContaining({ etape: "Voix", fournisseur: "simulation", nature: "reel" })]);
    expect(deps[0].total.centimes).toBe(voix);
    expect((await depots().videos.obtenir("v-03"))!.coutReel?.centimes).toBe(coutAvant + voix);
    expect((await depots().versions.obtenir(versionId))!.coutReel?.centimes).toBe(voix);
  });

  it("déjà enregistré pour le travail = jamais recompté (échec, « Réessayer », fin normale)", () => {
    const deja = [l("Voix", "heygen", 120)];
    expect(lignesRestantes([l("Voix", "heygen", 120), l("Double", "heygen", 300)], deja)).toEqual([l("Double", "heygen", 300)]);
    // Une étape payée en partie avant l'échec : seul le reste est ajouté.
    expect(lignesRestantes([l("Illustrations fabriquées", "fal.ai", 90)], [l("Illustrations fabriquées", "fal.ai", 40)])).toEqual([l("Illustrations fabriquées", "fal.ai", 50)]);
  });

  it("maquette en panne après la lecture de la voix : l'erreur porte la voix payée (le service l'enregistre)", async () => {
    const m = creerMoteurMontageAvocat({ rendu: renduRefus, pauseMs: 0 });
    const c = await fabrication.construireCommande("v-03");
    const erreur = (await m.maquette(c).catch((e) => e)) as { lignesPayees?: LigneCout[] };
    expect(erreur.lignesPayees).toEqual([expect.objectContaining({ etape: "Voix", nature: "reel" })]);
    expect(erreur.lignesPayees![0].total.centimes).toBeGreaterThan(0);
  });
});
