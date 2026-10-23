/**
 * X3 : en production, la réponse d'un rôle sans schéma n'a pas de `donnees` : seulement son `texte` et sa raison d'arrêt.
 * Le raccord les garde (`reponseEcritureDepuis`), et c'est ce TEXTE qui est gardé dans les paramètres du studio puis relu
 * par les appels détachés (X2). Base en mémoire, rendu simulé : aucun appel réseau, rien de payé.
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

const VIDEO = "v-x3";

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

const vider = () => new Promise((r) => setTimeout(r, 0));
/** Laisse finir l'écriture de la réponse (chargement du module des paramètres compris). */
const attendreReponse = async (lire: () => Promise<unknown>) => {
  for (let i = 0; i < 50; i++) {
    const v = await lire();
    if (v) return v;
    await vider();
  }
  return null;
};

beforeEach(() => {
  reinitialiserDepots();
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

describe("X3 · raccord : le texte de la réponse", () => {
  it("reponseEcritureDepuis garde le texte et la raison d'arrêt (et `donnees` quand il existe)", () => {
    expect(b.reponseEcritureDepuis({ ok: true, simule: false, texte: "{\"a\":1}", stopReason: "max_tokens", coutUsd: 0.3 })).toEqual({ ok: true, simule: false, texte: "{\"a\":1}", stopReason: "max_tokens", coutUsd: 0.3 });
    expect(b.reponseEcritureDepuis({ ok: true, simule: true, donnees: { a: 1 }, coutUsd: 0 })).toEqual({ ok: true, simule: true, donnees: { a: 1 }, coutUsd: 0 });
    expect(b.reponseEcritureDepuis({ ok: false, arret: "indisponible", message: "Non." })).toEqual({ ok: false, arret: "indisponible", message: "Non." });
  });

  it("les paramètres du studio gardent le texte de la réponse, relu tel quel", async () => {
    const a = b.appelsDetaches();
    await a.lancer("ccecr-x3.1", async () => ({ ok: true, simule: false, texte: "{\"fiche\":1}", stopReason: "end_turn", coutUsd: 0.12 }));
    expect(await attendreReponse(() => a.lire("ccecr-x3.1"))).toMatchObject({ ok: true, texte: "{\"fiche\":1}", stopReason: "end_turn", coutUsd: 0.12 });
  });

  it("réponse de production (texte seul) : l'écriture détachée la garde, la relit et la vidéo va au bout, un seul appel", async () => {
    let horloge = 0;
    const appels: string[] = [];
    const dep: DependancesBranchementsCasConcret = {
      rendu: { service: creerServiceRenduSimule(() => (horloge += 60_000)), simule: true },
      claudeActif: async () => true,
      verifierBudget: async () => {},
      verifierEtReserver: async () => {},
      // 18/10 : sans mémoire anti-copie ici (le « texte de Claude » est le gabarit, dont la question finale est celle de la v4).
      scriptsAnterieurs: async () => [],
      // Forme RÉELLE de `executerRolePourVideo` pour un rôle sans schéma, avec un plafond propre : `texte`, pas `donnees`.
      executer: async (_v, role, entree) => {
        appels.push(role.id);
        const sortie = role.simuler(entree);
        return { ok: true, simule: false, texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie), stopReason: "end_turn", coutUsd: 0.2 };
      },
    };
    const moteur = creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
    const c = commande();
    let travail: Travail = await moteur.lancer(c, { travailId: "tr-x3", versionId: "ver-x3", titre: "Essai" } as never);
    for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
      travail = (await moteur.avancer(travail, c)).travail;
      await vider();
    }
    expect(travail.etapes.filter((e) => e.statut === "echec").map((e) => e.erreur)).toEqual([]);
    expect(travail.statut).toBe("termine");
    expect(appels.filter((r) => r === "ecriture-cas-concret")).toHaveLength(1);
    const gardes = (await depots().parametres.lister()).filter((p) => p.id.startsWith(b.PREFIXE_APPEL_DETACHE));
    expect(gardes.length).toBeGreaterThan(0);
    for (const p of gardes) {
      const v = p.valeur as Record<string, unknown>;
      expect(typeof v.texte).toBe("string");
      expect(v.donnees).toBeUndefined();
    }
  });
});
