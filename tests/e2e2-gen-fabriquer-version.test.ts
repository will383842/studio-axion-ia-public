/**
 * Vérification E2E n° 2, parcours n° 2 : « Fabriquer cette version » REFUSÉ (budget du mois, crédit insuffisant)
 * laissait un brouillon rattaché à la version : la ligne n'offrait plus que « Vidéo » (assistant, bouton grisé sans
 * raison) et rien ne repartait. Après correction : rien n'est rattaché, la raison remonte, le bouton « Fabriquer »
 * reste sur la version ; le refus arrive AVANT toute création (`verifierAvantDeCreer`) ; si un refus arrive au lancement
 * même, le brouillon est détaché et repris au toucher suivant (jamais doublé ni effacé).
 * Simulation, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre } = await import("@/services/_commun");
type ErreurStudio = import("@/services/_commun").ErreurStudio;
const { centimes } = await import("@/lib/montants");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "essai-e2e2-gen-fabriquer";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => bg.arreterBoucleGeneration());

describe("E2E-2 parcours n° 2 · « Fabriquer cette version » refusé", () => {
  it("budget dépassé : raison remontée, version sans brouillon rattaché ; budget relevé : le même brouillon repart", async () => {
    const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
    if (!r.ok) throw new Error("lancement");
    await bg.tourBoucleGeneration();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
    await depots().variantes.modifier(v.id, { etat: "validee" });
    await ecrireParametre("budget.mensuel", centimes(1));
    const brouillonsAvant = await depots().videos.compter((x) => x.statut === "brouillon");

    const e = await bg.fabriquerVariante(v.id, { operationId: "op-a", lancer: true }).then(() => null, (x: ErreurStudio) => x);
    expect(e?.code).toBe("BUDGET_DEPASSE");
    expect(e?.message).toMatch(/budget/i);
    // Rien de rattaché : la version garde son bouton « Fabriquer » ; aucun brouillon orphelin dans « Brouillons ».
    expect((await depots().variantes.obtenir(v.id))?.videoId).toBeUndefined();
    expect(await depots().videos.compter((x) => x.statut === "brouillon")).toBe(brouillonsAvant);
    expect(await depots().videos.compter((x) => x.varianteId === v.id)).toBe(0);

    // Deuxième refus (nouvelle opération) : toujours rien de créé.
    const toutesAvant = await depots().videos.compter();
    await bg.fabriquerVariante(v.id, { operationId: "op-b", lancer: true }).catch(() => undefined);
    expect(await depots().videos.compter()).toBe(toutesAvant);

    // Budget relevé : un toucher suffit, la vidéo part.
    await ecrireParametre("budget.mensuel", centimes(15000));
    const ok = await bg.fabriquerVariante(v.id, { operationId: "op-c", lancer: true });
    expect(ok.travailId).toBeTruthy();
    expect((await depots().variantes.obtenir(v.id))?.videoId).toBe(ok.videoId);
    // Une seule vidéo pour toute l'affaire : les refus n'en ont créé aucune.
    expect(await depots().videos.compter()).toBe(toutesAvant + 1);
  });
});
