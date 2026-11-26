/**
 * ALLUMER-RETOUCHE-DEMO-v21r : `retoucheChat.demoFacecam` ALLUMÉE par défaut (absent = allumé ; `false` écrit l'éteint), à 0 € :
 * aperçu par règles (aucun appel réseau), « Appliquer » seulement à estimation 0, aucun lecteur Claude, aucun « fabriquer ».
 * Dépôts en mémoire, vrais modules, réseau absent. Aucun appel réel.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { appliquerRetoucheDemo } from "@/services/retouche-chat/appliquer-demo";
import { GENERATEURS_RETOUCHE, retoucheChatActif, type IdGenerateurRetouche } from "@/services/retouche-chat/generateurs";
import { lecteurClaudeActif } from "@/services/retouche-chat/lecteur-generateurs";
import { ligneRecette, type ReleveDepots } from "../../outils/recette-retouche-chat/recette";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.setConfig({ testTimeout: 60_000 });

const MDP = "allumee-v21r";
const CLE = "retoucheChat.demoFacecam";
const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const OPS = [{ type: "changer-mot", sceneId: "s2", ancien: "Axion CRM", nouveau: "Axion Pro" }];
const requete = (c: unknown) => new Request("http://x/api/retouche-chat", { method: "POST", body: JSON.stringify(c) }) as never;
const corps = (videoId: string, extra: Record<string, unknown> = {}) => ({ action: "appliquer", generateur: "demo-facecam", videoId, demande: "change Axion CRM en Axion Pro", operations: OPS, ...extra });
const fetchEspion = vi.fn(async () => { throw new Error("réseau interdit dans ce test"); });

beforeAll(async () => {
  process.env.SESSION_SECRET = "v".repeat(48);
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 })).toString("base64");
});
beforeEach(() => {
  fetchEspion.mockClear();
  vi.stubGlobal("fetch", fetchEspion);
});

/** Une démo face caméra en mémoire (version choisie = reprise + plan) ; le réglage n'est écrit QUE si `reglage` est donné. */
async function monter(reglage?: { valeur: unknown }) {
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
  if (reglage) await commun.ecrireParametre(CLE, reglage.valeur);
  const trouvee = (await depots().videos.lister(() => true)).find((v) => v.versionChoisieId)!;
  await depots().videos.modifier(trouvee.id, { etapeEditoriale: "validee" });
  const video = (await depots().videos.obtenir(trouvee.id))!;
  const parent = (await depots().versions.obtenir(video.versionChoisieId!))!;
  const plan = plan0();
  const mots = plan.mots.map((m) => ({ mot: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 }));
  const reprise = { mots, calage: {}, dureeSec: 10, synchro: { mode: "aucune", decalageSec: 0 }, plan, sorties: {}, signatureConsignes: "x" };
  await depots().versions.enregistrer({ ...parent, commande: { ...parent.commande, moteurId: ID_MOTEUR_DEMO_FACECAM, formatId: "demo-facecam", origine: "studio" }, projetMontage: { reprise } });
  const lire = (id: string, defaut: unknown) => commun.lireParametre<unknown>(id, defaut);
  return { depots, video, parent, POST, lire };
}
const poster = async (POST: (r: never) => Promise<Response>, c: unknown) => {
  const r = await POST(requete(c));
  return { statut: r.status, json: (await r.json()) as Record<string, unknown> };
};

describe("ALLUMER-RETOUCHE-DEMO-v21r · a) allumée par défaut", () => {
  it("a) absent ou null (= absent pour lireParametre) → allumé ; false, \"true\", 1, {} écrits → éteint ; lecture qui lève → éteint ; 2e appel identique ; les 5 autres : absent → éteint", async () => {
    const m = await monter();
    expect(await retoucheChatActif("demo-facecam", m.lire)).toBe(true);
    expect(await retoucheChatActif("demo-facecam", m.lire)).toBe(true);
    for (const g of GENERATEURS_RETOUCHE.filter((x) => x !== "demo-facecam")) expect(await retoucheChatActif(g as IdGenerateurRetouche, m.lire), g).toBe(false);
    const nul = await monter({ valeur: null });
    expect(await retoucheChatActif("demo-facecam", nul.lire), "null").toBe(true);
    for (const v of [false, "true", 1, {}]) {
      const n = await monter({ valeur: v });
      expect(await retoucheChatActif("demo-facecam", n.lire), JSON.stringify(v)).toBe(false);
    }
    expect(await retoucheChatActif("demo-facecam", async () => { throw new Error("panne"); })).toBe(false);
    expect(await retoucheChatActif("demo-facecam", async (_c, defaut) => defaut)).toBe(true);
    expect(await retoucheChatActif("avocat", async (_c, defaut) => defaut)).toBe(false);
  });
});

describe("ALLUMER-RETOUCHE-DEMO-v21r · b) c) aperçu et « Appliquer » à 0 €", () => {
  it("b) aperçu (réglage absent) : 200, aucun appel réseau donc aucun Claude, aucune réservation", async () => {
    const { depots, video, POST } = await monter();
    const r = await poster(POST, { action: "apercu", generateur: "demo-facecam", videoId: video.id, demande: "change Axion CRM en Axion Pro" });
    expect(r.statut).toBe(200);
    expect(fetchEspion).not.toHaveBeenCalled();
    expect(await depots().reservations.lister(() => true)).toHaveLength(0);
  });

  it("c) « Appliquer » (réglage absent) : lancee, réservations à 0 centime, engagement 0, aucun appel réseau, recette C7-25 = gratuit-prouve", async () => {
    const { depots, video, parent, POST } = await monter();
    const r = await poster(POST, corps(video.id));
    expect(r.statut).toBe(200);
    expect(r.json, JSON.stringify(r.json.remarques)).toMatchObject({ statut: "lancee" });
    expect(fetchEspion).not.toHaveBeenCalled();
    const travailId = r.json.travailId as string;
    const reservations = await depots().reservations.lister((x) => x.travailId === travailId);
    for (const x of reservations) expect(x.centimes).toBe(0);
    const engage = await depots().parametres.obtenir(`budget.engage.${travailId}`);
    const releve: ReleveDepots = {
      reservations: reservations.map((x) => ({ travailId: x.travailId, centimes: x.centimes, devise: x.devise, statut: x.statut })) as ReleveDepots["reservations"],
      engagements: { [travailId]: ((engage?.valeur as { centimes?: number } | undefined)?.centimes ?? 0) },
      depenses: [],
      versions: (await depots().versions.lister((v) => v.videoId === video.id)).map((v) => ({ id: v.id, videoId: v.videoId, parentVersionId: v.parentVersionId })),
    };
    expect(ligneRecette(releve, { generateur: "demo-facecam", videoId: video.id, versionAvant: parent.id, issue: { statut: "lancee", travailId } }).verdict).toBe("gratuit-prouve");
  });

  it("d) borne 0 € : estimation 0 → lancée ; 1 centime → plan-pret, 0 lancement", async () => {
    const lancer = vi.fn(async () => ({ statut: "lancee" as const, travailId: "t" }));
    const ports = { appeler: vi.fn(), lireVersionChoisie: async () => ({ versionId: "v1", plan: plan0() }), enregistrerVersion: vi.fn(), choisirVersion: vi.fn() } as never;
    const issue = await appliquerRetoucheDemo("vid", { demande: "x", operations: OPS }, ports, lancer);
    expect(issue.statut).toBe("lancee");
    const refus = vi.fn(async () => ({ statut: "plan-pret" as const, raison: "coût de 1 centime : le plan reste prêt" }));
    const issue1 = await appliquerRetoucheDemo("vid", { demande: "x", operations: OPS }, ports, refus);
    expect(issue1.statut).toBe("plan-pret");
    expect(lancer).toHaveBeenCalledTimes(1);
  });
});

describe("ALLUMER-RETOUCHE-DEMO-v21r · e) f) g) rien de payant, coupe-circuit, N-22", () => {
  // ALLUMER-LECTEUR-CHAT-v20k (seconde lecture du pilote) : le lecteur de la démo est ALLUMÉ par défaut ; `false` écrit garde l'éteint.
  it("e) lecteur Claude de la démo absent → vrai, `false` → faux ; « fabriquer » pour la démo → 409 ; aucun appel réseau", async () => {
    const { video, POST, lire } = await monter();
    expect(await lecteurClaudeActif("demo-facecam", lire)).toBe(true);
    expect(await lecteurClaudeActif("demo-facecam", async () => false)).toBe(false);
    const r = await poster(POST, { action: "fabriquer", generateur: "demo-facecam", videoId: video.id, demande: "x", plan: plan0() });
    expect(r.statut).toBe(409);
    expect(fetchEspion).not.toHaveBeenCalled();
  });

  it("f) coupe-circuit : retoucheChat.demoFacecam = false → apercu, appliquer, revenir, historique, retablir → 403, rien écrit", async () => {
    const { depots, video, parent, POST } = await monter({ valeur: false });
    const avant = (await depots().versions.lister(() => true)).length;
    for (const c of [
      { action: "apercu", demande: "zoom" },
      { action: "appliquer", demande: "zoom", operations: OPS },
      { action: "revenir", versionId: parent.id },
      { action: "historique" },
      { action: "retablir" },
    ]) expect((await poster(POST, { generateur: "demo-facecam", videoId: video.id, ...c })).statut, JSON.stringify(c)).toBe(403);
    expect((await depots().versions.lister(() => true)).length).toBe(avant);
    expect(await depots().reservations.lister(() => true)).toHaveLength(0);
  });

  it("g) vidéo programmée ou publiée → 409 même allumée, rien lancé", async () => {
    const { depots, video, POST } = await monter();
    await depots().videos.modifier(video.id, { etapeEditoriale: "programmee" });
    expect((await poster(POST, corps(video.id))).statut).toBe(409);
    expect(await depots().reservations.lister(() => true)).toHaveLength(0);
  });
});
