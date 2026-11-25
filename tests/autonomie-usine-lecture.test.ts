/**
 * Lecture de l'autonomie de l'Usine par la porte (POST /api/usine/reglages/autonomie) et bouton d'urgence « Éteindre » du Studio
 * (`eteindreDepuisStudio`). La lecture n'écrit rien ; l'extinction n'écrit jamais l'état allumé. Dépôts en mémoire, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ refresh() {} }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const A = await import("@/services/autonomie-usine");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moisParis } = await import("@/services/couts");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { POST } = await import("@/app/api/usine/reglages/autonomie/route");
const { eteindreAutonomieUsineAction } = await import("@/app/(studio)/reglages/actions-autonomie-usine");
const { AutonomieUsine } = await import("@/components/reglages/AutonomieUsine");
const { conditionsTirage } = await import("@/services/tutoriel-reserve-tirage");
const { ajouterElementReserve, lireElementReserve } = await import("@/services/tutoriel-reserve");
const { REGLAGES_RESERVE_DEFAUT } = await import("@/domaine/tutoriel-reserve");

const MDP = "aut-lecture-essai";
const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const URL_LECTURE = "http://studio.test/api/usine/reglages/autonomie";
const CLE_ANCIENNE = "usine.autonomie";
const CLE_PORTE = "usine.autonomie.porte";
const RACINE = process.cwd();
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function appel(corps: unknown, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest(URL_LECTURE, { method: "POST", headers: h, body: JSON.stringify(corps) });
}
const brut = (cle: string) => lireParametre<unknown>(cle, null).then((v) => JSON.stringify(v));
const budget = async () => (await depots().evenements.lister()).filter((e) => e.type === "budget");
const cloches = async () => (await depots().notifications.lister()).length;

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = btoa(e);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserGardePourEssai();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  await auth.seConnecter(MDP, false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("1 · la porte de lecture", () => {
  it("sans jeton : refusée (401), rien n'est lu ni écrit", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const r = await POST(appel({ contrat: 2 }, null));
    expect(r.status).toBe(401);
    expect(await r.text()).not.toContain("plafond_automatique_cents");
  });

  it("avec jeton : les 5 champs ; aucun paramètre réglé, aucune cloche, aucune ligne « budget » ; seule la ligne « porte » de la garde est écrite", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const avant = await brut(CLE_PORTE);
    const ecritures = vi.spyOn(depots().parametres, "enregistrer");
    const cloches0 = await cloches();
    const r = await POST(appel({ contrat: 2 }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ automatique: true, plafond_automatique_cents: 2000, utilise_automatique_cents: 0, mois: moisParis(new Date().toISOString()), pilote: "usine" });
    expect(ecritures).not.toHaveBeenCalled();
    expect(await brut(CLE_PORTE)).toBe(avant);
    expect(await cloches()).toBe(cloches0);
    expect(await budget()).toEqual([]);
    // Vérité sur le journal : la garde de la porte écrit UNE ligne « porte » (route, issue, durée) à chaque appel, lecture comprise.
    const lignes = (await depots().evenements.lister()).filter((e) => e.type === "porte");
    expect(lignes).toHaveLength(1);
    expect(lignes[0].message).toMatch(/POST \/api\/usine\/reglages\/autonomie acceptée/);
  });

  it("lecture de la clé porte en échec : 500, jamais « éteint, 0 »", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const obtenir = depots().parametres.obtenir.bind(depots().parametres);
    vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === CLE_PORTE) throw new Error("base indisponible");
      return obtenir(id);
    });
    const r = await POST(appel({ contrat: 2 }));
    expect(r.status).toBe(500);
    const t = await r.text();
    expect(t).toContain("erreur_interne");
    expect(t).not.toContain("plafond_automatique_cents");
  });

  it("lecture de l'ancienne clé en échec (pas de clé porte) : 500 aussi", async () => {
    const obtenir = depots().parametres.obtenir.bind(depots().parametres);
    vi.spyOn(depots().parametres, "obtenir").mockImplementation(async (id: string) => {
      if (id === CLE_ANCIENNE) throw new Error("base indisponible");
      return obtenir(id);
    });
    expect((await POST(appel({ contrat: 2 }))).status).toBe(500);
  });

  it("rend le plafond même éteinte ; l'ancienne clé seule : pilote studio ; aucune clé : pilote aucun", async () => {
    await ecrireParametre(CLE_PORTE, { actif: false, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    expect(await (await POST(appel({ contrat: 2 }))).json()).toMatchObject({ automatique: false, plafond_automatique_cents: 2000, pilote: "usine" });
    reinitialiserDepots();
    expect(await (await POST(appel({ contrat: 2 }))).json()).toMatchObject({ automatique: false, plafond_automatique_cents: 0, pilote: "aucun" });
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 1234, le: "2026-11-01T00:00:00.000Z", version: 1 });
    expect(await (await POST(appel({ contrat: 2 }))).json()).toMatchObject({ automatique: true, plafond_automatique_cents: 1234, pilote: "studio" });
  });

  it("un champ inconnu est refusé (400)", async () => {
    expect((await POST(appel({ contrat: 2, automatique: true }))).status).toBe(400);
  });
});

describe("2 · eteindreDepuisStudio", () => {
  it("sans clé porte : rien n'est écrit (ni l'ancienne clé, ni cloche, ni journal)", async () => {
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 1234, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const avant = await brut(CLE_ANCIENNE);
    const ecritures = vi.spyOn(depots().parametres, "enregistrer");
    expect(await A.eteindreDepuisStudio()).toEqual({ eteinte: false, deja: false });
    expect(ecritures).not.toHaveBeenCalled();
    expect(await brut(CLE_ANCIENNE)).toBe(avant);
    expect(await budget()).toEqual([]);
  });

  it("avec la clé porte allumée : écrit actif:false et garde le plafond ; cloche et journal ; l'ancienne clé intacte", async () => {
    await ecrireParametre(CLE_ANCIENNE, { actif: true, plafondCents: 1234, le: "2026-11-01T00:00:00.000Z", version: 1 });
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const ancienne = await brut(CLE_ANCIENNE);
    const cloches0 = await cloches();
    expect(await A.eteindreDepuisStudio()).toEqual({ eteinte: true, deja: false });
    expect(await lireParametre(CLE_PORTE, null)).toMatchObject({ actif: false, plafondCents: 2000, version: 1 });
    expect(await A.lireAutonomieUsine()).toEqual({ etat: "confirmation", raison: "eteint" });
    expect(await brut(CLE_ANCIENNE)).toBe(ancienne);
    expect(await cloches()).toBe(cloches0 + 1);
    expect((await budget()).map((e) => e.message).join(" ")).toMatch(/éteinte depuis le Studio/);
  });

  it("écriture en échec : erreur, et aucune cloche ni ligne « budget » n'annonce une extinction qui n'a pas eu lieu", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const avant = await brut(CLE_PORTE);
    const cloches0 = await cloches();
    vi.spyOn(depots().parametres, "enregistrer").mockRejectedValue(new Error("écriture refusée"));
    await expect(A.eteindreDepuisStudio()).rejects.toThrow();
    vi.restoreAllMocks();
    expect(await brut(CLE_PORTE)).toBe(avant);
    expect(await cloches()).toBe(cloches0);
    expect(await budget()).toEqual([]);
  });

  it("déjà éteinte : rien n'est écrit, ni cloche ni journal", async () => {
    await ecrireParametre(CLE_PORTE, { actif: false, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const ecritures = vi.spyOn(depots().parametres, "enregistrer");
    const cloches0 = await cloches();
    expect(await A.eteindreDepuisStudio()).toEqual({ eteinte: true, deja: true });
    expect(ecritures).not.toHaveBeenCalled();
    expect(await cloches()).toBe(cloches0);
  });

  it("sans session : refusé, rien n'est écrit", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    const avant = await brut(CLE_PORTE);
    reinitialiserRequete();
    await expect(A.eteindreDepuisStudio()).rejects.toBeDefined();
    expect(await brut(CLE_PORTE)).toBe(avant);
  });

  it("l'action serveur éteint et ne rallume jamais", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 2000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    expect((await eteindreAutonomieUsineAction()).ok).toBe(true);
    expect(await lireParametre(CLE_PORTE, null)).toMatchObject({ actif: false, plafondCents: 2000 });
  });
});

describe("3 · garde statique : jamais allumer", () => {
  it("eteindreDepuisStudio ne contient aucun `actif: true`", () => {
    const t = sansCommentaires(readFileSync(join(RACINE, "src/services/autonomie-usine.ts"), "utf8"));
    const debut = t.indexOf("export async function eteindreDepuisStudio");
    expect(debut).toBeGreaterThan(-1);
    const corps = t.slice(debut, t.indexOf("\nexport ", debut + 10));
    expect(corps).toMatch(/exigerSession\(\)/);
    expect(corps).toMatch(/actif: false/);
    expect(corps).not.toMatch(/actif\s*:\s*(?:true|[^f\s])/);
    expect(corps).not.toMatch(/ecrireParametre\(CLE_REGLAGE/);
  });

  it("l'action et la route de lecture n'écrivent aucun réglage", () => {
    const route = sansCommentaires(readFileSync(join(RACINE, "src/app/api/usine/reglages/autonomie/route.ts"), "utf8"));
    expect(route).not.toMatch(/ecrireParametre|enregistrer|journaliser|creerNotification|eteindreDepuisStudio|reglerAutonomieUsine|recevoirAutonomieUsine|export (async )?function (PUT|PATCH|DELETE|GET)/);
    const action = sansCommentaires(readFileSync(join(RACINE, "src/app/(studio)/reglages/actions-autonomie-usine.ts"), "utf8"));
    const debut = action.indexOf("export async function eteindreAutonomieUsineAction");
    expect(action.slice(debut)).not.toMatch(/reglerAutonomieUsine|true/);
  });
});

describe("4 · l'écran", () => {
  const vue = (o: object = {}) => ({ actif: true, plafondCents: 2000, utiliseCents: 500, pourcentage: 25, mois: "2026-11", ...o });
  const rendu = (v: object) => renderToStaticMarkup(createElement(AutonomieUsine, { vue: v as never }));

  it("pilote « usine » : « Se règle dans l'Usine », l'utilisé du mois, un seul bouton Éteindre, ni champ ni interrupteur", () => {
    const html = rendu(vue({ pilote: "usine" }));
    expect(html).toContain("Se règle dans l&#x27;Usine");
    expect(html).toMatch(/Utilisé ce mois-ci/);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("Éteindre");
    expect(html).not.toMatch(/<input|role="switch"|Enregistrer/);
  });

  it("pilote « usine » éteinte : pas de bouton", () => {
    expect(rendu(vue({ pilote: "usine", actif: false }))).not.toContain("<button");
  });

  it("autres pilotes : l'écran est identique à celui d'avant (sans pilote = studio = aucun)", () => {
    const sans = rendu(vue());
    expect(rendu(vue({ pilote: "studio" }))).toBe(sans);
    expect(rendu(vue({ pilote: "aucun" }))).toBe(sans);
    expect(sans).toContain("Enregistrer");
    expect(sans).not.toContain("Se règle dans");
  });
});

describe("5 · la réserve de tutoriels suit la clé porte", () => {
  const reglages = { ...REGLAGES_RESERVE_DEFAUT, actif: true };
  const dep = {
    maintenant: () => "2026-11-21T10:00:00.000Z",
    interrupteurs: async () => ({ formulaire: true, dossier: true, phrase: true }),
    interrupteur: async () => true,
    equipe: async () => true,
    tauxUsdEur: async () => 0.9,
    plafondVideoUsd: async () => 1,
    plafondMoisAtteint: async () => false,
  };
  async function element() {
    await ajouterElementReserve({ id: "res-lecture1", titre: "res-lecture1", source: { type: "idee", phrase: "Un tableau de bord pour un atelier" }, fin: "aucune", ajouteLe: "2026-11-01T00:00:00.000Z", ajoutePar: "fondateur" });
    const e = await lireElementReserve("res-lecture1");
    if (!e) throw new Error("élément absent");
    return e;
  }

  it("clé porte allumée : la réserve obtient l'accord", async () => {
    await ecrireParametre(CLE_PORTE, { actif: true, plafondCents: 100_000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    expect(await conditionsTirage(await element(), reglages, dep)).toBeNull();
  });

  it("clé porte éteinte : refus autonomie_usine", async () => {
    await ecrireParametre(CLE_PORTE, { actif: false, plafondCents: 100_000, le: "2026-11-01T00:00:00.000Z", version: 1 });
    expect(await conditionsTirage(await element(), reglages, dep)).toMatchObject({ raison: "autonomie_usine" });
  });
});
