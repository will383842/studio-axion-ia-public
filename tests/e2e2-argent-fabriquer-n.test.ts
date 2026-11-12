/**
 * E2E-2 (03/10) — correcteur « argent et fabrication » : « Fabriquer les N » sans impasse et au juste prix.
 *  - parcours n° 1 : le budget du mois ne bloque plus (décision du 08/11) : ni avant de créer, ni au lancement même ;
 *  - parcours n° 2 : la fonction sûre pour « Fabriquer cette version » (`verifierAvantDeCreer`, `lancerVideoDeVersion`) ;
 *  - parcours n° 4 : le prix annoncé est celui que le lancement contrôle (même chemin de commande) ;
 *  - parcours n° 9 : la ligne « vous » faite, « Fabriquer les N » propose la ligne suivante.
 * Tout simulé, aucune clé.
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
const fr = await import("@/services/fabrication-reseaux");
const credits = await import("@/services/credits");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");
const { RESEAUX_DECLINAISON } = await import("@/reseaux/codes");

const MDP = "e2e2-argent-fabriquer-n";

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
  vi.useRealTimers();
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

const budget = (c: number) => ecrireParametre("budget.mensuel", { centimes: c, devise: "EUR" });

describe("parcours n° 1 · « Fabriquer les N » : le budget du mois ne bloque plus (décision du 08/11)", () => {
  it("budget du mois insuffisant : aucun BUDGET_DEPASSE, les vidéos sont créées et la fabrication part", async () => {
    const id = await sujetValide();
    const videosAvant = await depots().videos.compter();
    await budget(1);
    const r = await fr.fabriquerLesN(id, { operationId: "op-refus", lancer: true });
    expect(r.travailId).toBeTruthy();
    expect(r.enAttente).toBeUndefined();
    expect(await depots().videos.compter()).toBeGreaterThan(videosAvant);
    expect((await depots().variantes.lister((v) => v.scriptMaitreId === id)).filter((v) => v.videoId).length).toBeGreaterThan(0);
    expect(await depots().travaux.compter((t) => t.cibleId === r.mereVideoId)).toBe(1);
    // Le même geste renvoyé (même clé) ne lance rien de plus.
    expect(await fr.fabriquerLesN(id, { operationId: "op-refus", lancer: true })).toMatchObject({ mereVideoId: r.mereVideoId, travailId: r.travailId });
  }, 60_000);

  it("budget baissé entre la préparation et le lancement : la mère part quand même, sans attente du budget", async () => {
    const id = await sujetValide();
    // Vidéos préparées (geste interrompu), puis le budget baisse avant le lancement.
    const totalConfirme = (await fr.planFabricationSujet(id))!.total.centimes;
    const prepare = await fr.fabriquerLesN(id, { operationId: "op-course", lancer: false });
    await budget(1);
    const r = await fr.fabriquerLesN(id, { operationId: "op-course", lancer: true, totalConfirme });
    expect(r.travailId).toBeTruthy();
    expect(r.enAttente).toBeUndefined();
    const mere = (await depots().videos.obtenir(prepare.mereVideoId))!;
    expect(mere.lancementEnAttente).toBeFalsy();
    const etat = await fr.etatFabricationSujet(id);
    expect(etat.find((e) => e.videoId === prepare.mereVideoId)?.attendCredit).toBeFalsy();
    expect(await depots().notifications.trouver((n) => /attend le budget/.test(n.titre))).toBeFalsy();
    expect(await depots().travaux.compter((t) => t.cibleId === prepare.mereVideoId)).toBe(1);
  }, 60_000);
});

describe("parcours n° 2 · fonctions sûres pour « Fabriquer cette version »", () => {
  it("verifierAvantDeCreer ne refuse plus pour le budget ; lancerVideoDeVersion lance sans mise en attente du budget", async () => {
    const id = await sujetValide();
    const v = (await depots().variantes.lister((x) => x.scriptMaitreId === id && x.etat === "validee"))[0];
    const videosAvant = await depots().videos.compter();
    await budget(1);
    const { total } = await fr.verifierAvantDeCreer([v.id]);
    expect(total.centimes).toBeGreaterThan(0);
    // La vérification seule ne crée rien.
    expect(await depots().videos.compter()).toBe(videosAvant);
    // Brouillon déjà créé, budget toujours à 1 centime : la vidéo part, elle n'attend pas le budget.
    const prepare = await fr.fabriquerLesN(id, { operationId: "op-v", lancer: false });
    const r = await fr.lancerVideoDeVersion(prepare.mereVideoId);
    expect(r.travailId).toBeTruthy();
    expect(r.enAttente).toBeUndefined();
    expect((await depots().videos.obtenir(prepare.mereVideoId))!.lancementEnAttente?.fournisseur).not.toBe("budget");
  }, 60_000);
});

describe("parcours n° 4 · le prix annoncé est le prix contrôlé au lancement", () => {
  it("moteur avocat : chaque version coûte au lancement exactement ce que « Fabriquer les N » annonçait", async () => {
    await ecrireParametre("moteur.avocat", "montage-avocat");
    const id = await sujetValide();
    const plan = (await fr.planFabricationSujet(id, { ratiosOption: ["1:1"] }))!;
    const res = await fr.fabriquerLesN(id, { operationId: "op-prix", lancer: true, ratiosOption: ["1:1"] });
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let i = 0; i < 400; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle();
      const vids = await Promise.all(res.videoIds.map((x) => depots().videos.obtenir(x)));
      if (vids.every((x) => x?.statut === "prete")) break;
    }
    vi.useRealTimers();
    for (const version of plan.versions) {
      const video = (await depots().videos.lister((x) => x.varianteId === version.varianteId))[0];
      expect(video?.statut).toBe("prete");
      expect(video?.coutEstime?.centimes).toBe(version.cout.centimes);
    }
  }, 120_000);
});

describe("parcours n° 9 · la ligne « vous » faite, « Fabriquer les N » propose la ligne « tu »", () => {
  it("plan proposé pour la ligne suivante (codes en -T)", async () => {
    const id = await sujetValide();
    const vous = await depots().variantes.lister((v) => v.scriptMaitreId === id && v.etat === "validee");
    for (const v of vous) {
      await depots().variantes.modifier(v.id, { videoId: "v-03" });
      await depots().variantes.enregistrer({ ...v, id: `${v.id}-t`, code: `${v.code}-T`, videoId: undefined });
    }
    const plan = await fr.planFabricationSujet(id);
    expect(plan).not.toBeNull();
    expect(plan!.versions.every((x) => x.code.endsWith("-T"))).toBe(true);
  }, 60_000);
});
