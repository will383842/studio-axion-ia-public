/**
 * G13-12 (W-N, 16/11) : les scènes en cache de la vidéo partent avec elle (`studio/<env>/scenes/<vidéo>/`), SEULEMENT quand
 * l'appelant allume `{ scenes: true }` (décision de Williams 17/11 : rien d'automatique, la corbeille ne touche à rien).
 * Éteint par défaut = identique à master ; la purge automatique des 30 jours n'efface jamais les scènes.
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
    const p = prefixesDeVideo("prod", ID, { scenes: true });
    expect(p).toHaveLength(6);
    expect(p[5]).toBe("studio/prod/scenes/v-01/");
    expect(p).toEqual(["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes", "scenes"].map((d) => `studio/prod/${d}/v-01/`));
  });

  it("jamais un préfixe d'une autre vidéo, ni sans identifiant : tout part de l'id donné, et un id hors convention lève", () => {
    for (const env of ["prod", "dev"] as const) {
      for (const p of prefixesDeVideo(env, ID, { scenes: true })) {
        expect(p.endsWith(`/${ID}/`), p).toBe(true);
        expect(p.includes(AUTRE), p).toBe(false);
        expect(p.includes(`${ID}0`), p).toBe(false);
        expect(dossierPropreValide(p), p).toBe(true);
      }
    }
    for (const id of ["", "..", ".", "v/01", "v-01/../v-03", "v 01", "/", "v-01/"]) { expect(() => prefixesDeVideo("prod", id), id).toThrow(); expect(() => prefixesDeVideo("prod", id, { scenes: true }), id).toThrow(); }
  });
});

describe("réglage éteint par défaut : seul `true` strict allume", () => {
  const MASTER = ["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes"];
  it("éteint = comportement identique à master (égalité profonde)", () => {
    const attendu = MASTER.map((d) => `studio/prod/${d}/v-01/`);
    expect(prefixesDeVideo("prod", ID)).toEqual(attendu);
    expect(prefixesDeVideo("prod", ID, {})).toEqual(attendu);
    expect(prefixesDeVideo("prod", ID, undefined)).toEqual(attendu);
    for (const v of [false, undefined, null, 0, 1, "true", "1", "oui", {}, [], [true]]) expect(prefixesDeVideo("prod", ID, { scenes: v }), String(v)).toEqual(attendu);
    expect(prefixesDeVideo("dev", ID)).toEqual(MASTER.map((d) => `studio/dev/${d}/v-01/`));
    // la clé citée d'une scène n'est pas à la vidéo tant que le réglage est éteint (comme master) ; allumée, elle l'est
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-01")).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-01", { scenes: "true" })).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-01", { scenes: true })).toBe(true);
    for (const d of MASTER) expect(cleDeCetteVideo(`studio/prod/${d}/v-01/x`, "v-01"), d).toBe(true);
  });
  it("seul `true` exact allume : 6 préfixes, scenes en dernier", () => {
    expect(prefixesDeVideo("dev", ID, { scenes: true })).toEqual([...MASTER, "scenes"].map((d) => `studio/dev/${d}/v-01/`));
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
    const on = { scenes: true };
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-01", on)).toBe(true);
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/s1.mp4", "v-012", on)).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-012/s1.mp4", "v-01", on)).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-03/s1.mp4", "v-01", on)).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/v-01/../v-03/s1.mp4", "v-01", on)).toBe(false);
    expect(cleDeCetteVideo("studio/prod/scenes/", "v-01", on)).toBe(false);
  });
  it("cleProtegee inchangée", () => {
    for (const d of ["illustrations", "elements", "decors", "public", "site"]) expect(cleProtegee(`studio/prod/${d}/x/y.png`), d).toBe(true);
    for (const d of ["scenes", "fiches-scenes", "videos"]) expect(cleProtegee(`studio/prod/${d}/v-01/y.png`), d).toBe(false);
  });
});

describe("suppression définitive d'une vidéo (réglage éteint : les scènes restent)", () => {
  it("le plan liste les 5 dossiers de master, jamais scenes, jamais une autre vidéo", async () => {
    const plan = await suppression.planifierSuppression((await depots().videos.obtenir(ID))!);
    expect(plan.dossiers).toEqual(["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes"].map((d) => `studio/dev/${d}/${ID}/`));
    expect(plan.dossiers.some((p) => p.includes(`/${AUTRE}/`))).toBe(false);
  });

  it("la suppression définitive laisse les scènes (non branchée) ; le reste de la vidéo part ; voisin et autre vidéo restent", async () => {
    const scenes = [`studio/dev/scenes/${ID}/s1.mp4`, `studio/dev/scenes/${ID}/sous/s2.mp4`];
    const part = [`studio/dev/fiches-scenes/${ID}/b1.json`];
    const reste = [
      `studio/dev/scenes/${ID}0/leurre.mp4`, `studio/dev/scenes/${AUTRE}/autre.mp4`, `studio/prod/scenes/${AUTRE}/autre.mp4`,
      `studio/dev/fiches-scenes/${AUTRE}/b1.json`, "studio/dev/scenes/racine.mp4", "studio/dev/illustrations/pexels/0123456789abcdef01234567.mp4",
    ];
    for (const k of [...scenes, ...part, ...reste]) deposerObjetSimule(k);
    await videos.supprimerVideoDefinitivement(ID);
    const restants = objetsSimulesRestants();
    for (const k of part) expect(restants, k).not.toContain(k);
    for (const k of [...scenes, ...reste]) expect(restants, k).toContain(k);
  });
});

describe("corbeille : les scènes ne sont jamais touchées", () => {
  const JOUR = 86_400_000;
  const SCENES = [`studio/dev/scenes/${ID}/s1.mp4`, `studio/dev/scenes/${ID}/sous/s2.mp4`];

  it("mise à la corbeille réelle puis restauration : scènes intactes", async () => {
    const corbeille = await import("@/services/corbeille");
    for (const k of SCENES) deposerObjetSimule(k);
    const avant = [...objetsSimulesRestants()].sort();
    await corbeille.mettreALaCorbeille([ID]);
    expect(objetsSimulesRestants()).toEqual(expect.arrayContaining(SCENES));
    expect([...objetsSimulesRestants()].sort()).toEqual(avant);
    await corbeille.restaurerDeLaCorbeille([ID]);
    expect([...objetsSimulesRestants()].sort()).toEqual(avant);
    expect((await depots().videos.obtenir(ID))?.statut).not.toBe("archivee");
  });

  it("purgerCorbeille avant ET après 30 jours : scènes intactes (la vidéo, elle, est bien purgée à l'échéance)", async () => {
    const corbeille = await import("@/services/corbeille");
    vi.useFakeTimers({ toFake: ["Date"] });
    const t0 = Date.now();
    try {
      for (const k of SCENES) deposerObjetSimule(k);
      await corbeille.mettreALaCorbeille([ID]);
      vi.setSystemTime(t0 + 29 * JOUR);
      const avant = await corbeille.purgerCorbeille();
      expect(avant.supprimees).toBe(0);
      expect(objetsSimulesRestants()).toEqual(expect.arrayContaining(SCENES));
      vi.setSystemTime(t0 + 31 * JOUR);
      const apres = await corbeille.purgerCorbeille();
      expect(apres.supprimees).toBe(1);
      expect(await depots().videos.obtenir(ID)).toBeNull();
      expect(objetsSimulesRestants()).toEqual(expect.arrayContaining(SCENES));
    } finally {
      vi.useRealTimers();
    }
  });
});
