/** MG-1 : client signé vers le catalogue du site (lecture, copie, écriture). Faux site, valeurs fictives. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CODE_GUIDE_DEPART,
  cibleDuMot,
  PHRASES_REFUS_SITE,
} from "@/domaine/guide-reseau/cibles-contrat";
import {
  ENTETE_HORODATAGE,
  ENTETE_NONCE,
  ENTETE_SIGNATURE,
  signatureValide,
  signerAppel,
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

const PHRASE_INCERTAIN_TEXTE =
  "Le site n'a pas répondu à temps : la demande a peut-être été enregistrée. Réessayez, elle ne sera pas créée deux fois.";
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

const journalSite = async () =>
  (await depots().evenements.lister((e) => e.type === "cibles_site")).length;
const transportMuet = () => {
  // Le faux site enregistre la demande, mais la réponse n'arrive jamais.
  pm.injecterTransportSite((r) => {
    void site.transport(r);
    return new Promise(() => {});
  });
};

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  reinitialiserDepots();
  S.reinitialiserEtatCiblesSite();
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
      code: expect.stringMatching(/^adr-[0-9a-f]{12}$/),
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
    expect(r).toEqual({
      ok: false,
      phrase: PHRASES_REFUS_SITE.titre_invalide,
      code: expect.stringMatching(/^adr-/),
    });
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

describe("délai de 3 s", () => {
  it("lecture sans réponse : la copie sert (depuisCopie), sans copie null", async () => {
    await lire();
    vi.useFakeTimers();
    transportMuet();
    const p = lire(T0 + 11 * MIN);
    await vi.advanceTimersByTimeAsync(3000);
    const r = await p;
    expect(r?.luLe).toBe(T0);
    expect(r?.depuisCopie).toBe(true);
    reinitialiserDepots();
    S.reinitialiserEtatCiblesSite();
    const q = lire();
    await vi.advanceTimersByTimeAsync(3000);
    expect(await q).toBeNull();
  });

  it("écriture sans réponse : rejet à 3 s, code rendu, phrase « peut-être enregistrée », rejeu sans doublon", async () => {
    vi.useFakeTimers();
    transportMuet();
    const p = S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
    });
    await vi.advanceTimersByTimeAsync(3000);
    const r = await p;
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.phrase).toBe(
      "Le site n'a pas répondu à temps : la demande a peut-être été enregistrée. Réessayez, elle ne sera pas créée deux fois.",
    );
    expect(r.code).toMatch(/^adr-[0-9a-f]{12}$/);
    // Le premier appel est bien parti avec CE code (et le faux site l'a enregistré).
    expect(JSON.parse(site.appels[0].corps).code).toBe(r.code);
    const departCibles = site.cibles.length;
    vi.useRealTimers();
    pm.injecterTransportSite(site.transport);
    const r2 = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
      code: r.code,
    });
    expect(r2.ok).toBe(true);
    expect(JSON.parse(site.appels.at(-1)!.corps).code).toBe(r.code);
    expect(site.cibles.filter((c) => c.code === r.code)).toHaveLength(1);
    // Le premier appel avait déjà créé la cible : le rejeu n'ajoute rien.
    expect(site.cibles).toHaveLength(departCibles);
  });

  it("erreur 5xx sans code de refus connu : « peut-être enregistrée », pas « rien n'a été enregistré »", async () => {
    site.etat.statutForce = 502;
    site.etat.corpsForce = null;
    const r = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
    });
    expect(site.appels).toHaveLength(1);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.phrase).toBe(PHRASE_INCERTAIN_TEXTE);
    expect(!r.ok && r.phrase).not.toContain("rien n'a été enregistré");
  });

  it("faux site : mêmes règles que le vrai (chemin PDF, préfixe du code, url sur un guide)", async () => {
    const envoyer = async (corps: Record<string, unknown>) => {
      const json = JSON.stringify(corps);
      const chemin = "/api/interne/cibles-reseau";
      const r = await site.transport({
        methode: "POST",
        chemin,
        corps: json,
        entetes: signerAppel({
          secret: SECRET_FICTIF,
          methode: "POST",
          chemin,
          corps: json,
          horodatageSec: T0 / 1000,
        }),
      });
      return r.corps;
    };
    const avant = site.cibles.length;
    const base = { titre: "Cible fictive", type: "guide" };
    expect(await envoyer({ ...base, code: "gde-abc123def456" })).toEqual({
      ok: false,
      erreur: "chemin_pdf_invalide",
    });
    expect(
      await envoyer({
        ...base,
        code: "adr-abc123def456",
        cheminPdf: "g/a.pdf",
      }),
    ).toEqual({ ok: false, erreur: "code_invalide" });
    expect(
      await envoyer({
        ...base,
        code: "adr-abc123def456",
        type: "adresse",
        url: "https://exemple.test/x",
        cheminPdf: "g/a.pdf",
      }),
    ).toEqual({ ok: false, erreur: "adresse_sans_pdf" });
    expect(
      await envoyer({
        ...base,
        code: "gde-abc123def456",
        cheminPdf: "g/a.pdf",
        url: "https://exemple.test/x",
      }),
    ).toEqual({ ok: false, erreur: "guide_sans_adresse" });
    expect(
      await envoyer({
        titre: "Cible fictive",
        type: "adresse",
        code: "gde-abc123def456",
        url: "https://exemple.test/x",
      }),
    ).toEqual({ ok: false, erreur: "code_invalide" });
    expect(site.cibles).toHaveLength(avant);
    expect(
      await envoyer({
        ...base,
        code: "guide-ia",
        cheminPdf: "guides/depart.pdf",
      }),
    ).toMatchObject({ ok: true });
    expect(site.cibles).toHaveLength(avant + 1);
  });

  it("« rien n'a été enregistré » seulement quand aucun appel n'est parti", async () => {
    const r = await S.creerElementCatalogue({
      env: {},
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.phrase).toContain("rien n'a été enregistré");
    expect(!r.ok && r.code).toMatch(/^adr-/);
    site.etat.panne = true;
    const q = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive E",
      url: "https://exemple.test/page-e",
    });
    expect(!q.ok && q.phrase).not.toContain("rien n'a été enregistré");
    expect(!q.ok && q.code).toMatch(/^adr-/);
  });
});

describe("délier, code de départ, reprise après échec", () => {
  it("délier après désactivation de la cible : le site refuse (cible_inactive), la liaison reste active", async () => {
    site.cibles.find((c) => c.code === "gde-essai01")!.actif = false;
    const r = await S.delierMot({
      env,
      maintenantMs: T0,
      mot: "TOUS1",
      reseau: "tous",
      codeCible: "gde-essai01",
    });
    expect(r).toEqual({ ok: false, phrase: PHRASES_REFUS_SITE.cible_inactive });
    expect(JSON.parse(site.appels.at(-1)!.corps)).toEqual({
      mot: "tous1",
      reseau: "tous",
      codeCible: "gde-essai01",
      actif: false,
    });
    expect(
      site.liaisons.find((l) => l.mot === "tous1" && l.reseau === "tous")
        ?.actif,
    ).toBe(true);
  });

  it("code de départ guide-ia accepté pour un guide, pas pour une adresse", async () => {
    const g = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "guide",
      titre: "Guide de départ",
      code: CODE_GUIDE_DEPART,
      cheminPdf: "guides/depart.pdf",
    });
    expect(g).toEqual({ ok: true, code: "guide-ia" });
    expect(JSON.parse(site.appels.at(-1)!.corps).code).toBe("guide-ia");
    const a = await S.creerElementCatalogue({
      env,
      maintenantMs: T0,
      type: "adresse",
      titre: "Page fictive",
      url: "https://exemple.test/x",
      code: CODE_GUIDE_DEPART,
    });
    expect(a.ok).toBe(false);
  });

  it("échec du site : pas de nouvel appel avant 1 minute, un seul message par série", async () => {
    await lire();
    site.etat.panne = true;
    site.appels.length = 0;
    const t = T0 + 11 * MIN;
    expect((await lire(t))?.depuisCopie).toBe(true);
    const apres = site.appels.length;
    expect(apres).toBeGreaterThan(0);
    expect(await journalSite()).toBe(1);
    expect((await lire(t + 30_000))?.depuisCopie).toBe(true);
    expect(site.appels).toHaveLength(apres);
    await lire(t + 61_000);
    expect(site.appels.length).toBeGreaterThan(apres);
    expect(await journalSite()).toBe(1);
    site.etat.panne = false;
    const ok = await lire(t + 3 * MIN);
    expect(ok?.depuisCopie).toBe(false);
    site.etat.panne = true;
    await lire(t + 20 * MIN);
    expect(await journalSite()).toBe(2);
  });

  it("copie récente : depuisCopie faux", async () => {
    await lire();
    expect((await lire(T0 + MIN))?.depuisCopie).toBe(false);
  });
});
