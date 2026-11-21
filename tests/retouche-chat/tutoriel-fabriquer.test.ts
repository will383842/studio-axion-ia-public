/**
 * T-EXT-46b — « Fabriquer cette version » du tutoriel depuis le chat de retouche (SENSIBLE ARGENT).
 * Tout est doublé : `lancerRetouche` est un double qui compte ses appels (aucun moteur, aucune réservation, aucun
 * rendu, aucun appel à Claude ni à la voix), dépôts en mémoire, réseau interdit. 0 €.
 */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { PHRASE_RENDU_NON_BRANCHE } from "@/services/retouche-chat/service";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

type Lancement = { videoId: string; planIds: string[]; consigne: string; options: { operations?: { type: string; plan?: unknown }[] } };
const etat = vi.hoisted(() => ({ lancements: [] as Lancement[], enCours: new Map<string, string>() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
/**
 * `lancerRetouche` remplacé (le vrai n'est jamais appelé) : comme le vrai, une même consigne déjà en cours sur la même
 * vidéo rend le même travail ; sinon une nouvelle version (parent = version choisie, pas encore choisie) et son travail.
 */
vi.mock("@/services/fabrication", async (original) => {
  const vrai = await original<typeof import("@/services/fabrication")>();
  return {
    ...vrai,
    lancerRetouche: async (videoId: string, planIds: string[], consigne: string, options: Lancement["options"] = {}) => {
      const { depots } = await import("@/donnees/memoire");
      const deja = etat.enCours.get(`${videoId}|${consigne}`);
      if (deja) return { retoucheId: `ret-${deja}`, travailId: deja };
      etat.lancements.push({ videoId, planIds, consigne, options });
      const n = etat.lancements.length;
      const video = (await depots().videos.obtenir(videoId))!;
      const parent = (await depots().versions.obtenir(video.versionChoisieId!))!;
      const travailId = `trav-46b-${n}`;
      await depots().versions.enregistrer({ ...parent, id: `${videoId}-v${parent.numero + 1}`, numero: parent.numero + 1, parentVersionId: parent.id, choisie: false, statut: "en_fabrication", travailId, noteRetouche: consigne });
      etat.enCours.set(`${videoId}|${consigne}`, travailId);
      return { retoucheId: `ret-${travailId}`, travailId };
    },
  };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { choisirVersion } = await import("@/services/videos");
const { appliquerOperations } = await import("@/services/retouche-chat/appliquer");
const { CLES_REGLAGE_RETOUCHE } = await import("@/services/retouche-chat/generateurs");
const { FABRIQUER_PAR_GENERATEUR, fabriquerVersionTutoriel } = await import("@/services/retouche-chat/tutoriel-fabriquer");
const { POST } = await import("@/app/api/retouche-chat/route");
const { ZoneFabriquer, versionAFabriquer, remarquesAffichees, texteSansNouvelleVersion, PHRASE_RENDU_NON_BRANCHE_COPIE } = await import("@/components/retouche-chat/ChatRetouche");

type Deps = NonNullable<Parameters<typeof fabriquerVersionTutoriel>[3]>;
type VersionLue = NonNullable<Awaited<ReturnType<Deps["lireVersionChoisie"]>>>;

const ID = "tutoriel-outil";
const CLE = CLES_REGLAGE_RETOUCHE[ID];
const DEMANDE = "Zoome plus sur le tableau des stocks";
const plan: PlanValide = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false, dureeMs: PLAN_DEMO.dureeMs }).plan;
const retouche: PlanValide = appliquerOperations(plan, [{ type: "ajuster-zoom", sceneId: plan.scenes[1]!.id, facteur: 1.4 }]).plan;

/** Doubles injectés : `lancer` compte les appels ; rien d'autre n'existe derrière. */
function doubles(surcharge: Partial<VersionLue> | null = {}, actif: unknown = true) {
  const lancer = vi.fn(async () => ({ retoucheId: "ret-1", travailId: "trav-1" }));
  const lue: VersionLue | null = surcharge === null ? null : { versionId: "ver-1", formatId: ID, etapeEditoriale: "a_relire", plan, voixGardee: true, ...surcharge };
  const dep: Deps = { lancerRetouche: lancer, lireVersionChoisie: async () => lue, retoucheChatActif: async () => actif as boolean };
  return { lancer, dep };
}

describe("46b · fabriquerVersionTutoriel : chaque refus tombe AVANT toute réservation", () => {
  it("le plan retouché diffère bien de la version choisie (garde du test)", () => {
    expect(JSON.stringify(retouche.scenes)).not.toBe(JSON.stringify(plan.scenes));
  });

  it.each([
    ["absent (faux)", false],
    ['texte "true"', "true"],
    ["nombre 1", 1],
    ["nul", null],
    ["objet", { actif: true }],
  ])("réglage %s : refus « reglage », rien lancé", async (_nom, valeur) => {
    const { lancer, dep } = doubles({}, valeur);
    const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, dep);
    expect(r).toMatchObject({ statut: "refusee", motif: "reglage" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("lecture du réglage en échec : refus « reglage », rien lancé", async () => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, { ...dep, retoucheChatActif: async () => { throw new Error("panne"); } });
    expect(r).toMatchObject({ statut: "refusee", motif: "reglage" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("réglage éteint : la version n'est même pas lue", async () => {
    const { dep } = doubles({}, false);
    const lire = vi.fn(dep.lireVersionChoisie);
    await fabriquerVersionTutoriel("v", retouche, DEMANDE, { ...dep, lireVersionChoisie: lire });
    expect(lire).not.toHaveBeenCalled();
  });

  it.each([
    ["vidéo ou version introuvable", null, "introuvable"],
    ["générateur autre que le tutoriel (avocat)", { formatId: "avocat" }, "generateur"],
    ["générateur absent", { formatId: undefined }, "generateur"],
    ["vidéo programmée", { etapeEditoriale: "programmee" }, "diffusion"],
    ["vidéo publiée", { etapeEditoriale: "publiee" }, "diffusion"],
    ["version choisie sans plan", { plan: null }, "sans-plan"],
    ["version choisie au plan illisible", { plan: { scenes: "x" } }, "sans-plan"],
    ["voix de la version d'avant absente (elle serait refaite)", { voixGardee: false }, "voix"],
  ] as [string, Partial<VersionLue> | null, string][])("%s : refus « %s », rien lancé", async (_nom, surcharge, motif) => {
    const { lancer, dep } = doubles(surcharge);
    const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, dep);
    expect(r).toMatchObject({ statut: "refusee", motif });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("lecture de la version en échec : refus, rien lancé", async () => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, { ...dep, lireVersionChoisie: async () => { throw new Error("panne"); } });
    expect(r).toMatchObject({ statut: "refusee", motif: "introuvable" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it.each([
    ["absent", undefined],
    ["nul", null],
    ["texte", "plan"],
    ["liste", [1, 2]],
    ["sans scènes", { mots: plan.mots, format: plan.format }],
    ["scènes vides", { ...retouche, scenes: [] }],
  ])("plan reçu illisible (%s) : refus « plan-illisible », rien lancé", async (_nom, recu) => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", recu, DEMANDE, dep);
    expect(r).toMatchObject({ statut: "refusee", motif: "plan-illisible" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("mots différents de la version choisie : refus dit (le moteur garderait en silence le plan d'avant)", async () => {
    const { lancer, dep } = doubles();
    const mots = retouche.mots.map((m, i) => (i === 0 ? { ...m, texte: `${m.texte}x` } : m));
    const r = await fabriquerVersionTutoriel("v", { ...retouche, mots }, DEMANDE, dep);
    expect(r).toMatchObject({ statut: "refusee", motif: "mots" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("format différent de la version choisie : refus dit", async () => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", { ...retouche, format: { ...retouche.format, largeur: retouche.format.largeur + 2 } }, DEMANDE, dep);
    expect(r).toMatchObject({ statut: "refusee", motif: "format" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("plan identique à la version choisie : refus (jamais un rendu identique facturé)", async () => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", structuredClone(plan), DEMANDE, dep);
    expect(r).toMatchObject({ statut: "refusee", motif: "identique" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it.each([["vide", ""], ["espaces", "   \n "]])("demande %s : refus « demande », rien lancé", async (_nom, demande) => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", retouche, demande, dep);
    expect(r).toMatchObject({ statut: "refusee", motif: "demande" });
    expect(lancer).not.toHaveBeenCalled();
  });

  it("réglages du film illisibles (étape inconnue, champ en trop, texte) : refus « reglages » AVANT le lancement", async () => {
    for (const mauvais of [{ parEtape: { inconnue: { zoom: "plus" } } }, { parEtape: {}, extra: 1 }, "zoom", 3, [], { parEtape: { e1: { zoom: "enorme" } } }]) {
      const { lancer, dep } = doubles({ etapeIds: ["e1"] });
      const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, dep, mauvais);
      expect(r).toMatchObject({ statut: "refusee", motif: "reglages" });
      expect(lancer).not.toHaveBeenCalled();
    }
  });

  it("rien de changé (plan identique, réglages absents, nuls ou identiques à ceux d'avant) : refus « identique », rien lancé", async () => {
    const avant = { parEtape: { e1: { zoom: "plus" } } };
    for (const [reglages, deja] of [[undefined, undefined], [null, undefined], [{ parEtape: {} }, undefined], [avant, avant]] as [unknown, unknown][]) {
      const { lancer, dep } = doubles({ etapeIds: ["e1"], reglagesAvant: deja });
      const r = await fabriquerVersionTutoriel("v", structuredClone(plan), DEMANDE, dep, reglages);
      expect(r).toMatchObject({ statut: "refusee", motif: "identique" });
      expect(lancer).not.toHaveBeenCalled();
    }
  });

  it("aucune phrase de refus ne porte un montant", async () => {
    const cas: [unknown, Partial<VersionLue> | null, unknown][] = [
      [retouche, {}, false],
      [retouche, null, true],
      [retouche, { formatId: "avocat" }, true],
      [retouche, { etapeEditoriale: "publiee" }, true],
      [retouche, { plan: null }, true],
      [retouche, { voixGardee: false }, true],
      [null, {}, true],
      [{ ...retouche, format: { ...retouche.format, largeur: 2 } }, {}, true],
      [structuredClone(plan), {}, true],
    ];
    for (const [recu, surcharge, actif] of cas) {
      const r = await fabriquerVersionTutoriel("v", recu, DEMANDE, doubles(surcharge, actif).dep);
      expect(r.statut).toBe("refusee");
      if (r.statut === "refusee") expect(r.raison).not.toMatch(/[€$]|\beuros?\b|\bcentimes?\b|\bcrédits?\b|\d/i);
    }
  });
});

describe("46b · fabriquerVersionTutoriel : cas valide", () => {
  it("lance UNE fois, sans passage, avec la seule opération `planScenes` du plan reçu", async () => {
    const { lancer, dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", retouche, `  ${DEMANDE}  `, dep);
    expect(r).toEqual({ statut: "lancee", travailId: "trav-1" });
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(lancer).toHaveBeenCalledWith("v", [], DEMANDE, { operations: [{ type: "planScenes", plan: retouche }] });
  });

  it("plan ET film changés : les deux opérations, UN seul lancement", async () => {
    const reglages = { parEtape: { e1: { zoom: "plus" } } };
    const { lancer, dep } = doubles({ etapeIds: ["e1"] });
    const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, dep, reglages);
    expect(r).toEqual({ statut: "lancee", travailId: "trav-1" });
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(lancer).toHaveBeenCalledWith("v", [], DEMANDE, { operations: [{ type: "planScenes", plan: retouche }, { type: "reglagesFilm", reglages: reglages }] });
  });

  it("film seul changé (plan identique) : lancé avec la seule opération `reglagesFilm`", async () => {
    const reglages = { parEtape: { e1: { zoom: "plus" } } };
    const { lancer, dep } = doubles({ etapeIds: ["e1"], reglagesAvant: { parEtape: { e1: { zoom: "normal" } } } });
    const r = await fabriquerVersionTutoriel("v", structuredClone(plan), DEMANDE, dep, reglages);
    expect(r.statut).toBe("lancee");
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(lancer).toHaveBeenCalledWith("v", [], DEMANDE, { operations: [{ type: "reglagesFilm", reglages }] });
  });

  it("plan changé sans réglages : toujours la seule opération `planScenes` (comme avant)", async () => {
    const { lancer, dep } = doubles({ etapeIds: ["e1"] });
    await fabriquerVersionTutoriel("v", retouche, DEMANDE, dep, null);
    expect(lancer).toHaveBeenCalledWith("v", [], DEMANDE, { operations: [{ type: "planScenes", plan: retouche }] });
  });

  it("jamais d'accord de prix ni d'entrées glissés dans les options", async () => {
    const { lancer, dep } = doubles();
    await fabriquerVersionTutoriel("v", retouche, DEMANDE, dep);
    expect(Object.keys((lancer.mock.calls[0] as unknown[])[3] as object)).toEqual(["operations"]);
  });

  it("plan sans `mots` ni `format` (le moteur prend ceux de la version d'avant) : accepté", async () => {
    const { lancer, dep } = doubles();
    const { mots: _m, format: _f, ...sans } = retouche;
    void _m;
    void _f;
    expect((await fabriquerVersionTutoriel("v", sans, DEMANDE, dep)).statut).toBe("lancee");
    expect(lancer).toHaveBeenCalledTimes(1);
  });

  it("le lancement échoue (crédit, moteur) : refus « echec », phrase sans montant ni message d'origine", async () => {
    const { dep } = doubles();
    const r = await fabriquerVersionTutoriel("v", retouche, DEMANDE, { ...dep, lancerRetouche: async () => { throw new Error("Cette retouche coûte 0,40 € : crédit insuffisant."); } });
    expect(r).toMatchObject({ statut: "refusee", motif: "echec" });
    if (r.statut === "refusee") expect(r.raison).not.toMatch(/[€$]|\d|crédit/i);
  });
});

describe("46b · table fermée des fabricants", () => {
  it("ne contient que le tutoriel, et ne se modifie pas", () => {
    expect(Object.keys(FABRIQUER_PAR_GENERATEUR)).toEqual([ID]);
    expect(Object.isFrozen(FABRIQUER_PAR_GENERATEUR)).toBe(true);
  });
});

const MDP = "essai-t-ext-46b-fabriquer";
const t0 = "2026-11-20T10:00:00.000Z";
const requete = (corps: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(corps) }) as never;
const corps = (videoId: string, plus: Record<string, unknown> = {}) => ({ action: "fabriquer", generateur: ID, videoId, demande: DEMANDE, plan: retouche, ...plus });

async function poser(videoId: string, etapeEditoriale: string, formatId = ID) {
  await depots().videos.enregistrer({ id: videoId, titre: videoId, etapeEditoriale, versionChoisieId: `${videoId}-v1`, creeLe: t0, modifieLe: t0 } as never);
  await depots().versions.enregistrer({ id: `${videoId}-v1`, videoId, numero: 1, choisie: true, statut: "prete", commande: { formatId, entrees: {} }, projetMontage: { tutoriel: { plan: { plan }, audio: { empreinte: "voix-1" } } }, creeLe: t0, modifieLe: t0 } as never);
}

describe("46b · route `fabriquer` (dépôts en mémoire, `lancerRetouche` doublé)", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = "a".repeat(48);
    const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
  });

  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    etat.lancements = [];
    etat.enCours.clear();
    await auth.seConnecter(MDP, false);
    await ecrireParametre(CLE, true);
    await poser("tuto", "a_relire");
    await poser("tuto-publiee", "publiee");
    await poser("tuto-programmee", "programmee");
    await poser("plaidoirie", "a_relire", "avocat");
  });

  it("sans session : 401, rien lancé", async () => {
    reinitialiserRequete();
    expect((await POST(requete(corps("tuto")))).status).toBe(401);
    expect(etat.lancements).toEqual([]);
  });

  it("sans `generateur` : 400, rien lancé", async () => {
    const { generateur: _g, ...sans } = corps("tuto");
    void _g;
    expect((await POST(requete(sans))).status).toBe(400);
    expect(etat.lancements).toEqual([]);
  });

  it("générateur inconnu : 400, rien lancé", async () => {
    const r = await POST(requete(corps("tuto", { generateur: "inconnu" })));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erreur: "Générateur inconnu." });
    expect(etat.lancements).toEqual([]);
  });

  it.each([["absent", undefined], ["faux", false], ['texte "true"', "true"], ["nombre 1", 1]])("réglage %s : 403, rien lancé", async (_nom, valeur) => {
    reinitialiserDepots();
    await poser("tuto", "a_relire");
    if (valeur !== undefined) await ecrireParametre(CLE, valeur);
    expect((await POST(requete(corps("tuto")))).status).toBe(403);
    expect(etat.lancements).toEqual([]);
  });

  it.each(["tuto-publiee", "tuto-programmee"])("%s : 409 (garde N-22 de la route), rien lancé", async (videoId) => {
    const r = await POST(requete(corps(videoId)));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erreur: "Cette vidéo est programmée ou publiée : elle ne se retouche pas ici." });
    expect(etat.lancements).toEqual([]);
  });

  it("générateur inscrit mais sans fabricant (avocat, réglage allumé) : 409, rien lancé", async () => {
    await ecrireParametre(CLES_REGLAGE_RETOUCHE.avocat, true);
    const r = await POST(requete(corps("plaidoirie", { generateur: "avocat" })));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ erreur: "La fabrication depuis le chat n'est pas encore branchée pour ce générateur." });
    expect(etat.lancements).toEqual([]);
  });

  it("générateur « tutoriel » annoncé sur une vidéo d'un autre générateur : 409, rien lancé", async () => {
    expect((await POST(requete(corps("plaidoirie")))).status).toBe(409);
    expect(etat.lancements).toEqual([]);
  });

  it("plan absent ou illisible : 400 ; plan aux mots différents : 409 ; rien lancé", async () => {
    const { plan: _p, ...sans } = corps("tuto");
    void _p;
    expect((await POST(requete(sans))).status).toBe(400);
    expect((await POST(requete(corps("tuto", { plan: "x" })))).status).toBe(400);
    const mots = retouche.mots.map((m, i) => (i === 0 ? { ...m, texte: `${m.texte}x` } : m));
    expect((await POST(requete(corps("tuto", { plan: { ...retouche, mots } })))).status).toBe(409);
    expect(etat.lancements).toEqual([]);
  });

  it("réglages du film : la route les emporte ; illisibles : 400 avant tout lancement", async () => {
    await depots().versions.enregistrer({ ...(await depots().versions.obtenir("tuto-v1"))!, commande: { formatId: ID, entrees: {} } } as never);
    const r = await POST(requete(corps("tuto", { reglagesFilm: { parEtape: { inconnue: { zoom: "plus" } } } })));
    expect(r.status).toBe(400);
    expect(etat.lancements).toEqual([]);
  });

  it("champ en trop (accord de prix glissé) : 400, rien lancé", async () => {
    expect((await POST(requete(corps("tuto", { confirme: { jeton: "x" } })))).status).toBe(400);
    expect(etat.lancements).toEqual([]);
  });

  it("cas valide : 200, `lancerRetouche` appelé une fois avec l'opération `planScenes` ; la réponse ne porte aucun montant", async () => {
    const r = await POST(requete(corps("tuto")));
    expect(r.status).toBe(200);
    const j = (await r.json()) as Record<string, unknown>;
    expect(j).toEqual({ statut: "lancee", travailId: "trav-46b-1" });
    expect(etat.lancements).toHaveLength(1);
    expect(etat.lancements[0]).toMatchObject({ videoId: "tuto", planIds: [], consigne: DEMANDE });
    expect(etat.lancements[0]!.options.operations).toHaveLength(1);
    expect(etat.lancements[0]!.options.operations![0]!.type).toBe("planScenes");
    expect(JSON.stringify(etat.lancements[0]!.options.operations![0]!.plan)).toBe(JSON.stringify(retouche));
  });

  it("deux clics : un seul travail (garde de `lancerRetouche` sur la même consigne)", async () => {
    const [a, b] = await Promise.all([POST(requete(corps("tuto"))), POST(requete(corps("tuto", { demande: `  ${DEMANDE} ` })))]);
    const [ja, jb] = [(await a.json()) as { travailId: string }, (await b.json()) as { travailId: string }];
    expect(ja.travailId).toBe("trav-46b-1");
    expect(jb.travailId).toBe(ja.travailId);
    expect(etat.lancements).toHaveLength(1);
    expect((await depots().versions.lister((v) => v.videoId === "tuto")).length).toBe(2);
  });

  it("versions : la nouvelle est dans `historique`, le parent est gardé, « revenir » à la version 1 la remet choisie", async () => {
    expect((await POST(requete(corps("tuto")))).status).toBe(200);
    const h = (await (await POST(requete({ action: "historique", generateur: ID, videoId: "tuto" }))).json()) as { versions: { id: string }[] };
    expect(h.versions.map((v) => v.id)).toEqual(["tuto-v1", "tuto-v2"]);
    expect((await depots().versions.obtenir("tuto-v2"))?.parentVersionId).toBe("tuto-v1");
    expect((await depots().versions.obtenir("tuto-v1"))?.projetMontage).toEqual({ tutoriel: { plan: { plan }, audio: { empreinte: "voix-1" } } });
    // La fabrication finie, la nouvelle version est choisie (doublé ici) ; Williams revient à la première.
    await choisirVersion("tuto", "tuto-v2");
    expect((await depots().videos.obtenir("tuto"))?.versionChoisieId).toBe("tuto-v2");
    const r = await POST(requete({ action: "revenir", generateur: ID, videoId: "tuto", versionId: "tuto-v1" }));
    expect(await r.json()).toEqual({ statut: "revenue", versionId: "tuto-v1" });
    expect((await depots().videos.obtenir("tuto"))?.versionChoisieId).toBe("tuto-v1");
    expect((await depots().versions.lister((v) => v.videoId === "tuto" && v.choisie)).map((v) => v.id)).toEqual(["tuto-v1"]);
    expect((await depots().versions.lister((v) => v.videoId === "tuto")).length).toBe(2);
    expect(etat.lancements).toHaveLength(1);
  });

  it("les actions d'avant ne lancent jamais rien", async () => {
    for (const action of ["apercu", "appliquer"]) await POST(requete({ action, generateur: ID, videoId: "tuto", demande: DEMANDE, ...(action === "appliquer" ? { operations: [] } : {}) }));
    expect(etat.lancements).toEqual([]);
  });
});

describe("46b · écran : bouton « Fabriquer cette version »", () => {
  it("`versionAFabriquer` : seulement une issue « plan-pret » du tutoriel, avec son plan", () => {
    expect(versionAFabriquer(ID, DEMANDE, { statut: "plan-pret", plan: retouche })).toEqual({ demande: DEMANDE, plan: retouche });
    expect(versionAFabriquer("avocat", DEMANDE, { statut: "plan-pret", plan: retouche })).toBeNull();
    expect(versionAFabriquer(undefined, DEMANDE, { statut: "plan-pret", plan: retouche })).toBeNull();
    expect(versionAFabriquer(ID, DEMANDE, { statut: "inchangee", plan: retouche })).toBeNull();
    expect(versionAFabriquer(ID, DEMANDE, { statut: "rendue", versionId: "x" })).toBeNull();
    expect(versionAFabriquer(ID, DEMANDE, { statut: "plan-pret" })).toBeNull();
    expect(versionAFabriquer(ID, DEMANDE, { statut: "plan-pret", plan: "x" })).toBeNull();
  });

  it("phrase « son rendu se branchera » : retirée quand le bouton est là, gardée sinon ; aucune phrase nouvelle", () => {
    const remarques = ["Autre remarque.", PHRASE_RENDU_NON_BRANCHE];
    expect(remarquesAffichees(remarques, true)).toEqual(["Autre remarque."]);
    expect(remarquesAffichees(remarques, false)).toEqual(remarques);
    expect(remarquesAffichees([PHRASE_RENDU_NON_BRANCHE], true)).toEqual([]);
  });

  it("la copie de la phrase dans le composant client est strictement égale à celle du service", () => {
    expect(PHRASE_RENDU_NON_BRANCHE_COPIE).toBe(PHRASE_RENDU_NON_BRANCHE);
  });

  it("le composant client n'importe aucun module serveur (service de retouche, server-only, fournisseurs, base)", () => {
    const src = readFileSync("src/components/retouche-chat/ChatRetouche.tsx", "utf8");
    const importes = [...src.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
    expect(importes.length).toBeGreaterThan(0);
    for (const chemin of importes) {
      expect(chemin).not.toMatch(/^@\/services\/retouche-chat\/(service|tutoriel-|comprendre|appliquer|generateurs)/);
      expect(chemin).not.toMatch(/server-only|^@\/fournisseurs\/|^@\/services\/|^@\/db|^@\/lib\/db/);
    }
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });

  it("rien à dire avec le bouton de fabrication : jamais « Rien n'a changé. » ; la phrase d'impact existante ou rien", () => {
    const sansRemarque = remarquesAffichees([PHRASE_RENDU_NON_BRANCHE], true);
    expect(sansRemarque).toEqual([]);
    const scenes = [{ id: "s1" }];
    expect(texteSansNouvelleVersion(sansRemarque, { phrase: "Une scène change.", scenes }, true)).toBe("Une scène change.");
    // film seul : aucune scène ne change, la phrase d'impact est retirée par le serveur exprès : rien ne s'affiche
    expect(texteSansNouvelleVersion(sansRemarque, { phrase: "Aucune scène ne change, la voix ne change pas.", scenes: [] }, true)).toBe("");
    expect(texteSansNouvelleVersion(sansRemarque, { phrase: "Aucune scène ne change, la voix ne change pas." }, true)).toBe("");
    expect(texteSansNouvelleVersion(sansRemarque, { phrase: "Aucune scène ne change.", scenes: "x" }, true)).toBe("");
    expect(texteSansNouvelleVersion(sansRemarque, undefined, true)).toBe("");
    expect(texteSansNouvelleVersion(sansRemarque, { phrase: 3, scenes: [{ id: "s1" }] }, true)).toBe("");
    expect(texteSansNouvelleVersion(["Autre remarque."], { phrase: "Une scène change.", scenes }, true)).toBe("Autre remarque.");
    expect(texteSansNouvelleVersion([], { phrase: "Une scène change.", scenes }, false)).toBe("Rien n'a changé.");
  });

  it("`versionAFabriquer` emporte les réglages du film non vides, et seulement eux", () => {
    const reglagesFilm = { parEtape: { e1: { zoom: "plus" } } };
    expect(versionAFabriquer(ID, DEMANDE, { statut: "plan-pret", plan: retouche, reglagesFilm })).toEqual({ demande: DEMANDE, plan: retouche, reglagesFilm });
    expect(versionAFabriquer(ID, DEMANDE, { statut: "plan-pret", plan: retouche, reglagesFilm: null })).toEqual({ demande: DEMANDE, plan: retouche });
  });

  const zone = (p: { pret: boolean; lancee: boolean }) => renderToStaticMarkup(createElement(ZoneFabriquer, { videoId: "tuto", ...p, occupe: false, onFabriquer: () => undefined }));

  it("rien à fabriquer : rien n'est rendu", () => {
    expect(zone({ pret: false, lancee: false })).toBe("");
  });

  it("plan prêt : le bouton, et aucun montant", () => {
    const html = zone({ pret: true, lancee: false });
    expect(html).toContain("Fabriquer cette version");
    expect(html).not.toContain("La nouvelle version se fabrique");
    expect(html).not.toMatch(/[€$]|\beuros?\b|\bcrédits?\b/i);
  });

  it("après le clic : la phrase, le lien vers le suivi, plus de bouton, aucun montant", () => {
    const html = zone({ pret: false, lancee: true });
    expect(html).toContain("La nouvelle version se fabrique. Les versions d&#x27;avant restent disponibles.");
    expect(html).toContain('href="/tutoriel-outil/suivi/tuto"');
    expect(html).not.toContain("Fabriquer cette version");
    expect(html).not.toMatch(/[€$]|\beuros?\b|\bcrédits?\b/i);
  });
});
