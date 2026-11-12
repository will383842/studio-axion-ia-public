/** MG-1 : client signé vers le catalogue du site (lecture, copie, écriture). Faux site, valeurs fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cibleDuMot,
  PHRASES_REFUS_SITE,
} from "@/domaine/guide-reseau/cibles-contrat";
import {
  ENTETE_HORODATAGE,
  ENTETE_NONCE,
  ENTETE_SIGNATURE,
  signatureValide,
} from "@/fournisseurs/site/signature";
import {
  ENV_SITE_FICTIF,
  SECRET_FICTIF,
  siteCiblesFactice,
} from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const S = await import("@/services/cibles-site");

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const MIN = 60_000;
const H = 60 * MIN;
let site: ReturnType<typeof siteCiblesFactice>;
const env = ENV_SITE_FICTIF as unknown as Record<string, string>;
const lire = (ms = T0) => S.lireCiblesSite({ env, maintenantMs: ms });
const tout = async () =>
  JSON.stringify([
    await depots().parametres.lister(() => true),
    await depots().evenements.lister(() => true),
    await depots().notifications.lister(() => true),
  ]);

beforeEach(() => {
  reinitialiserDepots();
  site = siteCiblesFactice();
  pm.injecterTransportSite(site.transport);
});

describe("lecture signée", () => {
  it("chemins, méthode, corps vide et signature exacts", async () => {
    const r = await lire();
    expect(r).not.toBeNull();
    expect(site.appels.map((a) => `${a.methode} ${a.chemin}`).sort()).toEqual([
      "GET /api/interne/catalogue-reseau",
      "GET /api/interne/mots-cibles",
    ]);
    for (const a of site.appels) {
      expect(a.corps).toBe("");
      expect(a.entetes[ENTETE_HORODATAGE]).toBe(String(Math.floor(T0 / 1000)));
      expect(a.entetes[ENTETE_NONCE]).toMatch(/^[0-9a-f]{32}$/);
      expect(
        signatureValide(SECRET_FICTIF, {
          methode: "GET",
          chemin: a.chemin,
          corps: "",
          horodatage: a.entetes[ENTETE_HORODATAGE],
          nonce: a.entetes[ENTETE_NONCE],
          signature: a.entetes[ENTETE_SIGNATURE],
        }),
      ).toBe(true);
    }
    expect(r!.catalogue.map((e) => e.code)).toContain("gde-essai01");
    expect(r!.luLe).toBe(T0);
  });

  it("la ligne du réseau passe avant « tous »", async () => {
    const r = (await lire())!;
    const insta = cibleDuMot("TOUS1", "instagram", r.liaisons, r.catalogue);
    expect(insta.source).toBe("reseau");
    expect(insta.element?.code).toBe("adr-essai0000001");
    const fb = cibleDuMot("TOUS1", "facebook", r.liaisons, r.catalogue);
    expect(fb.source).toBe("tous");
    expect(fb.element?.titre).toBe("Guide fictif A");
  });

  it("sans secret ou sans transport : null, aucun appel", async () => {
    expect(await S.lireCiblesSite({ env: {}, maintenantMs: T0 })).toBeNull();
    expect(site.appels).toHaveLength(0);
  });

  it("aucune adresse ni chemin de PDF dans la copie", async () => {
    await lire();
    const copie = JSON.stringify(
      await depots().parametres.obtenir("cibles.miroir"),
    );
    expect(copie).toContain("Guide fictif A");
    expect(copie).not.toMatch(/exemple\.test|\.pdf|cheminPdf|"url"/);
  });
});

describe("copie « cibles.miroir »", () => {
  it("moins de 10 min : la copie suffit, le site n'est pas appelé", async () => {
    await lire();
    site.appels.length = 0;
    const r = await lire(T0 + 9 * MIN);
    expect(r?.luLe).toBe(T0);
    expect(site.appels).toHaveLength(0);
  });

  it("plus de 10 min : le site est relu et la copie rafraîchie", async () => {
    await lire();
    site.cibles.push({
      code: "gde-essai03",
      type: "guide",
      titre: "Guide fictif D",
      actif: true,
      test: false,
    });
    const r = await lire(T0 + 11 * MIN);
    expect(r?.luLe).toBe(T0 + 11 * MIN);
    expect(r?.catalogue.map((e) => e.code)).toContain("gde-essai03");
    expect(site.appels).toHaveLength(4);
  });

  it("site injoignable, copie de moins de 24 h : on garde la copie", async () => {
    await lire();
    site.etat.panne = true;
    const r = await lire(T0 + 23 * H);
    expect(r?.luLe).toBe(T0);
    expect(r?.catalogue.length).toBeGreaterThan(0);
  });

  it("site injoignable, copie de plus de 24 h : null (échec fermé)", async () => {
    await lire();
    site.etat.panne = true;
    expect(await lire(T0 + 25 * H)).toBeNull();
  });

  it("site injoignable sans copie : null", async () => {
    site.etat.panne = true;
    expect(await lire()).toBeNull();
  });

  it("le site répond une erreur (éteint) : même règle que l'injoignable", async () => {
    await lire();
    site.etat.statutForce = 404;
    expect((await lire(T0 + 30 * MIN))?.luLe).toBe(T0);
    expect(await lire(T0 + 30 * H)).toBeNull();
  });

  it("réponse illisible : traitée comme un échec", async () => {
    site.etat.statutForce = 200;
    site.etat.corpsForce = { pas: "un tableau" };
    expect(await lire()).toBeNull();
  });

  it("lignes illisibles comptées dans `ignores`", async () => {
    site.cibles.push({
      code: "X",
      type: "guide",
      titre: "mauvais code",
      actif: true,
      test: false,
    });
    expect((await lire())?.ignores).toBe(1);
  });
});

describe("écriture", () => {
  it("adresse : code adr- + 12 hex généré par le Studio, corps signé, POST sur le bon chemin", async () => {
    const r = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
    });
    expect(r.ok).toBe(true);
    const a = site.appels.at(-1)!;
    expect(`${a.methode} ${a.chemin}`).toBe("POST /api/interne/cibles-reseau");
    const corps = JSON.parse(a.corps);
    expect(corps.code).toMatch(/^adr-[0-9a-f]{12}$/);
    expect(r.ok && r.code).toBe(corps.code);
    expect(
      signatureValide(SECRET_FICTIF, {
        methode: "POST",
        chemin: a.chemin,
        corps: a.corps,
        horodatage: a.entetes[ENTETE_HORODATAGE],
        nonce: a.entetes[ENTETE_NONCE],
        signature: a.entetes[ENTETE_SIGNATURE],
      }),
    ).toBe(true);
  });

  it("rejeu avec le même code : aucun doublon sur le site", async () => {
    const o = {
      env,
      maintenantMs: T0,
      type: "adresse" as const,
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
      code: "adr-0123456789ab",
    };
    await S.creerElementCatalogue(o);
    await S.creerElementCatalogue(o);
    expect(
      site.cibles.filter((c) => c.code === "adr-0123456789ab"),
    ).toHaveLength(1);
  });

  it("refus du site : phrase française du contrat, jamais le code brut", async () => {
    const r = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive F",
      url: "https://autre.test/x",
    });
    expect(r).toEqual({
      ok: false,
      phrase: PHRASES_REFUS_SITE.adresse_hote_non_autorise,
    });
  });

  it("titre trop court refusé par le site", async () => {
    const r = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "ab",
      url: "https://exemple.test/x",
    });
    expect(r).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.titre_invalide });
  });

  it("lierMot : mot envoyé en minuscules ; cible inactive ou inconnue => phrases", async () => {
    expect(
      (
        await S.lierMot({
          env,
          maintenantMs: T0,
          mot: "CHATGPT",
          reseau: "tous",
          codeCible: "gde-essai01",
        })
      ).ok,
    ).toBe(true);
    expect(JSON.parse(site.appels.at(-1)!.corps)).toEqual({
      mot: "chatgpt",
      reseau: "tous",
      codeCible: "gde-essai01",
      actif: true,
    });
    expect(
      await S.lierMot({
        env,
        maintenantMs: T0,
        mot: "CHATGPT",
        reseau: "tous",
        codeCible: "gde-essai02",
      }),
    ).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.cible_inactive });
    expect(
      await S.lierMot({
        env,
        maintenantMs: T0,
        mot: "CHATGPT",
        reseau: "tous",
        codeCible: "gde-inconnu9",
      }),
    ).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.cible_inconnue });
  });

  it("mot interdit (STOP) : refusé avant d'envoyer, aucun appel", async () => {
    const r = await S.lierMot({
      env,
      maintenantMs: T0,
      mot: "STOP",
      reseau: "tous",
      codeCible: "gde-essai01",
    });
    expect(r).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.mot_invalide });
    expect(site.appels).toHaveLength(0);
  });

  it("delierMot : la liaison est désactivée (actif=false), rien n'est supprimé", async () => {
    expect(
      (
        await S.delierMot({
          env,
          maintenantMs: T0,
          mot: "TOUS1",
          reseau: "tous",
          codeCible: "gde-essai01",
        })
      ).ok,
    ).toBe(true);
    expect(JSON.parse(site.appels.at(-1)!.corps).actif).toBe(false);
    expect(
      site.liaisons.find((l) => l.mot === "tous1" && l.reseau === "tous")
        ?.actif,
    ).toBe(false);
  });

  it("site éteint (404), injoignable, limite de débit : phrases", async () => {
    site.etat.statutForce = 404;
    expect(
      await S.lierMot({
        env,
        maintenantMs: T0,
        mot: "abc",
        reseau: "tous",
        codeCible: "gde-essai01",
      }),
    ).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.introuvable });
    site.etat.statutForce = 429;
    site.etat.corpsForce = { ok: false, erreur: "trop_de_requetes" };
    expect(
      await S.lierMot({
        env,
        maintenantMs: T0,
        mot: "abc",
        reseau: "tous",
        codeCible: "gde-essai01",
      }),
    ).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.trop_de_requetes });
    site.etat.statutForce = null;
    site.etat.panne = true;
    const r = await S.lierMot({
      env,
      maintenantMs: T0,
      mot: "abc",
      reseau: "tous",
      codeCible: "gde-essai01",
    });
    expect(r.ok).toBe(false);
  });

  it("une écriture réussie force la relecture du site au prochain passage", async () => {
    await lire();
    await S.lierMot({
      env,
      maintenantMs: T0 + MIN,
      mot: "NOUVEAU",
      reseau: "tous",
      codeCible: "gde-essai01",
    });
    const r = await lire(T0 + 2 * MIN);
    expect(r?.liaisons.map((l) => l.mot)).toContain("NOUVEAU");
  });
});

describe("secret", () => {
  it("ni le secret ni une signature n'apparaissent dans le journal, les paramètres ou les alertes", async () => {
    site.etat.panne = true;
    await lire();
    site.etat.panne = false;
    await lire(T0 + MIN);
    await S.lierMot({
      env,
      maintenantMs: T0,
      mot: "STOP",
      reseau: "tous",
      codeCible: "gde-essai01",
    });
    site.etat.statutForce = 401;
    await S.lierMot({
      env,
      maintenantMs: T0,
      mot: "abc",
      reseau: "tous",
      codeCible: "gde-essai01",
    });
    const t = await tout();
    expect(t).not.toContain(SECRET_FICTIF);
    expect(t).not.toMatch(/v1=[0-9a-f]{64}/);
  });
});
