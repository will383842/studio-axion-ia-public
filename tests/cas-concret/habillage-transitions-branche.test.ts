/**
 * BR-TRANSITIONS-CC-a · transitions dessinées entre écrans du cas concret : tout le fil SAUF la ligne de `fabriquer.ts`.
 * Réglage `habillage.transitionsPlanScenes` → `services/cas-concret.ts` → `etapes.ts` → `planScenesCasConcret` → `habillerTranches`
 * → ce que dessine `rendu.tsx`. ÉTEINT par défaut : absent = rien de neuf. Doubles seulement, aucun appel réel, aucun euro.
 */
import { hash } from "@node-rs/argon2";
import { existsSync } from "node:fs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { RELU_RECRUTEMENT } from "../helpers/script-relu";
import { lireEntreesCasConcret } from "@/moteurs/montage-cas-concret/etapes";
import { planScenesCasConcret, cleTranche, type GroupePourPlan } from "@/moteurs/montage-cas-concret/plan-scenes";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const AVEC_RENDU = existsSync("studio-rendu/node_modules/remotion/dist/esm/index.mjs");
const etat = vi.hoisted(() => ({ image: 0 }));
vi.mock("../../studio-rendu/node_modules/remotion/dist/esm/index.mjs", async (origine) => {
  const vrai = await origine<Record<string, unknown>>();
  return { ...vrai, Sequence: (p: { children?: unknown }) => p.children ?? null, Audio: () => null, useCurrentFrame: () => etat.image, useVideoConfig: () => ({ fps: 25, width: 1080, height: 1920, durationInFrames: 250, id: "essai", defaultProps: {}, props: {}, defaultCodec: null }) };
});
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const service = await import("@/services/cas-concret");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "cas-concret-habillage-transitions";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"];

/** Un groupe de 30 écrans (une phrase par écran, 350 ms par mot) = un plan de ≥ 10 scènes (le choix ne pose rien dessous) ; pièces du stock : jamais de paramètre `appeler`. */
function grandGroupe(id: string): GroupePourPlan {
  const phrases = DIX_SCRIPTS.flatMap((s) => s.match(/[^.?!]+[.?!]?/g)!.map((p) => p.trim()).filter(Boolean)).slice(0, 30);
  let t = 0;
  return {
    id,
    ecrans: phrases.map((texteDit, i) => {
      const debutMs = t;
      t += texteDit.split(/\s+/).length * 350;
      return { id: `e${i + 1}`, texteDit, debutMs, finMs: t };
    }),
  };
}
const GROUPE = grandGroupe("corps");
const habillageDe = (t: PlanValide | undefined) => (t as PlanHabille | undefined)?.habillageCommun;
const avecTransitions = (r: { tranches: Record<string, PlanValide> }) => Object.entries(r.tranches).filter(([, t]) => Object.keys(habillageDe(t)?.transitions ?? {}).length > 0);

describe("(a) éteint = identique", () => {
  it("sans `habillage` ou `actif` ≠ true : mêmes tranches, aucune porte `habillageCommun`", async () => {
    const base = await planScenesCasConcret({ groupes: [GROUPE] });
    expect(GROUPE.ecrans.length).toBeGreaterThanOrEqual(10);
    expect(base.memo.corps!.plan!.scenes.length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(base.tranches).length).toBeGreaterThan(0);
    for (const actif of [false, "true" as never, 1 as never, undefined as never]) {
      const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif, graine: "v-essai" } });
      expect(JSON.stringify(r)).toBe(JSON.stringify(base));
    }
    for (const t of Object.values(base.tranches)) expect(habillageDe(t)).toBeUndefined();
  });
  it("le mémo ne change pas : habillage posé après le plan, hors de l'empreinte (aucun appel refait)", async () => {
    const base = await planScenesCasConcret({ groupes: [GROUPE] });
    const allume = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-essai" } });
    expect(allume.memo).toEqual(base.memo);
    const rejoue = await planScenesCasConcret({ groupes: [GROUPE], memo: base.memo, habillage: { actif: true, graine: "v-essai" } });
    expect(rejoue.tranches).toEqual(allume.tranches);
  });
});

describe("(b) allumé : des transitions sur les tranches", () => {
  it("au moins une tranche porte `habillageCommun.transitions`, les autres restent intactes", async () => {
    const base = await planScenesCasConcret({ groupes: [GROUPE] });
    const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-essai" } });
    expect(avecTransitions(r).length).toBeGreaterThan(0);
    expect(Object.keys(r.tranches).sort()).toEqual(Object.keys(base.tranches).sort());
    for (const [cle, t] of Object.entries(r.tranches)) {
      const { habillageCommun: _h, ...reste } = t as PlanHabille;
      void _h;
      expect(reste).toEqual(base.tranches[cle]);
    }
  });
  it("aucune transition posée sur une scène face caméra", async () => {
    const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-essai" } });
    for (const t of Object.values(r.tranches)) if (t.facecam === true) expect(habillageDe(t)).toBeUndefined();
    expect(Object.values(r.tranches).every((t) => t.facecam !== true)).toBe(true);
  });
  it("sous 10 écrans : rien de posé (règle du choix)", async () => {
    const petit = { ...GROUPE, ecrans: GROUPE.ecrans.slice(0, 10) };
    const r = await planScenesCasConcret({ groupes: [petit], habillage: { actif: true, graine: "v-essai" } });
    expect(avecTransitions(r)).toHaveLength(0);
  });
});

describe("(d) même graine, mêmes transitions", () => {
  it("déterministe, et la clé du groupe entre dans la graine", async () => {
    const a = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-essai" } });
    const b = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-essai" } });
    expect(b.tranches).toEqual(a.tranches);
    const autres = await Promise.all(["v-2", "v-3", "v-4", "v-5", "v-6"].map((graine) => planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine } })));
    expect(autres.some((x) => JSON.stringify(x.tranches) !== JSON.stringify(a.tranches))).toBe(true);
  });
});

describe("(c) lecture tolérante d'`etapes.ts` : seul `true` exact allume", () => {
  const base = { casId: "recrutement-apporteurs", reseaux: ["facebook"], avecMot: false, essai: false };
  it("true → allumé ; \"true\", 1, absent → champ absent, objet identique", () => {
    expect(lireEntreesCasConcret({ casConcret: { ...base, habillageTransitions: true } } as never).habillageTransitions).toBe(true);
    const sans = lireEntreesCasConcret({ casConcret: base } as never);
    expect(Object.keys(sans)).not.toContain("habillageTransitions");
    for (const v of ["true", 1, null, false, {}]) expect(lireEntreesCasConcret({ casConcret: { ...base, habillageTransitions: v } } as never)).toEqual(sans);
  });
});

describe("chemin réel : `preparerEtLancer` lit le réglage et fige les entrées de la vidéo", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = "t".repeat(48);
    const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    const d = depots();
    const base = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
    await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  });
  const lancer = vi.fn(async () => ({ travailId: "t-habillage-transitions" }));
  const entreesEcrites = async (): Promise<Record<string, unknown>> => {
    const r = await service.preparerEtLancer({ casId: "recrutement-apporteurs", reseaux: RESEAUX, mot: "IA", avecMot: true, accordCentimes: 10_000, empreinteScriptRelu: RELU_RECRUTEMENT }, { lancer });
    expect(r.statut).toBe("lancee");
    const [v] = await depots().videos.lister((x) => x.formatId === "cas-concret");
    return (v!.entrees as { casConcret: Record<string, unknown> }).casConcret;
  };
  it("réglage à false exact : aucune clé (éteint ; absent = allumé depuis ALLUMER-TRANSITIONS-CC-v20g)", { timeout: 60_000 }, async () => {
    await ecrireParametre("habillage.transitionsPlanScenes", false);
    expect(Object.keys(await entreesEcrites())).not.toContain("habillageTransitions");
  });
  it("réglage à true exact : l'entrée `habillageTransitions` part avec la vidéo, relue par le moteur, puis allume le plan", async () => {
    await ecrireParametre("habillage.transitionsPlanScenes", true);
    const figees = await entreesEcrites();
    expect(figees.habillageTransitions).toBe(true);
    const lues = lireEntreesCasConcret({ casConcret: figees } as never);
    expect(lues.habillageTransitions).toBe(true);
    const r = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: lues.habillageTransitions === true, graine: "v-essai" } });
    expect(avecTransitions(r).length).toBeGreaterThan(0);
  });
  it("l'estimation (le prix) est la même réglage allumé ou non", async () => {
    const prix = async () => JSON.stringify(await service.estimerCas("recrutement-apporteurs", RESEAUX, true));
    const avant = await prix();
    await ecrireParametre("habillage.transitionsPlanScenes", true);
    expect(await prix()).toBe(avant);
  });
  async function beforeEachRelance() {
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    const d = depots();
    const base = (await d.voix.obtenir("voix-will"))!;
    await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
    await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  }
});

// Chemin calculé : tsc (projet racine, qui exclut studio-rendu) ne suit pas cet import et ne cherche pas `remotion` hors de studio-rendu.
const chemin = (c: string) => ["..", "..", "studio-rendu", "compositions", c].join("/");
const PLAN_SCENES = AVEC_RENDU ? ((await import(/* @vite-ignore */ chemin("plan-scenes/CalquePlanScenes"))) as { CalquePlanScenes: (p: { plan: PlanValide }) => unknown }) : null;
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const react = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react/index.js")) as typeof import("react")) : null;
// @ts-expect-error le react de studio-rendu n'a pas de types ici
const serveur = AVEC_RENDU ? ((await import("../../studio-rendu/node_modules/react-dom/server.js")) as typeof import("react-dom/server")) : null;

describe.skipIf(!AVEC_RENDU)("(e) rendu : la transition commune se voit au milieu de l'entrée", () => {
  it("la tranche habillée ne rend pas comme la même tranche sans habillage, au milieu d'une transition", async () => {
    const habille = await planScenesCasConcret({ groupes: [GROUPE], habillage: { actif: true, graine: "v-essai" } });
    const [cle, tranche] = avecTransitions(habille)[0]!;
    const nue = (await planScenesCasConcret({ groupes: [GROUPE] })).tranches[cle]!;
    expect(cle.startsWith(cleTranche("corps", ""))).toBe(true);
    const rendu = (p: PlanValide, image: number) => {
      etat.image = image;
      return serveur!.renderToStaticMarkup(react!.createElement(PLAN_SCENES!.CalquePlanScenes as never, { plan: p } as never));
    };
    // La transition commune est posée sur la scène `t<k>` de la tranche, côté entrée ou sortie : on balaie toutes les images.
    const [idScene, def] = Object.entries(habillageDe(tranche)!.transitions!)[0]!;
    const sc = tranche.scenes.find((x) => x.id === idScene)!;
    const fps = tranche.format.fps;
    const debut = Math.round((sc.debutMs * fps) / 1000);
    const fin = Math.round((sc.finMs * fps) / 1000);
    const milieu = def.entree ? debut + Math.max(1, Math.round((sc.transition.dureeMs * fps) / 2000)) : fin - Math.max(1, Math.round((sc.transition.dureeMs * fps) / 2000));
    expect(rendu(tranche, milieu)).not.toBe(rendu(nue, milieu));
    // Hors transition (milieu de la scène) : identique.
    expect(rendu(tranche, Math.round((debut + fin) / 2))).toBe(rendu(nue, Math.round((debut + fin) / 2)));
  });
});
