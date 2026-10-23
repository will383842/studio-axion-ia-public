/**
 * CORRECTEUR 1 (argent) — B6 : la confirmation au-delà du seuil (20 € par défaut) n'est plus jamais écrite en dur sur
 * un chemin payant. Elle vient de l'écran : « Fabriquer les N » envoie le TOTAL que Will a vu (lot compris) ; le
 * serveur refuse `CONFIRMATION_REQUISE` tant que ce total n'a pas été confirmé. Tout simulé, aucune clé, aucun réseau.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const fr = await import("@/services/fabrication-reseaux");
const credits = await import("@/services/credits");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "c1-argent-b6";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
});

async function sujetValide(): Promise<string> {
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement de l'écriture");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
  await bg.validerVariantes(vs.map((v) => v.id));
  return r.scriptMaitreId;
}

/** Seuil de confirmation très bas : tout lancement payant le dépasse. */
const seuilBas = () => ecrireParametre("budget.seuilConfirmation", { centimes: 1, devise: "EUR" });

describe("B6 · « Fabriquer les N » : le TOTAL du lot est confirmé à l'écran", () => {
  it("sans total confirmé : CONFIRMATION_REQUISE, rien n'est créé", async () => {
    const id = await sujetValide();
    await seuilBas();
    const videosAvant = await depots().videos.compter();
    await expect(fr.fabriquerLesN(id, { operationId: "op-b6-a", lancer: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await depots().videos.compter()).toBe(videosAvant);
  }, 60_000);

  it("total confirmé plus bas que le vrai total (prix changé) : CONFIRMATION_REQUISE", async () => {
    const id = await sujetValide();
    await seuilBas();
    const plan = (await fr.planFabricationSujet(id))!;
    await expect(fr.fabriquerLesN(id, { operationId: "op-b6-b", lancer: true, totalConfirme: plan.total.centimes - 1 })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
  }, 60_000);

  it("total confirmé = total affiché : la mère part", async () => {
    const id = await sujetValide();
    await seuilBas();
    const plan = (await fr.planFabricationSujet(id))!;
    const r = await fr.fabriquerLesN(id, { operationId: "op-b6-c", lancer: true, totalConfirme: plan.total.centimes });
    expect(r.travailId).toBeTruthy();
  }, 60_000);
});

describe("B6 · « Fabriquer cette version » : confirmation venue de l'écran", () => {
  it("au-delà du seuil sans confirmation : CONFIRMATION_REQUISE ; confirmée : elle part", async () => {
    const id = await sujetValide();
    await seuilBas();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id && x.etat === "validee"))[0];
    const refus = await bg.fabriquerVariante(v.id, { operationId: "op-b6-v1", lancer: true }).catch((e: { code?: string; montant?: number }) => e);
    expect(refus).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Seconde relecture paquet 4 (R2) : au-delà du seuil, c'est le MONTANT vu qui confirme (`true` ne suffit plus).
    await expect(bg.fabriquerVariante(v.id, { operationId: "op-b6-v1b", lancer: true, prixConfirme: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const r = await bg.fabriquerVariante(v.id, { operationId: "op-b6-v2", lancer: true, prixConfirme: (refus as { montant: number }).montant });
    expect(r.travailId ?? r.enAttente).toBeTruthy();
  }, 60_000);
});

/** Fichiers de code (hors tests) sous un dossier. */
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("B6 · garde : aucune confirmation de dépense écrite en dur", () => {
  it("ni `confirme: true` ni `verifierBudgetEtCredits(…, true, …)` dans le code du studio", () => {
    const fautes: string[] = [];
    for (const f of fichiers(join(process.cwd(), "src"))) {
      const lignes = readFileSync(f, "utf8").split("\n");
      const code = lignes.filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join("\n");
      if (/confirme:\s*true\b/.test(code)) fautes.push(`${f} : confirme: true`);
      if (/verifierBudgetEtCredits\([^;]*?,\s*true\s*,/.test(code.replace(/\n/g, " "))) fautes.push(`${f} : verifierBudgetEtCredits(…, true, …)`);
    }
    expect(fautes).toEqual([]);
  });
});
