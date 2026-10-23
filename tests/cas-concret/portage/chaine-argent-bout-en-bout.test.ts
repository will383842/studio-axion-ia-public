/**
 * Portage phase 2 · P1 (grappe A), de bout en bout : on construit `outilsCasConcret(...)` avec des doubles et on passe
 * par `.ecriture`, comme le moteur. Budget refusé = `executer` (l'appel payant) n'est JAMAIS appelé ; la panne d'essai
 * `REFUS` rend toujours un texte vide ; l'arrondi du pré-vol est celui de master. Rien n'est réel, `fetch` interdit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const b = await import("@/services/cas-concret-branchements");
const { roleEcritureCasConcret } = await import("@/moteurs/montage-cas-concret/ecriture");

import type { CommandeFabrication } from "@/domaine/types";
import type { EntreeRole } from "@/generateur/roles/types";
import type { AppelsDetaches } from "@/moteurs/montage-cas-concret/outils";

const ENTREE = { contexte: {}, variable: "x" } as unknown as EntreeRole;
const demande = (coutEstimeUsd: number) => ({ etape: "Cas concret · écriture", coutEstimeUsd }) as never;

function commande(mot = "APPORT"): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: "v-arg",
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId: "recrutement-apporteurs", porte: "porte-a", mot, avecMot: true, reseaux: ["facebook"], essai: false, codeSuivi: "cc-recrutement-apporteurs-abc123" } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

const renduSimule = () => {
  let t = 0;
  return { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true };
};
const erreurCode = (code: string) => Object.assign(new Error("brut secret"), { code });
const executerOk = () => vi.fn(async () => ({ ok: true as const, simule: false, donnees: { a: 1 }, coutUsd: 0.1 }));

let fetchEspion: ReturnType<typeof vi.fn>;
beforeEach(() => {
  reinitialiserDepots();
  fetchEspion = vi.fn(() => {
    throw new Error("fetch interdit");
  });
  vi.stubGlobal("fetch", fetchEspion);
});
afterEach(() => {
  expect(fetchEspion).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("P1 · budget refusé : l'appel payant ne part jamais (par `outilsCasConcret(...).ecriture`)", () => {
  for (const [code, phrase] of [["BUDGET_DEPASSE", "Budget du mois atteint."], ["CREDIT_INSUFFISANT", "Crédit Claude insuffisant."]] as const) {
    it(`${code} : réservation refusée, \`executer\` et les appels détachés jamais appelés`, async () => {
      const executer = executerOk();
      const lancer = vi.fn(async () => undefined);
      const verifierBudget = vi.fn(async () => {
        throw erreurCode(code);
      });
      const o = await b.outilsCasConcret(commande(), "tr-arg", {
        rendu: renduSimule(),
        claudeActif: async () => true,
        socle: async () => undefined,
        executer,
        verifierBudget,
        appels: { lancer, lire: async () => null } as unknown as AppelsDetaches,
      });
      expect(await o.ecriture.budget.reserver(demande(0.5))).toEqual({ ok: false, message: phrase });
      expect(verifierBudget).toHaveBeenCalledTimes(1);
      expect(executer).not.toHaveBeenCalled();
      expect(lancer).not.toHaveBeenCalled();
    });
  }

  it("témoin : budget accepté, l'appel passe bien par `executer` (l'espion fonctionne)", async () => {
    const executer = executerOk();
    const o = await b.outilsCasConcret(commande(), "tr-arg", { rendu: renduSimule(), claudeActif: async () => true, socle: async () => undefined, executer, verifierBudget: async () => undefined });
    expect(await o.ecriture.budget.reserver(demande(0.5))).toEqual({ ok: true });
    expect(await o.ecriture.appeler(roleEcritureCasConcret, ENTREE)).toMatchObject({ ok: true, donnees: { a: 1 } });
    expect(executer).toHaveBeenCalledTimes(1);
  });
});

describe("P1 · panne d'essai REFUS", () => {
  it("l'écriture rend toujours un texte vide, à chaque essai, sans jamais appeler `executer`", async () => {
    const executer = executerOk();
    const o = await b.outilsCasConcret(commande("REFUSM"), "tr-arg", { rendu: renduSimule(), claudeActif: async () => false, executer });
    for (let essai = 0; essai < 3; essai++) expect(await o.ecriture.appeler(roleEcritureCasConcret, ENTREE), `essai ${essai + 1}`).toEqual({ ok: true, simule: true, texte: "" });
    expect(executer).not.toHaveBeenCalled();
  });

  it("un mot sans REFUS n'est pas touché : l'appel va à `executer`", async () => {
    const executer = executerOk();
    const o = await b.outilsCasConcret(commande("APPORT"), "tr-arg", { rendu: renduSimule(), claudeActif: async () => false, executer });
    expect(await o.ecriture.appeler(roleEcritureCasConcret, ENTREE)).toMatchObject({ ok: true, donnees: { a: 1 } });
    expect(executer).toHaveBeenCalledTimes(1);
  });
});

describe("P1 · l'arrondi du pré-vol est celui de master", () => {
  /** Formule de master (ligne `usd = centimes(Math.ceil(...))`), recopiée telle quelle : c'est la référence. */
  const attendu = (coutUsd: number, taux: number) => Math.ceil(coutUsd * 100 * Math.max(1, taux) - 1e-9);

  it("total estimé identique à la formule de master pour des coûts et des taux limites", async () => {
    const cas: [number, number][] = [[0.5, 1], [0.5, 0.92], [0.5, 0.86], [0.07, 1.1], [0.1, 1], [0.3, 1.0000001], [1.234, 0.9], [0, 1], [0.0001, 1], [2.5, 1.37]];
    for (const [cout, taux] of cas) {
      await ecrireParametre("taux.usdEur", taux);
      const vus: number[] = [];
      const o = await b.outilsCasConcret(commande(), "tr-arg", {
        rendu: renduSimule(),
        claudeActif: async () => true,
        socle: async () => undefined,
        executer: executerOk(),
        verifierBudget: async (e) => {
          vus.push(e.total.centimes);
          expect(e.lignes).toHaveLength(1);
          expect(e.lignes[0].total).toEqual(e.total);
          expect(e.lignes[0]).toMatchObject({ fournisseur: "anthropic", unite: "appel", quantite: 1, nature: "estime" });
        },
      });
      await o.ecriture.budget.reserver(demande(cout));
      expect(vus, `coût ${cout} $, taux ${taux}`).toEqual([attendu(cout, taux)]);
    }
  });
});
