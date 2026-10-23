/**
 * Corbeille · le brouillon d'une version mis à la corbeille par Will n'est JAMAIS repris (relecture #479, 3e passage) :
 * sinon il repasserait « brouillon » en gardant sa date de corbeille, invisible de Toutes comme de la Corbeille, mais
 * fabriqué et payé. Un nouveau brouillon est créé. Simulation, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const corbeille = await import("@/services/corbeille");
const bg = await import("@/services/boucle-generation");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "essai-corbeille-brouillon";

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  bg.suspendreBoucleGeneration(true);
  await auth.seConnecter(MDP, false);
});
afterEach(() => bg.arreterBoucleGeneration());

/** Une version par réseau validée (générateur en simulation). */
async function versionValidee() {
  for (const m of SUJETS_BANC.flatMap((s) => s.matieres)) await depots().matieres.enregistrer(m);
  for (const p of SUJETS_BANC.flatMap((s) => s.preuves)) await depots().preuves.enregistrer(p);
  const r = await bg.lancerGeneration({ idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const });
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const v = (await depots().variantes.lister((x) => x.scriptMaitreId === r.scriptMaitreId))[0];
  await depots().variantes.modifier(v.id, { etat: "validee" });
  return { scriptMaitreId: r.scriptMaitreId, variante: (await depots().variantes.obtenir(v.id))! };
}

describe("brouillon d'une version et corbeille", () => {
  it("un brouillon de version archivé puis mis à la corbeille n'est pas repris : un autre brouillon est créé", async () => {
    const d = depots();
    const { variante } = await versionValidee();
    const { videoId: ancien } = await bg.fabriquerVariante(variante.id, { operationId: "op-1", lancer: false });
    // État laissé par un lancement refusé : brouillon rangé aux archives, version détachée, brouillon à reprendre noté.
    await d.videos.modifier(ancien, { statut: "archivee", statutAvantArchive: "brouillon" });
    await d.variantes.modifier(variante.id, { videoId: undefined });
    await d.parametres.enregistrer({ id: `generateur.brouillon-de-version.${variante.id}`, valeur: ancien, creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" });
    await corbeille.mettreALaCorbeille([ancien]);
    const { videoId: nouveau } = await bg.fabriquerVariante(variante.id, { operationId: "op-2", lancer: false });
    expect(nouveau).not.toBe(ancien);
    const reste = (await d.videos.obtenir(ancien))!;
    expect(reste.statut).toBe("archivee");
    expect(reste.corbeilleLe).toBeTruthy();
    expect((await corbeille.listerCorbeille()).map((c) => c.id)).toContain(ancien);
    expect((await d.videos.obtenir(nouveau))!.corbeilleLe).toBeUndefined();
  });

  it("non-régression : un brouillon seulement archivé (sans corbeille) est toujours repris", async () => {
    const d = depots();
    const { variante } = await versionValidee();
    const { videoId: ancien } = await bg.fabriquerVariante(variante.id, { operationId: "op-1", lancer: false });
    await d.videos.modifier(ancien, { statut: "archivee", statutAvantArchive: "brouillon" });
    await d.variantes.modifier(variante.id, { videoId: undefined });
    await d.parametres.enregistrer({ id: `generateur.brouillon-de-version.${variante.id}`, valeur: ancien, creeLe: "2026-10-01T00:00:00.000Z", modifieLe: "2026-10-01T00:00:00.000Z" });
    const { videoId } = await bg.fabriquerVariante(variante.id, { operationId: "op-2", lancer: false });
    expect(videoId).toBe(ancien);
    expect((await d.videos.obtenir(ancien))!.statut).toBe("brouillon");
  });
});
