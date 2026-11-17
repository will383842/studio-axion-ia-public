/**
 * G13-12 (W-N, 16/11) : les scènes en cache de la vidéo partent avec elle (`studio/<env>/scenes/<vidéo>/`).
 * Garde pure + plan de suppression + effacement simulé. `scenes` et `fiches-scenes` ne se confondent jamais ; aucun préfixe
 * d'une AUTRE vidéo ni sans identifiant ne peut être visé. Aucun appel réel : stockage simulé en mémoire.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { cleDeCetteVideo, cleProtegee, dossierPropreValide, DOSSIERS_PROPRES_VIDEO, prefixesDeVideo } from "@/domaine/dossiers-video";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const suppression = await import("@/services/suppression-video");
const { deposerObjetSimule, objetsSimulesRestants, viderObjetsSimules } = await import("@/fournisseurs/simulation/autres");

const ID = "v-01";
const AUTRE = "v-03";
const MDP = "essai-scenes-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  viderObjetsSimules();
  vi.restoreAllMocks();
  await auth.seConnecter(MDP, false);
});

describe("prefixesDeVideo", () => {
  it("6 préfixes : les 5 d'avant puis scenes en dernier", () => {
    expect(DOSSIERS_PROPRES_VIDEO).toEqual(["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes", "scenes"]);
    const p = prefixesDeVideo("prod", ID);
    expect(p).toHaveLength(6);
    expect(p[5]).toBe("studio/prod/scenes/v-01/");
    expect(p).toEqual(["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes", "scenes"].map((d) => `studio/prod/${d}/v-01/`));
  });

  it("jamais un préfixe d'une autre vidéo, ni sans identifiant : tout part de l'id donné, et un id hors convention lève", () => {
    for (const env of ["prod", "dev"] as const) {
      for (const p of prefixesDeVideo(env, ID)) {
        expect(p.endsWith(`/${ID}/`), p).toBe(true);
        expect(p.includes(AUTRE), p).toBe(false);
        expect(p.includes(`${ID}0`), p).toBe(false);
        expect(dossierPropreValide(p), p).toBe(true);
      }
    }
    for (const id of ["", "..", ".", "v/01", "v-01/../v-03", "v 01", "/", "v-01/"]) expect(() => prefixesDeVideo("prod", id), id).toThrow();
  });
});

describe("dossierPropreValide : scenes", () => {
  it("accepte studio/<env>/scenes/<id>/ et pas fiches-scenes confondu", () => {
    expect(dossierPropreValide("studio/prod/scenes/v-01/")).toBe(true);
    expect(dossierPropreValide("studio/dev/scenes/v_01/")).toBe(true);
    expect(dossierPropreValide("studio/prod/fiches-scenes/v-01/")).toBe(true);
  });
  it("refuse sans id, sans barre finale, remontée, sous-dossier, doublons, préfixes proches", () => {
    for (const p of [
      "studio/prod/scenes/", "studio/prod/scenes", "studio/prod/scenes/v-01", "studio/prod/scenes/../", "studio/prod/scenes/v-01/../",
      "studio/prod/scenes/v-01/s1/", "studio/prod/scenes//", "studio/test/scenes/v-01/", "/studio/prod/scenes/v-01/", "studio/prod/scenes/..//",
      "studio/prod/scenes/./", "studio/prod/mes-scenes/v-01/", "studio/prod/scenes-x/v-01/", "studio/prod/xfiches-scenes/v-01/", "studio/prod/fiches/v-01/",
      "studio/scenes/v-01/", "scenes/v-01/", "studio/prod/", "studio/", "",
    ]) expect(dossierPropreValide(p), p).toBe(false);
  });
});

describe("cleDeCetteVideo et cleProtegee", () => {
  it("la clé d'une scène de la vidéo est à elle ; celle de l'id voisin non", () => {
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-01")).toBe(true);
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-012")).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-012/s1.mp4", "v-01")).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-03/s1.mp4", "v-01")).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/../v-03/s1.mp4", "v-01")).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/", "v-01")).toBe(false);
  });
  it("cleProtegee inchangée", () => {
    for (const d of ["illustrations", "elements", "decors", "public", "site"]) expect(cleProtegee(`studio/prod/${d}/x/y.png`), d).toBe(true);
    for (const d of ["scenes", "fiches-scenes", "videos"]) expect(cleProtegee(`studio/prod/${d}/v-01/y.png`), d).toBe(false);
  });
});

describe("suppression définitive d'une vidéo", () => {
  it("le plan liste le dossier scenes de la vidéo, jamais celui d'une autre", async () => {
    const plan = await suppression.planifierSuppression((await depots().videos.obtenir(ID))!);
    expect(plan.dossiers).toContain(`studio/dev/scenes/${ID}/`);
    expect(plan.dossiers).toHaveLength(6);
    for (const p of plan.dossiers) {
      expect(p.endsWith(`/${ID}/`), p).toBe(true);
      expect(dossierPropreValide(p), p).toBe(true);
    }
    expect(plan.dossiers.some((p) => p.includes(`/${AUTRE}/`))).toBe(false);
  });

  it("les scènes en cache partent ; voisin, autre vidéo et fiches-scenes d'une autre vidéo restent", async () => {
    const part = [`studio/dev/scenes/${ID}/s1.mp4`, `studio/dev/scenes/${ID}/sous/s2.mp4`];
    const reste = [
      `studio/dev/scenes/${ID}0/leurre.mp4`, `studio/dev/scenes/${AUTRE}/autre.mp4`, `studio/prod/scenes/${AUTRE}/autre.mp4`,
      `studio/dev/fiches-scenes/${AUTRE}/b1.json`, "studio/dev/scenes/racine.mp4", "studio/dev/illustrations/pexels/0123456789abcdef01234567.mp4",
    ];
    for (const k of [...part, ...reste]) deposerObjetSimule(k);
    await videos.supprimerVideoDefinitivement(ID);
    const restants = objetsSimulesRestants();
    for (const k of part) expect(restants, k).not.toContain(k);
    for (const k of reste) expect(restants, k).toContain(k);
  });
});
