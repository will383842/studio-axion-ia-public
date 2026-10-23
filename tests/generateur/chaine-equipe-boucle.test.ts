/**
 * CHAÎNE « ÉQUIPE » · aiguillage de la boucle d'écriture, en simulation : aucune clé réelle, `fetch` interdit, 0 $.
 * Livrée ÉTEINTE : réglage absent → courte (lot A5) ; « courte » → courte (inchangé) ; « equipe » seulement → la chaîne « équipe » ;
 * « je choisis » → toujours la grande. La réserve d'un sujet « équipe » passe sous le plafond du sujet.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { executeurSimule } from "../helpers/g4";
import { SUJETS_BANC } from "./banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 30_000 });

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const bg = await import("@/services/boucle-generation");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { pireCasChaine } = await import("@/generateur/pire-cas");
const { etapeZeroBanc } = await import("../helpers/g4");

const MDP = "essai-chaine-equipe";

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

afterEach(() => {
  bg.arreterBoucleGeneration();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

const S = SUJETS_BANC[0];
const brief = () => ({ idee: S.idee, reseaux: [...S.reseaux], formatId: "avocat", pilier: S.pilier.id, mode: "avatar" as const });
const lancer = async () => {
  const r = await bg.lancerGeneration(brief());
  if (!r.ok) throw new Error(`lancement : ${r.ceQuIlFaudrait}`);
  return r;
};
const chaineFigee = async (id: string) => (await lireParametre<{ chaine?: string } | null>(`generateur.chaine-options.${id}`, null))?.chaine;

describe("chaîne « équipe » : éteinte par défaut", () => {
  it("réglage absent → courte (lot A5) ; « complete » → grande ; « courte » → courte", async () => {
    expect(await gc.chaineDeLEcriture()).toBe("courte");
    await ecrireParametre(bg.PARAM_CHAINE, "complete");
    expect(await gc.chaineDeLEcriture()).toBe("grande");
    await ecrireParametre(bg.PARAM_CHAINE, "courte");
    expect(await gc.chaineDeLEcriture()).toBe("courte");
    const r = await lancer();
    expect(await chaineFigee(r.generationId)).toBe("courte");
    const { executeur, appels } = executeurSimule();
    await bg.tourBoucleGeneration(() => executeur);
    expect(appels.some((a) => a.role.startsWith("equipe-"))).toBe(false);
  });

  it("une valeur inconnue → grande ; « je choisis » → grande même avec « equipe »", async () => {
    await ecrireParametre(bg.PARAM_CHAINE, "equipe-v2");
    expect(await gc.chaineDeLEcriture()).toBe("grande");
    await ecrireParametre(bg.PARAM_CHAINE, "equipe");
    expect(await gc.chaineDeLEcriture("je-choisis")).toBe("grande");
    expect(gc.reglagePlafond("equipe")).toBe(gc.PARAM_PLAFOND_SUJET);
  });

  it("« equipe » : les 4 rôles de l'équipe, une déclinaison par réseau en plus, l'écriture rangée", async () => {
    await ecrireParametre(bg.PARAM_CHAINE, "equipe");
    const r = await lancer();
    expect(await chaineFigee(r.generationId)).toBe("equipe");
    const { executeur, appels } = executeurSimule();
    expect(await bg.tourBoucleGeneration(() => executeur)).toBe(r.generationId);
    expect(appels.map((a) => a.role)).toEqual(["equipe-chef", "equipe-scenariste", "equipe-accroches", "equipe-relecteur", ...Array(S.reseaux.length - 1).fill("declinaison")]);
    expect((await depots().generations.obtenir(r.generationId))?.statut).toBe("terminee");
    const variantes = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
    expect(variantes.map((v) => v.reseau).sort()).toEqual([...S.reseaux].sort());
    const e = await bg.etatEcriture(r.scriptMaitreId);
    expect(e?.etapes).toEqual([1, 2, 3, 4, 5]);
  });

  it("pire cas « équipe » de ce sujet (3 réseaux) sous le plafond d'un sujet par défaut", () => {
    const z = etapeZeroBanc(S);
    if (!z.ok) throw new Error("étape 0");
    expect(pireCasChaine("equipe", { donnees: z.donnees, options: { reseaux: z.donnees.sujet.reseaux } }).usd).toBeLessThanOrEqual(gc.PLAFOND_PAR_DEFAUT_USD);
  });
});
