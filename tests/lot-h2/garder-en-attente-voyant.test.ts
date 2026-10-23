/**
 * LOT H2 · point 3 : `garderEnAttente` revérifie côté serveur que le second oui est vraiment exigé (le navigateur ne fait pas foi).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const ecran = await import("@/services/generateur-ecran");
const bg = await import("@/services/boucle-generation");
const { GARDE_FOUS } = await import("@/domaine/controles-script/niveaux");
const actions = await import("@/app/(studio)/nouvelle/[format]/actions");
const { empreinte } = await import("@/domaine/relecture-script");
const { versionsCourantes } = await import("@/domaine/derivations-generateur");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "essai-lot-h2";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
const GARDES = GARDE_FOUS as string[];
const GARDE_FOUS_REELS = [...GARDE_FOUS];
beforeEach(async () => {
  GARDES.splice(0, GARDES.length, "C1");
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  GARDES.splice(0, GARDES.length, ...GARDE_FOUS_REELS);
  bg.arreterBoucleGeneration();
  vi.restoreAllMocks();
});

async function sujetPret() {
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const vs = versionsCourantes(await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId));
  for (const v of vs) await depots().variantes.modifier(v.id, { etat: "validee", note: { ...v.note, globale: 95 }, controles: { ...v.controles, violations: [] } });
  return { sujetId: r.scriptMaitreId, versions: vs };
}
const rougir = (id: string) => depots().variantes.modifier(id, { note: { globale: 50, criteres: {} } } as never);
const gardeDe = async () => ((await depots().videos.obtenir("v-03"))!.lancementEnAttente as { malgreVoyant?: boolean } | undefined);

async function mettreEnAttente(version: string | undefined, malgreVoyant: boolean) {
  const credits = await import("@/services/credits");
  const v = (await depots().videos.obtenir("v-03"))!;
  await depots().videos.modifier("v-03", { statut: "brouillon", entrees: { ...v.entrees, ...(version ? { varianteOrigineId: version } : {}) } });
  await credits.garderEnAttente("v-03", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, malgreVoyant });
}

describe("garderEnAttente : le « malgreVoyant » du navigateur est revérifié côté serveur", { timeout: 30_000 }, () => {
  it("version rouge, oui légitime : gardé", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    await mettreEnAttente(versions[0].id, true);
    expect((await gardeDe())?.malgreVoyant).toBe(true);
  });
  it("version verte : un oui affirmé par le navigateur n'est PAS gardé", async () => {
    const { versions } = await sujetPret();
    await mettreEnAttente(versions[0].id, true);
    expect(await gardeDe()).toBeDefined();
    expect((await gardeDe())?.malgreVoyant).toBeUndefined();
  });
  it("texte sans version d'origine (collé) : le oui affirmé n'est PAS gardé", async () => {
    await sujetPret();
    await mettreEnAttente(undefined, true);
    expect((await gardeDe())?.malgreVoyant).toBeUndefined();
  });
  it("script de Will (origine « will ») : le oui affirmé n'est PAS gardé", async () => {
    const { versions } = await sujetPret();
    await depots().variantes.modifier(versions[1].id, { note: { globale: 50, criteres: {} }, origine: "will" } as never);
    await mettreEnAttente(versions[1].id, true);
    expect((await gardeDe())?.malgreVoyant).toBeUndefined();
  });
  it("sans oui affirmé : rien n'est gardé, même sur une version rouge (comportement inchangé)", async () => {
    const { versions } = await sujetPret();
    await rougir(versions[0].id);
    await mettreEnAttente(versions[0].id, false);
    expect((await gardeDe())?.malgreVoyant).toBeUndefined();
  });
});
