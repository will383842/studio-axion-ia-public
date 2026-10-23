/**
 * L3-0 — correctif C de la relecture argent : la boucle de génération CONSERVE l'origine « usine » d'une écriture reprise
 * (les options figées au lancement la portent) au lieu de repasser sur le défaut manuel. Claude non branché : tout est
 * simulé, 0 €, aucun réseau.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/generation-claude", async (original) => {
  const reel = await original<typeof import("@/services/generation-claude")>();
  return { ...reel, executerRoleFacture: vi.fn(reel.executerRoleFacture) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const bg = await import("@/services/boucle-generation");
const gc = await import("@/services/generation-claude");
const credits = await import("@/services/credits");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "l3-0-origine-reprise";
const executer = vi.mocked(gc.executerRoleFacture);

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  executer.mockClear();
  bg.suspendreBoucleGeneration(true);
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
});

afterEach(() => {
  bg.arreterBoucleGeneration();
});

async function lancer(): Promise<string> {
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement de l'écriture");
  return r.generationId;
}

describe("C. l'origine d'une écriture reprise est conservée par la boucle", () => {
  it("options figées avec origine « usine » : chaque rôle est exécuté avec { origine: « usine » }", async () => {
    const generationId = await lancer();
    const cle = `generateur.chaine-options.${generationId}`;
    await ecrireParametre(cle, { ...(await lireParametre<object>(cle, {})), origine: "usine" });
    await bg.tourBoucleGeneration();
    expect(executer).toHaveBeenCalled();
    for (const appel of executer.mock.calls) expect(appel[3]).toMatchObject({ origine: "usine" });
  }, 60_000);

  it("défaut manuel inchangé : sans origine dans les options, aucune origine n'est transmise", async () => {
    await lancer();
    await bg.tourBoucleGeneration();
    expect(executer).toHaveBeenCalled();
    for (const appel of executer.mock.calls) expect(appel[3]?.origine).toBeUndefined();
  }, 60_000);
});
