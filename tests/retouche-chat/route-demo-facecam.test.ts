/**
 * N-26-c2-v20j (D4-F3) — la route du chat : « appliquer » sur la démo face caméra LANCE la retouche, seulement si elle est
 * gratuite ; sinon « plan-pret ». Doubles de `generateurs-studio` et des dépendances du studio ; vrais `appliquerRetoucheDemo`,
 * `lancerRetoucheDemo` et vrai moteur démo ; aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { creerMoteurMontageDemoFacecam } from "@/moteurs/montage-demo-facecam";

const etat = vi.hoisted(() => ({
  reel: false, // h) : vrais modules, dépôts en mémoire (rien n'est doublé sauf le réseau, absent)
  actif: true,
  importes: [] as string[],
  enDiffusion: false,
  plan: null as unknown,
  appeler: null as null | ReturnType<typeof import("vitest").vi.fn>,
  enregistrerVersion: null as null | ReturnType<typeof import("vitest").vi.fn>,
  lancer: null as null | ReturnType<typeof import("vitest").vi.fn>,
  reprise: null as null | (() => Promise<unknown>),
  centimes: 0,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("@/services/auth", async (importer) => {
  const reel = await importer<typeof import("@/services/auth")>();
  return { ...reel, sessionApi: async () => (etat.reel ? reel.sessionApi() : { id: "s" }) };
});
vi.mock("@/services/_commun", async (importer) => {
  const reel = await importer<typeof import("@/services/_commun")>();
  return {
    ...reel,
    lireParametre: async (id: string, defaut: unknown) => (etat.reel ? reel.lireParametre(id, defaut) : defaut),
    depots: () => (etat.reel ? reel.depots() : ({ videos: { obtenir: async () => (etat.enDiffusion ? { id: "vid", etapeEditoriale: "programmee" } : { id: "vid" }) }, versions: { obtenir: async () => null } } as never)),
  };
});
vi.mock("@/services/retouche-chat/generateurs-studio", async (importer) => {
  const reel = await importer<typeof import("@/services/retouche-chat/generateurs-studio")>();
  return {
    retoucheChatActifServeur: (g: never) => (etat.reel ? reel.retoucheChatActifServeur(g) : Promise.resolve(etat.actif)),
    portsGenerateurStudio: (g: never, o: never) =>
      etat.reel
        ? reel.portsGenerateurStudio(g, o)
        : {
            appeler: etat.appeler,
            lireVersionChoisie: async () => (etat.plan ? { versionId: "v1", plan: etat.plan } : null),
            enregistrerVersion: etat.enregistrerVersion,
            choisirVersion: vi.fn(),
          },
  };
});
// `importes` compte les APPELS des 3 modules de la branche (la fabrique d'un double n'est évaluée qu'une fois par fichier).
vi.mock("@/services/retouche-chat/appliquer-demo", async (importer) => {
  const reel = await importer<typeof import("@/services/retouche-chat/appliquer-demo")>();
  return { ...reel, appliquerRetoucheDemo: (...a: Parameters<typeof reel.appliquerRetoucheDemo>) => (etat.importes.push("appliquer-demo"), reel.appliquerRetoucheDemo(...a)) };
});
vi.mock("@/services/retouche-chat/lancer-demo", async (importer) => {
  const reel = await importer<typeof import("@/services/retouche-chat/lancer-demo")>();
  return { ...reel, lancerRetoucheDemo: (...a: Parameters<typeof reel.lancerRetoucheDemo>) => (etat.importes.push("lancer-demo"), reel.lancerRetoucheDemo(...a)) };
});
vi.mock("@/services/retouche-chat/deps-demo-studio", async (importer) => {
  const reel = await importer<typeof import("@/services/retouche-chat/deps-demo-studio")>();
  return {
    depsLancerDemoStudio: (videoId: string, versionId: string) =>
      (etat.importes.push("deps-demo-studio"), etat.reel)
        ? reel.depsLancerDemoStudio(videoId, versionId)
        : {
            lancer: etat.lancer,
            reprise: () => etat.reprise!(),
            estimer: async (ops: unknown[]) => (etat.centimes === 0 ? creerMoteurMontageDemoFacecam().estimerRetouche({} as never, [], { operations: ops, parent: {} } as never) : { total: { centimes: etat.centimes, devise: "EUR" } }),
          },
  };
});

vi.setConfig({ testTimeout: 60_000 }); // premier import à froid de la route

const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const OPS = [{ type: "changer-mot", sceneId: "s2", ancien: "Axion CRM", nouveau: "Axion Pro" }];
const REPRISE = { mots: [], plan: { scenes: [] } };
const corps = (extra: Record<string, unknown> = {}) => ({ action: "appliquer", generateur: "demo-facecam", videoId: "vid", demande: "change Axion CRM en Axion Pro", operations: OPS, ...extra });
const requete = (c: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(c) }) as never;
async function poster(c: unknown) {
  vi.resetModules();
  const { POST } = await import("@/app/api/retouche-chat/route");
  const r = await POST(requete(c));
  return { statut: r.status, json: (await r.json()) as Record<string, unknown> };
}

beforeEach(() => {
  etat.reel = false;
  etat.actif = true;
  etat.importes = [];
  etat.enDiffusion = false;
  etat.plan = plan0();
  etat.appeler = vi.fn();
  etat.enregistrerVersion = vi.fn(async () => ({ versionId: "x" }));
  etat.lancer = vi.fn(async () => ({ retoucheId: "r", travailId: "t1" }));
  etat.reprise = async () => REPRISE;
  etat.centimes = 0;
});

describe("N-26-c2 · route du chat, « appliquer » de la démo face caméra", () => {
  it("a) démo éteinte : 403, aucun des 3 modules de la branche n'est appelé", async () => {
    etat.actif = false;
    const r = await poster(corps());
    expect(r.statut).toBe(403);
    expect(etat.importes).toEqual([]);
    expect(etat.lancer).not.toHaveBeenCalled();
  });

  it("b) vidéo programmée ou publiée : 409 (N-22), lancer 0 appel, aucun module appelé", async () => {
    etat.enDiffusion = true;
    const r = await poster(corps());
    expect(r.statut).toBe(409);
    expect(etat.lancer).not.toHaveBeenCalled();
    expect(etat.importes).toEqual([]);
  });

  it("c) allumée, reprise + planScenes + estimation 0 : lancee, lancer appelé UNE fois (videoId, [], consigne, planScenes), aucune version écrite", async () => {
    const r = await poster(corps());
    expect(r.statut).toBe(200);
    expect(r.json).toMatchObject({ statut: "lancee", travailId: "t1" });
    expect(etat.lancer).toHaveBeenCalledTimes(1);
    const [videoId, ids, consigne, opts] = etat.lancer!.mock.calls[0] as [string, unknown[], string, { operations: { type: string; plan: unknown }[] }];
    expect([videoId, ids, consigne]).toEqual(["vid", [], "change Axion CRM en Axion Pro"]);
    expect(opts.operations).toHaveLength(1);
    expect(opts.operations[0]!.type).toBe("planScenes");
    expect(opts.operations[0]!.plan).toBeTruthy();
    expect(etat.enregistrerVersion).not.toHaveBeenCalled();
  });

  it("d) sans reprise : plan-pret, lancer 0 appel", async () => {
    etat.reprise = async () => null;
    const r = await poster(corps());
    expect(r.json.statut).toBe("plan-pret");
    expect(etat.lancer).not.toHaveBeenCalled();
    etat.reprise = async () => {
      throw new Error("illisible");
    };
    expect((await poster(corps())).json.statut).toBe("plan-pret");
    expect(etat.lancer).not.toHaveBeenCalled();
  });

  it("e) moteur à coût > 0 (1 centime) : plan-pret, 0 appel ; 0 centime : lancee (borne)", async () => {
    etat.centimes = 1;
    const r = await poster(corps());
    expect(r.json.statut).toBe("plan-pret");
    expect(etat.lancer).not.toHaveBeenCalled();
    etat.centimes = 0;
    expect((await poster(corps())).json.statut).toBe("lancee");
    expect(etat.lancer).toHaveBeenCalledTimes(1);
  });

  it("f) le chemin c) n'appelle jamais Claude du plan (appeler 0 appel) avec le vrai moteur démo", async () => {
    const r = await poster(corps());
    expect(r.json.statut).toBe("lancee");
    expect(etat.appeler).not.toHaveBeenCalled();
  });

  it("g) autre générateur (avocat) : réponse de master (plan-pret, aucun lancement, modules de la branche non appelés)", async () => {
    const r = await poster(corps({ generateur: "avocat" }));
    expect(r.statut).toBe(200);
    expect(r.json.statut).toBe("plan-pret");
    expect(etat.lancer).not.toHaveBeenCalled();
    expect(etat.importes).toEqual([]);
  });

  it("g bis) démo, action aperçu : chemin existant, aucun lancement, modules non appelés", async () => {
    const r = await poster({ action: "apercu", generateur: "demo-facecam", videoId: "vid", demande: "zoom" });
    expect(r.statut).toBe(200);
    expect(etat.lancer).not.toHaveBeenCalled();
    expect(etat.importes).toEqual([]);
  });
});

describe("N-26-c2 · h) témoin G6-07 : vrai lancerRetouche, dépôts en mémoire, 0 centime", () => {
  const MDP = "temoin-n26-c2";
  beforeAll(async () => {
    process.env.SESSION_SECRET = "n".repeat(48);
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
  });

  /** Une démo face caméra en mémoire : la version choisie porte la reprise ; réglage allumé. */
  async function monter(origine: "studio" | "usine") {
    etat.reel = true;
    vi.resetModules();
    reinitialiserRequete();
    const [{ reinitialiserDepots, depots }, auth, commun, { ID_MOTEUR_DEMO_FACECAM }, { POST }] = await Promise.all([
      import("@/donnees/memoire"),
      import("@/services/auth"),
      import("@/services/_commun"),
      import("@/moteurs/montage-demo-facecam"),
      import("@/app/api/retouche-chat/route"),
    ]);
    reinitialiserDepots();
    await auth.seConnecter(MDP, false);
    await commun.ecrireParametre("retoucheChat.demoFacecam", true);
    const trouvee = (await depots().videos.lister(() => true)).find((v) => v.versionChoisieId)!;
    await depots().videos.modifier(trouvee.id, { etapeEditoriale: "validee" });
    const video = (await depots().videos.obtenir(trouvee.id))!;
    const parent = (await depots().versions.obtenir(video.versionChoisieId!))!;
    const plan = plan0();
    const mots = plan.mots.map((m) => ({ mot: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 }));
    const reprise = { mots, calage: {}, dureeSec: 10, synchro: { mode: "aucune", decalageSec: 0 }, plan, sorties: {}, signatureConsignes: "x" };
    await depots().versions.enregistrer({ ...parent, commande: { ...parent.commande, moteurId: ID_MOTEUR_DEMO_FACECAM, formatId: "demo-facecam", origine }, projetMontage: { reprise } });
    return { depots, video, parent, POST };
  }

  it("h) après c) : une version en_fabrication de numeroSuivi ≠ parent, réservations à 0 centime, engagement à 0, origine du parent gardée", async () => {
    const { depots, video, parent, POST } = await monter("studio");
    const r = await POST(requete(corps({ videoId: video.id })));
    const json = (await r.json()) as Record<string, unknown>;
    expect(r.status).toBe(200);
    expect(json, JSON.stringify(json.remarques)).toMatchObject({ statut: "lancee" });
    const versions = await depots().versions.lister((x) => x.videoId === video.id && x.parentVersionId === parent.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ statut: "en_fabrication", choisie: false });
    expect(versions[0]!.numeroSuivi).not.toBe(parent.numeroSuivi);
    expect(versions[0]!.commande.origine).toBe("studio");
    const travailId = json.travailId as string;
    const engage = await depots().parametres.obtenir(`budget.engage.${travailId}`);
    expect((engage?.valeur as { centimes?: number } | undefined)?.centimes ?? 0).toBe(0);
    const reservations = await depots().reservations.lister((x) => x.travailId === travailId);
    for (const x of reservations) expect(x.centimes).toBe(0);
    expect(await depots().retouches.compter((x) => x.videoId === video.id && x.statut === "en_cours")).toBe(1);
  });

  it("h bis) commande d'origine « usine » SANS budget du mois reçu : plan-pret (refus BUDGET_USINE_ABSENT attrapé), rien réservé, aucune version", async () => {
    const { depots, video, parent, POST } = await monter("usine");
    const r = await POST(requete(corps({ videoId: video.id })));
    expect(((await r.json()) as Record<string, unknown>).statut).toBe("plan-pret");
    expect(await depots().versions.lister((x) => x.videoId === video.id && x.parentVersionId === parent.id)).toHaveLength(0);
    expect(await depots().retouches.compter((x) => x.videoId === video.id && x.statut === "en_cours")).toBe(0);
    expect(await depots().parametres.lister((p) => p.id.startsWith("budget.engage."))).toHaveLength(0);
  });
});
