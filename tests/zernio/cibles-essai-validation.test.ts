/**
 * Cibles d'essai · S1 à S4 : validation et garde d'envoi/d'activation d'un mot lié à une cible d'essai (test).
 * Faux site, dépôts en mémoire, aucun réseau, identifiants factices. Variable PARCOURS_ESSAI_COMPTES absente ou vide : refus comme avant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV_SITE_FICTIF, siteCiblesFactice } from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const CS = await import("@/services/cibles-site");
const V = await import("@/services/mots-validation-par-mot");
const commun = await import("@/services/_commun");

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 14, 10, 0, 0);
const base = { ...ENV_SITE_FICTIF, PARCOURS_CONVERSATION_TITRE_GUIDE: "Titre serveur fictif" } as Record<string, string>;
const X = "compte-fb-essai-x";
const Y = "compte-fb-autre-y";
const IG = "compte-ig-essai";
const avec = (v: string | undefined) => (v === undefined ? base : { ...base, PARCOURS_ESSAI_COMPTES: v });
const ENV_X = avec(X);
const MOT = "ESSAICONV";
const CODE_ESSAI = "gde-essai05";
const TITRE_ESSAI = "Guide d'essai fictif";

let site: ReturnType<typeof siteCiblesFactice>;
let n = 0;
const ms = () => T0 + ++n * 20 * MIN;
type Env = Record<string, string>;

const apercu = (env: Env, mot = MOT) => V.apercuTextesMot({ mot, env, maintenantMs: ms() });
const valider = async (env: Env, reseau: "facebook" | "instagram", mot = MOT) => {
  const a = (await apercu(env, mot)).find((x) => x.reseau === reseau)!;
  const vue = a.ok ? a.empreinte : "x";
  return V.validerTextesMot({ mot, reseau, empreinteVue: vue, confirmeParOperateur: true, env, maintenantMs: ms() });
};
const pourCompte = (env: Env, compte: string, mot = MOT) => V.verifierMotPourCompte({ mot, compte, env, maintenantMs: ms() });
const activation = (env: Env, compte: string) => V.verifierActivationMot({ mot: MOT, compte, env, maintenantMs: ms() });
const pourEnvoi = (env: Env, compte?: string, reseau: "facebook" | "instagram" = "facebook") =>
  V.verifierMotPourEnvoi({ mot: MOT, reseau, codeCible: CODE_ESSAI, titre: TITRE_ESSAI, env, maintenantMs: ms(), ...(compte !== undefined ? { compte } : {}) });

beforeEach(async () => {
  reinitialiserDepots();
  CS.reinitialiserEtatCiblesSite();
  n = 0;
  site = siteCiblesFactice();
  site.cibles.push({ code: CODE_ESSAI, type: "guide", titre: TITRE_ESSAI, actif: true, test: true });
  site.liaisons.length = 0;
  site.liaisons.push({ mot: "essaiconv", reseau: "tous", codeCible: CODE_ESSAI, actif: true });
  pm.injecterTransportSite(site.transport);
  await commun.ecrireParametre("zernio.comptes", {
    lusLe: "2026-11-14T10:00:00.000Z",
    comptes: [
      { id: X, reseau: "facebook", nom: "Compte Facebook X fictif" },
      { id: Y, reseau: "facebook", nom: "Compte Facebook Y fictif" },
      { id: IG, reseau: "instagram", nom: "Compte Instagram fictif" },
    ],
  });
});
afterEach(() => pm.injecterTransportSite(null));

describe("S1 · variable absente, vide ou mal formée : les gardes refusent comme aujourd'hui", () => {
  it.each([["absente", undefined], ["vide", ""], ["étoile", "*"], ["mal formée", "a b;c"]])("%s", async (_n, v) => {
    const env = avec(v);
    const f = (await apercu(env)).find((r) => r.reseau === "facebook")!;
    expect(f).toMatchObject({ ok: false, raison: "cible_test" });
    expect((await valider(env, "facebook")).raison).toBe("cible_test");
    expect(await pourCompte(env, X)).toBe("cible_test");
    expect(await activation(env, X)).toBe("cible_test");
    expect(await pourEnvoi(env, X)).toBe("validation_absente");
    expect(await pourEnvoi(env)).toBe("validation_absente");
  });
});

describe("S4 · validerTextesMot / aperçu", () => {
  it("Facebook : accepté quand la liste n'est pas vide (même pour un compte non listé : la validation est par mot et réseau)", async () => {
    const a = (await apercu(ENV_X)).find((r) => r.reseau === "facebook")!;
    expect(a).toMatchObject({ ok: true });
    expect((await valider(ENV_X, "facebook")).raison).toBe("valide");
  });
  it("Instagram : toujours cible_test", async () => {
    expect((await valider(ENV_X, "instagram")).raison).toBe("cible_test");
    expect((await valider(avec(`${X},${IG}`), "instagram")).raison).toBe("cible_test");
    const i = (await apercu(avec(`${X},${IG}`))).find((r) => r.reseau === "instagram")!;
    expect(i).toMatchObject({ ok: false, raison: "cible_test" });
  });
  it("une cible d'essai de type adresse reste refusée", async () => {
    site.cibles.push({ code: "adr-essai0000009", type: "adresse", titre: "Page", actif: true, test: true, url: "https://exemple.test/p" });
    site.liaisons.push({ mot: "essaipage", reseau: "tous", codeCible: "adr-essai0000009", actif: true });
    expect((await valider(ENV_X, "facebook", "ESSAIPAGE")).raison).toBe("adresse_pas_encore");
  });
});

describe("S2 · verifierMotPourCompte / activation", () => {
  beforeEach(async () => {
    expect((await valider(ENV_X, "facebook")).raison).toBe("valide");
  });
  it("compte listé sur Facebook : permis", async () => {
    expect(await pourCompte(ENV_X, X)).toBeNull();
    expect(await activation(ENV_X, X)).toBeNull();
  });
  it("autre compte Facebook : cible_test", async () => {
    expect(await pourCompte(ENV_X, Y)).toBe("cible_test");
    expect(await activation(ENV_X, Y)).toBe("cible_test");
  });
  it("compte listé mais Instagram : instagram_pas_encore à l'activation, cible_test ailleurs", async () => {
    const env = avec(`${X},${IG}`);
    expect(await activation(env, IG)).toBe("instagram_pas_encore");
    expect(await pourCompte(env, IG)).toBe("cible_test");
  });
  it("compte inconnu : refus", async () => {
    expect(await pourCompte(avec("compte-absent-zzz"), "compte-absent-zzz")).toBe("reseau_du_compte_inconnu");
  });
  it("variable vidée après la validation : refus immédiat", async () => {
    expect(await pourCompte(avec(""), X)).toBe("cible_test");
  });
});

describe("S3 · verifierMotPourEnvoi", () => {
  beforeEach(async () => {
    expect((await valider(ENV_X, "facebook")).raison).toBe("valide");
  });
  it("sans compte : validation_absente comme aujourd'hui", async () => {
    expect(await pourEnvoi(ENV_X)).toBe("validation_absente");
  });
  it("compte listé : peut partir", async () => {
    expect(await pourEnvoi(ENV_X, X)).toBeNull();
  });
  it("autre compte : validation_absente", async () => {
    expect(await pourEnvoi(ENV_X, Y)).toBe("validation_absente");
  });
  it("cible inactive : validation_absente même pour le compte listé", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.actif = false;
    expect(await pourEnvoi(ENV_X, X)).toBe("validation_absente");
  });
  it("titre changé (validation périmée) : validation_absente", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.titre = "Autre titre";
    expect(await pourEnvoi(ENV_X, X)).toBe("validation_absente");
  });
  it("Instagram : jamais, même compte listé", async () => {
    expect(await pourEnvoi(avec(`${X},${IG}`), IG, "instagram")).toBe("validation_absente");
  });
  it("une cible NON d'essai part toujours sans compte (inchangé)", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.test = false;
    expect((await valider(ENV_X, "facebook")).raison).toBe("valide");
    expect(await pourEnvoi(ENV_X)).toBeNull();
    expect(await pourEnvoi(avec(undefined))).toBeNull();
  });
});
