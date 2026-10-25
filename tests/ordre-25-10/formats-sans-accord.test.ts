/**
 * Lot 5 « le prix ne bloque jamais » (règle produit du 25/10/2026), autres formats : séries, décors, reprises d'écriture,
 * tableau animé, cas concret. Pour chaque format : en mode indicatif aucun accord-requis (ni arrêt de prix) et un appel part ;
 * témoin en mode bloquant : l'ancien comportement. Dépôts en mémoire, aucun réseau, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "../helpers/g0";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const couts = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");
const { CLE_MODE_BUDGET } = await import("@/services/mode-budget");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");
const serie = await import("@/services/serie-ecriture");

const MDP = "formats-sans-accord";
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;
const REGLAGES = { reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", adresse: "vous" as const, mode: "avatar" as const, objectif: "notoriete" as const };
const IDEES = [...SUJETS_BANC.map((s) => s.idee), "Les réunions qui auraient pu être un e-mail", "Le devis refait trois fois"];

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});
afterEach(() => {
  gc.injecterClaudePourEssai(null);
  bg.arreterBoucleGeneration();
});

async function brancherClaude() {
  await ecrireParametre("fournisseur.script", "claude");
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: fetchInterdit, attenteMs: () => 0 });
  await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 10_000);
  const b = await couts.resumeBudget();
  await ecrireParametre("budget.mensuel", { centimes: b.depense.centimes + b.engage.centimes + 1_000_000, devise: "EUR" });
}

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("séries — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
  });

  it(indicatif ? "au-delà du seuil, sans total confirmé : la série part" : "témoin : au-delà du seuil, sans total confirmé, CONFIRMATION_REQUISE et rien n'est créé", async () => {
    await brancherClaude();
    const prix = (await bg.prixLancement()).centimes;
    await ecrireParametre("budget.seuilConfirmation", { centimes: 2 * prix, devise: "EUR" });
    const textes = IDEES.slice(0, 3);
    const lancement = serie.lancerSerie(textes.map((texte) => ({ texte })), REGLAGES, `serie-${mode}`);
    if (!indicatif) {
      await expect(lancement).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
      expect(await depots().scriptsMaitres.compter((m) => !m.estDemo && textes.includes(m.brief.idee))).toBe(0);
      return;
    }
    const { serie: s } = await lancement;
    expect(s.elements.map((e) => e.sort)).toEqual(["parti", "parti", "parti"]);
  });
});

const decors = await import("@/services/decors");

describe.each([
  ["indicatif", true],
  ["bloquant", false],
] as const)("décors — mode %s", (mode, indicatif) => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, mode);
  });

  it(indicatif ? "« Un décor en une phrase » sans confirmation du coût : les 3 propositions partent" : "témoin : sans confirmation du coût, « Confirmez d'abord »", async () => {
    const lancement = decors.demanderDecor("Un bureau en bois avec une bibliothèque", { confirme: false });
    if (!indicatif) return void (await expect(lancement).rejects.toThrow(/Confirmez/));
    expect((await lancement).propositionIds).toHaveLength(3);
  });

  it(indicatif ? "Look de décor sans confirmation du coût : un look par angle" : "témoin : Look de décor sans confirmation, « Confirmez d'abord »", async () => {
    const lancement = decors.preparerLookDecor("decor-r2-bibliotheque", { confirme: false });
    if (!indicatif) return void (await expect(lancement).rejects.toThrow(/Confirmez/));
    expect((await lancement).crees.sort()).toEqual(["face", "trois-quarts"]);
  });
});
