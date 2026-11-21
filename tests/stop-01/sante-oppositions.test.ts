/**
 * STOP-01 · visibilité : ligne « oppositions » de /api/sante (informative, sans nombre) et cloche horaire « éteint alors que le parcours envoie ».
 * Données fictives ; aucun réseau, aucun envoi. Rouges d'abord : D2, D4, D5, R1, R7, R8 de la conception du 18/11/2026.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const OPP = await import("@/services/oppositions-mots");
const Com = await import("@/services/_commun");
const SO = await import("@/services/sante-oppositions");
const { etatSante } = await import("@/services/sante");
const { GET } = await import("@/app/api/sante/route");
const NOTIF = await import("@/services/notifications");

const T0 = Date.parse("2026-11-18T10:00:00.000Z");
const MIN = 60_000;
const ETEINT_PARCOURS_ALLUME = { PARCOURS_CONVERSATION_ENABLED: "1" };
const TITRE = "Refus du site non consultés";
const nettoyer = () => {
  OPP.reinitialiserDemandesSite();
  SO.reinitialiserSanteOppositions();
};
const cloches = async () => (await depots().notifications.lister((n: any) => n.titre === TITRE)) as any[];
const sondeRapide = async () => ({ etat: "ok" as const });

beforeEach(() => {
  reinitialiserDepots();
  nettoyer();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  nettoyer();
});

const etat = (o: Partial<ReturnType<typeof OPP.etatVerificationSite>> = {}) => ({ ...OPP.etatVerificationSite(), ...o });

describe("D5 santeOppositions : fonction pure, cinq états", () => {
  it("éteint → eteint (quel que soit le reste) ; allumé → jamais-verifie, ok, en-echec", () => {
    for (const v of [undefined, "", "0", "false", "non"]) {
      const env = v === undefined ? {} : { OPPOSITIONS_SITE_IMPORT_ENABLED: v };
      expect(SO.santeOppositions(env, etat({ derniereIssue: "ok" }))).toBe("eteint");
    }
    const on = { OPPOSITIONS_SITE_IMPORT_ENABLED: "1" };
    expect(SO.santeOppositions(on, etat())).toBe("jamais-verifie");
    expect(SO.santeOppositions(on, etat({ derniereIssue: "ok" }))).toBe("ok");
    expect(SO.santeOppositions(on, etat({ derniereIssue: "echec" }))).toBe("en-echec");
    expect(SO.santeOppositions(on, etat({ derniereIssue: "non-relie" }))).toBe("en-echec");
  });
  it("réserve B : « ok » qui vieillit devient « ancien » au-delà de 30 min sans passage ; l'échec reste « en-echec » ; horloge qui recule : « ok »", () => {
    const on = { OPPOSITIONS_SITE_IMPORT_ENABLED: "1" };
    const ok = etat({ derniereIssue: "ok", derniereIssueMs: T0 });
    expect(SO.santeOppositions(on, ok, T0 + 30 * MIN)).toBe("ok");
    expect(SO.santeOppositions(on, ok, T0 + 30 * MIN + 1)).toBe("ancien");
    expect(SO.santeOppositions(on, ok, T0 - 5 * MIN)).toBe("ok");
    expect(SO.santeOppositions(on, etat({ derniereIssue: "echec", derniereIssueMs: T0 }), T0 + 5 * 60 * MIN)).toBe("en-echec");
    expect(SO.santeOppositions({}, ok, T0 + 5 * 60 * MIN)).toBe("eteint");
  });
  it("réserve B dans /api/sante : « ancien » sans effet sur ok, statut 200, aucun nombre", async () => {
    vi.stubEnv("OPPOSITIONS_SITE_IMPORT_ENABLED", "1");
    OPP.noterIssueVerificationSite("ok", Date.now() - 31 * MIN);
    const e = await etatSante(3000, { sonde: sondeRapide });
    expect(e.oppositions).toBe("ancien");
    expect(e.ok).toBe(true);
    expect((await GET()).status).toBe(200);
  });
  it("ne dépend pas de l'interrupteur du parcours", () => {
    expect(SO.santeOppositions({ PARCOURS_CONVERSATION_ENABLED: "1" }, etat())).toBe("eteint");
  });
});

describe("D5 /api/sante : ligne informative", () => {
  it("la ligne existe, éteint par défaut ; « en-echec » garde ok:true et le statut 200", async () => {
    const e = await etatSante(3000, { sonde: sondeRapide });
    expect(e.oppositions).toBe("eteint");
    expect(e.ok).toBe(true);
    vi.stubEnv("OPPOSITIONS_SITE_IMPORT_ENABLED", "1");
    OPP.noterIssueVerificationSite("echec", T0);
    const e2 = await etatSante(3000, { sonde: sondeRapide });
    expect(e2.oppositions).toBe("en-echec");
    expect(e2.ok).toBe(true);
    const r = await GET();
    expect(r.status).toBe(200);
  });
  it("lecture des compteurs qui lève → « inconnu », ok inchangé", async () => {
    vi.spyOn(OPP, "etatVerificationSite").mockImplementation(() => {
      throw new Error("x");
    });
    const e = await etatSante(3000, { sonde: sondeRapide });
    expect(e.oppositions).toBe("inconnu");
    expect(e.ok).toBe(true);
  });
  it("le JSON public ne contient que l'état court : aucun c1_, p1., @, ni nombre lié aux oppositions", async () => {
    vi.stubEnv("OPPOSITIONS_SITE_IMPORT_ENABLED", "1");
    OPP.demanderVerificationSite(["c1_0000000000000000000001", "c1_0000000000000000000002"]);
    OPP.noterIssueVerificationSite("echec", T0);
    OPP.noterIssueVerificationSite("echec", T0 + 1);
    const corps = (await (await GET()).json()) as Record<string, unknown>;
    expect(["eteint", "jamais-verifie", "ok", "ancien", "en-echec", "inconnu"]).toContain(corps.oppositions);
    expect(JSON.stringify(corps)).not.toMatch(/c1_|p1\.|@/);
    for (const [k, v] of Object.entries(corps)) if (/opposition/i.test(k)) expect(typeof v).toBe("string");
    expect(Object.keys(corps).filter((k) => /demande|echec|refus|compteur/i.test(k) && !/travaux|plusVieux/i.test(k))).toEqual([]);
  });
});

describe("R8 / réserve C cloche : import éteint ET parcours allumé, une par 24 heures, créneau durable", () => {
  it("1 cloche, puis 0 à +59 min et +60 min, 0 à +23 h 59, puis 1 à +24 h ; un redémarrage simulé à +10 min n'en ajoute pas", async () => {
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 });
    expect(await cloches()).toHaveLength(1);
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 + 59 * MIN });
    expect(await cloches()).toHaveLength(1);
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 + 60 * MIN });
    expect(await cloches()).toHaveLength(1);
    SO.reinitialiserSanteOppositions(); // redémarrage : la mémoire de processus est perdue, le créneau durable reste
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 + 70 * MIN });
    expect(await cloches()).toHaveLength(1);
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 + 24 * 60 * MIN - 1 });
    expect(await cloches()).toHaveLength(1);
    SO.reinitialiserSanteOppositions(); // sans le plafond d'une minute du passage précédent : seul le créneau de 24 h décide
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 + 24 * 60 * MIN });
    expect(await cloches()).toHaveLength(2);
    const p = await Com.lireParametre<any>(SO.PARAM_SANTE_OPPOSITIONS, null);
    expect(p).toMatchObject({ v: 1, alerteEteintLe: T0 + 24 * 60 * MIN });
  });
  it("au plus un passage par minute (mémoire de processus)", async () => {
    const lire = vi.spyOn(depots().parametres, "obtenir");
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 });
    const n = lire.mock.calls.length;
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 + 30_000 });
    expect(lire.mock.calls.length).toBe(n);
    expect(SO.INTERVALLE_SURVEILLANCE_MS).toBe(60_000);
    expect(SO.INTERVALLE_ALERTE_SANTE_OPPOSITIONS_MS).toBe(24 * 60 * MIN);
  });
  it("la notification n'est jamais créée sous le verrou ; jamais de push ; message sans nom ni identifiant", async () => {
    let verrou = "";
    const reel = NOTIF.creerNotification;
    vi.spyOn(NOTIF, "creerNotification").mockImplementation(async (...a: Parameters<typeof reel>) => {
      verrou = await Promise.race([Com.sousVerrou(async () => "libre"), new Promise<string>((r) => setTimeout(() => r("pris"), 40))]);
      return reel(...a);
    });
    await SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 });
    expect(verrou).toBe("libre");
    const [n] = await cloches();
    expect(n.envoi).toBeUndefined();
    expect(`${n.titre} ${n.message}`).not.toMatch(/c1_|p1\.|@|\d/);
  });
});

describe("D4 / R1 aucune autre cloche, aucune écriture hors du cas visé", () => {
  it.each([
    ["tout éteint", {}],
    ["parcours éteint, import éteint", { PARCOURS_CONVERSATION_ENABLED: "0" }],
    ["import allumé, parcours allumé", { OPPOSITIONS_SITE_IMPORT_ENABLED: "1", PARCOURS_CONVERSATION_ENABLED: "1" }],
    ["import allumé, parcours éteint", { OPPOSITIONS_SITE_IMPORT_ENABLED: "1" }],
  ])("%s : ni lecture ni écriture, 0 cloche", async (_n, env) => {
    const lire = vi.spyOn(depots().parametres, "obtenir");
    const ecrire = vi.spyOn(Com, "ecrireParametre");
    OPP.noterIssueVerificationSite("echec", T0);
    await SO.surveillerOppositions({ env, maintenantMs: T0 });
    await SO.surveillerOppositions({ env, maintenantMs: T0 + 2 * 60 * MIN });
    expect(await cloches()).toHaveLength(0);
    expect(lire.mock.calls.filter((c) => c[0] === SO.PARAM_SANTE_OPPOSITIONS)).toHaveLength(0);
    expect(ecrire.mock.calls.filter((c) => c[0] === SO.PARAM_SANTE_OPPOSITIONS)).toHaveLength(0);
  });
  it("une erreur de lecture ou d'écriture est avalée", async () => {
    vi.spyOn(Com, "lireParametre").mockRejectedValue(new Error("base"));
    await expect(SO.surveillerOppositions({ env: ETEINT_PARCOURS_ALLUME, maintenantMs: T0 })).resolves.toBeUndefined();
  });
});

describe("D2 aucun nouvel interrupteur", () => {
  it("la mémoire « oppositions.sante » est déclarée dans le recensement, et aucune clé d'interrupteur n'est ajoutée", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("tests/usine/inventaire/parcours-et-ecriture.test.ts", "utf8");
    expect(src).toMatch(/"oppositions\.sante": "memoire"/);
    expect(SO.PARAM_SANTE_OPPOSITIONS).toBe("oppositions.sante");
  });
});

describe("réserve 1 : la ligne de la boucle existe une seule fois, juste après « envois du calendrier »", () => {
  it("source de boucle.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const lignes = readFileSync("src/services/boucle.ts", "utf8").split("\n");
    const i = lignes.flatMap((l, k) => (l.includes('lancerAnnexe("santé des oppositions"') ? [k] : []));
    expect(i).toHaveLength(1);
    expect(lignes[i[0] - 1]).toContain('lancerAnnexe("envois du calendrier"');
    expect(lignes[i[0]]).toContain("surveillerOppositions");
  });
});
