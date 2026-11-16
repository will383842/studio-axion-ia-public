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
const avec = (v: string | undefined) => (v === undefined ? base : { ...base, PARCOURS_ESSAI_COMPTES: v, PARCOURS_ESSAI_AUTEURS: "auteur-fictif-400" });
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
const pourEnvoi = (env: Env, compte?: string, reseau: "facebook" | "instagram" = "facebook", auteurEssaiOk = true) =>
  V.verifierMotPourEnvoi({ mot: MOT, reseau, codeCible: CODE_ESSAI, titre: TITRE_ESSAI, env, maintenantMs: ms(), ...(compte !== undefined ? { compte } : {}), ...(auteurEssaiOk ? { auteurEssaiOk: true } : {}) });

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
  it("Instagram : cible d'essai validable quand la liste n'est pas vide (T3a) ; liste vide : cible_test", async () => {
    expect((await valider(ENV_X, "instagram")).raison).toBe("valide");
    expect((await valider(avec(`${X},${IG}`), "instagram")).raison).toBe("valide");
    const i = (await apercu(avec(`${X},${IG}`))).find((r) => r.reseau === "instagram")!;
    expect(i).toMatchObject({ ok: true });
    expect((await valider(avec(undefined), "instagram")).raison).toBe("cible_test");
    const j = (await apercu(avec(undefined))).find((r) => r.reseau === "instagram")!;
    expect(j).toMatchObject({ ok: false, raison: "cible_test" });
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
  it("compte Instagram listé, cible d'essai, textes Instagram non validés : textes_non_valides_reseau (T3a)", async () => {
    const env = avec(`${X},${IG}`);
    expect(await activation(env, IG)).toBe("textes_non_valides_reseau");
    expect(await pourCompte(env, IG)).toBe("textes_non_valides_reseau");
  });
  it("compte Instagram listé, textes Instagram validés : activation permise (T3a)", async () => {
    const env = avec(`${X},${IG}`);
    expect((await valider(env, "instagram")).raison).toBe("valide");
    expect(await activation(env, IG)).toBeNull();
    expect(await pourCompte(env, IG)).toBeNull();
  });
  it("compte Instagram NON listé : instagram_pas_encore à l'activation, cible_test ailleurs (T3a)", async () => {
    expect(await activation(ENV_X, IG)).toBe("instagram_pas_encore");
    expect(await pourCompte(ENV_X, IG)).toBe("cible_test");
  });
  it("compte Instagram listé sans auteur listé : instagram_pas_encore à l'activation (T3a)", async () => {
    const env = { ...base, PARCOURS_ESSAI_COMPTES: `${X},${IG}` };
    expect(await activation(env, IG)).toBe("instagram_pas_encore");
  });
  it("cible vraie (non test) sur compte Instagram : instagram_pas_encore à l'activation (T3a)", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.test = false;
    expect(await activation(ENV_X, IG)).toBe("instagram_pas_encore");
    expect(await activation(avec(`${X},${IG}`), IG)).toBe("instagram_pas_encore");
  });
  it("compte Facebook LISTÉ mais aucun auteur listé, cible d'essai validée : cible_test (réserve #709)", async () => {
    const env = { ...base, PARCOURS_ESSAI_COMPTES: X };
    expect((await valider(env, "facebook")).raison).toBe("valide");
    expect(await pourCompte(env, X)).toBe("cible_test");
    expect(await activation(env, X)).toBe("cible_test");
  });
  it("activation Instagram, site injoignable : refus fermé instagram_pas_encore (T3a)", async () => {
    const env = avec(`${X},${IG}`);
    expect((await valider(env, "instagram")).raison).toBe("valide");
    site.etat.panne = true;
    CS.reinitialiserEtatCiblesSite();
    expect(await activation(env, IG)).toBe("instagram_pas_encore");
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
  it("auteur non revérifié par l'appelant (auteurEssaiOk absent) : validation_absente même pour le compte listé", async () => {
    expect(await pourEnvoi(ENV_X, X, "facebook", false)).toBe("validation_absente");
  });
  it("cible inactive : validation_absente même pour le compte listé", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.actif = false;
    expect(await pourEnvoi(ENV_X, X)).toBe("validation_absente");
  });
  it("titre changé (validation périmée) : validation_absente", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.titre = "Autre titre";
    expect(await pourEnvoi(ENV_X, X)).toBe("validation_absente");
  });
  it("Instagram, sans essaiSeulement : comme Facebook (le filtre « essai seulement » est à l'appelant)", async () => {
    const env = avec(`${X},${IG}`);
    expect((await valider(env, "instagram")).raison).toBe("valide");
    expect(await pourEnvoi(env, IG, "instagram")).toBeNull();
  });
  it("Instagram, essaiSeulement : cible d'essai + compte + auteur listés → peut partir ; vraie cible → instagram_pas_encore (T3a)", async () => {
    const env = avec(`${X},${IG}`);
    expect((await valider(env, "instagram")).raison).toBe("valide");
    const ei = (e: Env) => V.verifierMotPourEnvoi({ mot: MOT, reseau: "instagram", codeCible: CODE_ESSAI, titre: TITRE_ESSAI, env: e, maintenantMs: ms(), compte: IG, auteurEssaiOk: true, essaiSeulement: true });
    expect(await ei(env)).toBeNull();
    site.cibles.find((c) => c.code === CODE_ESSAI)!.test = false;
    expect((await valider(env, "instagram")).raison).toBe("valide");
    expect(await ei(env)).toBe("instagram_pas_encore");
  });
  it("une cible NON d'essai part toujours sans compte (inchangé)", async () => {
    site.cibles.find((c) => c.code === CODE_ESSAI)!.test = false;
    expect((await valider(ENV_X, "facebook")).raison).toBe("valide");
    expect(await pourEnvoi(ENV_X)).toBeNull();
    expect(await pourEnvoi(avec(undefined))).toBeNull();
  });
});
