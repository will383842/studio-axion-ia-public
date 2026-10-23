/**
 * E2E-1 générateur n° 5 (MAJEUR, 03/10) — « Fabriquer les N » : les formats cochés (Carré, 4:5) s'appliquent aux N
 * vidéos, pas seulement à la vidéo mère, et le prix affiché les compte. Constaté : Carré coché, seul Facebook (la mère)
 * avait un fichier carré ; le prix restait 5,53 €. Tout en simulation (aucun appel payant).
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
const boucle = await import("@/services/boucle");
const fr = await import("@/services/fabrication-reseaux");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "e2e1-restes-formats";

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
  vi.useRealTimers();
});

const BRIEF = { idee: SUJETS_BANC[0].idee, reseaux: [...RESEAUX_DECLINAISON], formatId: "avocat", pilier: SUJETS_BANC[0].pilier.id, mode: "avatar" as const };

async function sujetValide() {
  const r = await bg.lancerGeneration(BRIEF);
  if (!r.ok) throw new Error("lancement");
  await bg.tourBoucleGeneration();
  const m = await depots().scriptsMaitres.obtenir(r.scriptMaitreId);
  if (m?.exception?.source === "proposition-machine") await bg.validerException(r.scriptMaitreId, "c-est-juste");
  const vs = await depots().variantes.lister((v) => v.scriptMaitreId === r.scriptMaitreId);
  await bg.validerVariantes(vs.map((v) => v.id));
  return r.scriptMaitreId;
}

async function tourner(jusqua: () => Promise<boolean>, tours = 200) {
  for (let i = 0; i < tours; i++) {
    if (await jusqua()) return;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  throw new Error("la fabrication n'avance pas");
}

async function ratiosDesSorties(videoId: string): Promise<string[]> {
  const v = (await depots().videos.obtenir(videoId))!;
  const versions = (await depots().versions.lister((x) => x.videoId === videoId && x.statut !== "maquette")).sort((a, b) => a.numero - b.numero);
  const courante = versions.find((x) => x.id === v.versionChoisieId) ?? versions.at(-1);
  if (!courante) return [];
  return [...new Set((await depots().sorties.lister((s) => s.versionId === courante.id)).map((s) => s.ratio))].sort();
}

describe.each([
  ["moteur simulé du format (chaque vidéo en entier)", null],
  ["moteur avocat (les versions reprennent la mère)", "montage-avocat"],
])("E2E-1 n° 5 · formats cochés pour les N vidéos · %s", (_nom, moteur) => {
  it("le prix compte le Carré sur chaque version", async () => {
    if (moteur) await ecrireParametre("moteur.avocat", moteur);
    const id = await sujetValide();
    const sans = (await fr.planFabricationSujet(id))!;
    const avec = (await fr.planFabricationSujet(id, { ratiosOption: ["1:1"] }))!;
    expect(avec.total.centimes).toBeGreaterThan(sans.total.centimes);
    // Chaque version (et pas seulement la mère) coûte plus cher avec le Carré.
    for (const v of avec.versions) {
      const s = sans.versions.find((x) => x.varianteId === v.varianteId)!;
      expect(v.cout.centimes, v.code).toBeGreaterThan(s.cout.centimes);
    }
  });

  it("chaque vidéo est créée ET fabriquée en Vertical + Carré (l'avocat reste hors T5 : aucun 4:5 d'office)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    if (moteur) await ecrireParametre("moteur.avocat", moteur);
    const id = await sujetValide();
    const r = await fr.fabriquerLesN(id, { operationId: "op-carre", lancer: true, ratiosOption: ["1:1"] });
    expect(r.videoIds.length).toBeGreaterThan(1);
    // Formats par réseau T5 : l'avocat n'en reçoit aucun (décision de Will : une session dédiée le traitera) : pas de 4:5, même pour LinkedIn.
    for (const vid of r.videoIds) expect((await depots().videos.obtenir(vid))!.ratios).toEqual(["9:16", "1:1"]);
    await tourner(async () => (await Promise.all(r.videoIds.map((v) => depots().videos.obtenir(v)))).every((v) => v?.statut === "prete"));
    for (const vid of r.videoIds) expect(await ratiosDesSorties(vid), vid).toEqual(["1:1", "9:16"]);
  });
});
