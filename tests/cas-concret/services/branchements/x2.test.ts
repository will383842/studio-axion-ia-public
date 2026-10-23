/**
 * X2 : raccord des appels détachés (`appelsDetaches`, `src/services/cas-concret-branchements.ts`). L'appel d'écriture
 * part sans être attendu ; sa réponse est gardée dans les paramètres du studio et relue ; une panne de l'appel est gardée
 * en phrase fixe. Base en mémoire, rendu simulé : aucun appel réseau, rien de payé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

/** V4-3 : ces essais exercent l'écriture de Claude comme avant (aucun script validé, aucun arrêt « à valider ») ; les deux ont leurs tests (`tests/cas-concret/script-valide/`). */
const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

const VIDEO = "v-03";

function commande(): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: VIDEO,
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId: "recrutement-apporteurs", porte: "porte-a", mot: "APPORT", avecMot: true, reseaux: ["facebook"], essai: false, codeSuivi: "cc-recrutement-apporteurs-abc123" } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

/** Laisse finir ce qui est déjà parti (écriture de la réponse dans les paramètres). */
const vider = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  reinitialiserDepots();
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

describe("X2 · raccord des appels détachés", () => {
  it("garde la réponse dans les paramètres du studio, et une panne en phrase fixe", async () => {
    const a = b.appelsDetaches();
    expect(await a.lire("ccecr-x.1")).toBeNull();
    await a.lancer("ccecr-x.1", async () => ({ ok: true, simule: false, donnees: { fiche: 1 }, coutUsd: 0.12 }));
    await a.lancer("ccecr-x.2", async () => {
      throw new Error("clé secrète sk-123");
    });
    await vider();
    expect(await a.lire("ccecr-x.1")).toMatchObject({ ok: true, donnees: { fiche: 1 }, coutUsd: 0.12 });
    const panne = await a.lire("ccecr-x.2");
    expect(panne).toMatchObject({ ok: false, message: "l'appel n'a pas abouti." });
    expect(JSON.stringify(panne)).not.toContain("sk-123");
    expect(await depots().parametres.obtenir(`${b.PREFIXE_APPEL_DETACHE}ccecr-x.1`)).not.toBeNull();
  });

  it("un appel d'écriture qui ne répond pas : les passages rendent la main, un seul appel ; sa réponse fait continuer", async () => {
    let liberer: (() => void) | undefined;
    let horloge = 0;
    const appels: string[] = [];
    const dep: DependancesBranchementsCasConcret = {
      // Rendu simulé qui finit tout à la lecture suivante (son horloge avance d'une minute à chaque lecture).
      rendu: { service: creerServiceRenduSimule(() => (horloge += 60_000)), simule: true },
      claudeActif: async () => true,
      verifierBudget: async () => {},
      verifierEtReserver: async () => {},
      executer: async (_v, role, entree) => {
        appels.push(role.id);
        if (role.id === "ecriture-cas-concret") await new Promise<void>((r) => (liberer = r));
        const sortie = role.simuler(entree);
        return { ok: true, simule: true, donnees: typeof sortie === "string" ? undefined : sortie, coutUsd: 0.2 };
      },
    };
    const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never);
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      travail = (await moteur.avancer(travail, c)).travail;
      expect(performance.now() - t0).toBeLessThan(2000);
      await vider();
    }
    expect(travail.statut).toBe("en_cours");
    expect(travail.etapes.find((e) => e.cle === "ecriture")?.statut).toBe("en_cours");
    expect(appels).toEqual(["ecriture-cas-concret"]);

    liberer!();
    await vider();
    for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
      travail = (await moteur.avancer(travail, c)).travail;
      await vider();
    }
    expect(travail.statut).toBe("termine");
    expect(appels.filter((r) => r === "ecriture-cas-concret")).toHaveLength(1);
  });
});
