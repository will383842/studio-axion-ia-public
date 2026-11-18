/**
 * KB-05c — lire la Méthode du site par le client unique de KB-02 (lecture seule, éteinte par défaut).
 * Tout en doublure locale : faux serveur (fetch injecté), réglages en mémoire, faux corpus INVENTÉ. Aucun appel réel,
 * aucun contenu privé : les slugs sont « methode/faux-… », le secret de test est « x » répété 40 fois.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const dom = await import("@/domaine/kb-site");
const svc = await import("@/services/kb-site");
const { proposerPreuveDepuisSite } = await import("@/services/preuves");
const actions = await import("@/app/(studio)/reglages/base-connaissances/actions");

const MDP = "essai-kb-05c-methode";
const SITE = "https://site.exemple.fr";
const SECRET = "x".repeat(40);
/** Le symbole est construit : aucun montant écrit en clair dans le dépôt. */
const E = String.fromCharCode(0x20ac);
const ENV = { SITE_KB_URL: SITE, METHODE_STUDIO_SECRET: SECRET };

function item(n = 1, surcharge: Record<string, unknown> = {}) {
  return { slug: `methode/faux-${n}`, titre: `Consigne inventée ${n}`, texte: `Un texte neutre inventé numéro ${n}.`, source: "methode", ...surcharge };
}

type Reponse = { statut?: number; corps?: unknown; texte?: string; jette?: boolean; pendu?: boolean };
function fauxSite(r: Reponse = {}) {
  const appels: { url: string; init: RequestInit | undefined }[] = [];
  const f = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    appels.push({ url: String(entree), init });
    if (r.jette) throw new Error(`réseau coupé ${SECRET}`);
    if (r.pendu)
      return new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("délai", "AbortError")));
      });
    const corps = r.texte ?? JSON.stringify(r.corps ?? { items: [item(1)], meta: { returned: 1 } });
    return new Response(corps, { status: r.statut ?? 200 });
  });
  return { f: f as unknown as typeof fetch, mock: f, appels };
}

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  svc.reinitialiserCadenceMethode();
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const allumer = () => ecrireParametre(svc.REGLAGE_METHODE_SITE, true);

describe("domaine : adresse https, sujet, validation, montants", () => {
  it("expose le chemin unique et refuse toute base non https", () => {
    expect(dom.CHEMIN_METHODE_SITE).toBe("/api/internal/methode/studio");
    expect(dom.baseMethodeValide(`${SITE}/`)).toBe(SITE);
    for (const b of [undefined, "", "   ", "pas une adresse", "http://site.exemple.fr", "ftp://x.exemple.fr", "javascript:alert(1)", `https://u:p${"@"}site.exemple.fr`]) {
      expect(dom.baseMethodeValide(b), String(b)).toBeNull();
    }
    expect(dom.baseSiteValide("http://site.exemple.fr")).toBe("http://site.exemple.fr"); // KB-02 inchangée
  });
  it("nettoie le sujet : 2 à 300 caractères après nettoyage, sinon vide", () => {
    expect(dom.nettoyerSujet("  relances  ")).toBe("relances");
    expect(dom.nettoyerSujet("ab")).toBe("ab");
    expect(dom.nettoyerSujet("a".repeat(300))).toHaveLength(300);
    for (const s of ["", " ", "a", "  a  ", "a".repeat(301), 12, null, undefined, {}, []]) expect(dom.nettoyerSujet(s), String(s)).toBe("");
  });
  it("ne garde que la forme exacte, slug methode/, texte ≤ 1 600, 5 au plus, champs en trop jetés", () => {
    const mauvais = [null, 3, "x", [], {}, item(1, { source: "autre" }), item(2, { slug: "faq/faux-2" }), item(3, { slug: "" }), item(4, { titre: 7 }), item(5, { texte: "a".repeat(1601) }), item(6, { titre: "" }), { ...item(7), slug: undefined }];
    const bons = [item(11), item(12, { texte: "a".repeat(1600) })];
    const sortie = dom.validerReponseMethode({ items: [...mauvais, ...bons], meta: { returned: 99 } });
    expect(sortie.map((c) => c.slug)).toEqual(["methode/faux-11", "methode/faux-12"]);
    const trop = dom.validerReponseMethode({ items: Array.from({ length: 12 }, (_, i) => ({ ...item(i), secret: "x", entryId: "e" })) });
    expect(trop).toHaveLength(5);
    expect(Object.keys(trop[0]!).sort()).toEqual(["slug", "source", "texte", "titre"]);
  });
  it("une forme mauvaise donne une liste vide", () => {
    for (const corps of [null, undefined, 12, "texte", [], {}, { items: null }, { items: "x" }, { items: {} }, { meta: { returned: 1 } }]) {
      expect(dom.validerReponseMethode(corps), JSON.stringify(corps)).toEqual([]);
    }
  });
  it("masque tout montant du titre et du texte", () => {
    const c = dom.consigneSansMontant(item(1, { titre: `Offre à 99${E}`, texte: `Le forfait coûte 49 ${E} par mois.` }) as never);
    expect(JSON.stringify(c)).not.toMatch(/\u20ac|99|49/);
    expect(c.titre).toContain("[montant masqué]");
    expect(c.texte).toContain("par mois");
    expect(c.slug).toBe("methode/faux-1");
  });
  it("le type ConsigneMethode n'a ni entryId ni translationId", () => {
    const c = dom.validerReponseMethode({ items: [{ ...item(1), entryId: "e", translationId: "t" }] })[0]!;
    expect("entryId" in c).toBe(false);
    expect("translationId" in c).toBe(false);
  });
});

describe("critère 2 — éteinte par défaut : aucun appel", () => {
  const cas: [string, () => Promise<void>][] = [
    ["réglage absent", async () => undefined],
    ["réglage faux", async () => ecrireParametre(svc.REGLAGE_METHODE_SITE, false)],
    ["réglage texte « true »", async () => ecrireParametre(svc.REGLAGE_METHODE_SITE, "true")],
    ["réglage 1", async () => ecrireParametre(svc.REGLAGE_METHODE_SITE, 1)],
  ];
  for (const [nom, preparer] of cas) {
    it(nom, async () => {
      await preparer();
      const s = fauxSite();
      const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f });
      expect(s.mock).toHaveBeenCalledTimes(0);
      expect(r.etat).toBe("eteinte");
      expect(r.consignes).toEqual([]);
      expect(r.message).toMatch(/Méthode éteinte/);
    });
  }
  it("réglage illisible : éteinte, zéro appel", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base absente"));
    const s = fauxSite();
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f });
    expect(s.mock).toHaveBeenCalledTimes(0);
    expect(r.etat).toBe("eteinte");
  });
  it("allumée mais adresse absente, invalide ou non https, ou secret absent ou court : non branchée, zéro appel", async () => {
    await allumer();
    const envs = [{}, { METHODE_STUDIO_SECRET: SECRET }, { SITE_KB_URL: "", METHODE_STUDIO_SECRET: SECRET }, { SITE_KB_URL: "n'importe quoi", METHODE_STUDIO_SECRET: SECRET }, { SITE_KB_URL: "http://site.exemple.fr", METHODE_STUDIO_SECRET: SECRET }, { SITE_KB_URL: SITE }, { SITE_KB_URL: SITE, METHODE_STUDIO_SECRET: "" }, { SITE_KB_URL: SITE, METHODE_STUDIO_SECRET: "x".repeat(31) }];
    for (const env of envs) {
      const s = fauxSite();
      const r = await svc.lireMethodeSite("relances", { env, fetchImpl: s.f });
      expect(s.mock).toHaveBeenCalledTimes(0);
      expect(r.etat).toBe("non-branchee");
      expect(r.consignes).toEqual([]);
    }
  });
  it("le réglage est relu à chaque lecture", async () => {
    const s = fauxSite();
    await allumer();
    expect((await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f })).etat).toBe("ok");
    await ecrireParametre(svc.REGLAGE_METHODE_SITE, false);
    expect((await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f })).etat).toBe("eteinte");
    expect(s.mock).toHaveBeenCalledTimes(1);
  });
  it("indépendant du réglage de KB-02 : allumer la lecture publique n'allume pas la Méthode", async () => {
    await ecrireParametre(svc.REGLAGE_LECTURE_SITE, true);
    const s = fauxSite();
    expect((await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f })).etat).toBe("eteinte");
    expect(s.mock).toHaveBeenCalledTimes(0);
  });
  it("lectureMethodeDisponible : trois booléens, aucun appel, jamais la valeur du secret", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await svc.lectureMethodeDisponible(ENV)).toEqual({ allumee: false, adresse: true, secret: true });
    await allumer();
    expect(await svc.lectureMethodeDisponible(ENV)).toEqual({ allumee: true, adresse: true, secret: true });
    expect(await svc.lectureMethodeDisponible({ SITE_KB_URL: "http://x.exemple.fr", METHODE_STUDIO_SECRET: "court" })).toEqual({ allumee: true, adresse: false, secret: false });
    expect(JSON.stringify(await svc.lectureMethodeDisponible(ENV))).not.toContain(SECRET);
    expect(f).toHaveBeenCalledTimes(0);
  });
});

describe("critère 3 — allumée et branchée : un seul POST", () => {
  beforeEach(allumer);

  it("exactement un POST avec le corps { sujet } et les bons en-têtes", async () => {
    const s = fauxSite({ corps: { items: [item(1), item(2)], meta: { returned: 2 } } });
    const r = await svc.lireMethodeSite("  relances clients ", { env: ENV, fetchImpl: s.f });
    expect(s.mock).toHaveBeenCalledTimes(1);
    const { url, init } = s.appels[0]!;
    expect(url).toBe(`${SITE}/api/internal/methode/studio`);
    expect(url).not.toMatch(/kb\/search|kb\/ingest/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ sujet: "relances clients" });
    const h = init?.headers as Record<string, string>;
    expect(h["content-type"]).toBe("application/json");
    expect(h.accept).toBe("application/json");
    expect(h["x-methode-secret"]).toBe(SECRET);
    expect(init?.cache).toBe("no-store");
    expect(init?.redirect).toBe("error");
    expect(init?.signal).toBeDefined();
    expect(r.etat).toBe("ok");
    expect(r.consignes.map((c) => c.slug)).toEqual(["methode/faux-1", "methode/faux-2"]);
  });
  it("sujet hors bornes : zéro appel", async () => {
    const s = fauxSite();
    for (const sujet of ["", "   ", "a", "a".repeat(301), 12 as never]) {
      const r = await svc.lireMethodeSite(sujet, { env: ENV, fetchImpl: s.f });
      expect(r.etat).toBe("vide");
      expect(r.message.length).toBeGreaterThan(0);
    }
    expect(s.mock).toHaveBeenCalledTimes(0);
  });
  it("délai de 4 secondes par défaut", async () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite().f });
    expect(spy.mock.calls.some((c) => c[1] === 4000)).toBe(true);
  });
  it("cadence propre de 20 par minute, séparée de celle de KB-02", async () => {
    const s = fauxSite();
    let refus = 0;
    for (let i = 0; i < 30; i++) if ((await svc.lireMethodeSite(`sujet ${i}`, { env: ENV, fetchImpl: s.f })).etat === "trop-rapide") refus++;
    expect(s.mock.mock.calls.length).toBe(20);
    expect(refus).toBe(10);
    svc.reinitialiserCadenceMethode();
    expect((await svc.lireMethodeSite("encore", { env: ENV, fetchImpl: s.f })).etat).toBe("ok");
    // KB-02 garde son propre compteur : la Méthode ne l'a pas entamé
    await ecrireParametre(svc.REGLAGE_LECTURE_SITE, true);
    svc.reinitialiserCadenceSite();
    for (let i = 0; i < 20; i++) await svc.lireMethodeSite(`m${i}`, { env: ENV, fetchImpl: s.f });
    const faits = fauxSite({ corps: { hits: [], total: 0 } });
    expect((await svc.chercherFaitsSite("q", { env: ENV, fetchImpl: faits.f })).etat).toBe("vide");
  });
  it("une lecture Méthode n'appelle ni kb/search ni kb/ingest", async () => {
    const s = fauxSite();
    await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f });
    for (const a of s.appels) expect(a.url).not.toMatch(/kb\/(search|ingest)/);
  });
});

describe("critère 4 — route fermée ou en erreur : liste vide, une phrase, jamais d'exception", () => {
  beforeEach(allumer);

  const cas: [string, Reponse, string][] = [
    ["404", { statut: 404, texte: "" }, "fermee"],
    ["401", { statut: 401, corps: { error: "unauthorized" } }, "non-branchee"],
    ["503", { statut: 503, corps: { error: "not_configured" } }, "non-branchee"],
    ["429", { statut: 429, corps: { error: "rate" } }, "trop-rapide"],
    ["400", { statut: 400, corps: { error: "invalid" } }, "erreur"],
    ["500", { statut: 500, texte: "boom" }, "erreur"],
    ["302 sans suite", { statut: 302, texte: "" }, "erreur"],
    ["JSON illisible", { texte: "{pas du json" }, "erreur"],
    ["corps vide", { texte: "" }, "erreur"],
    ["items absent", { corps: { meta: { returned: 1 } } }, "erreur"],
    ["items d'un mauvais type", { corps: { items: "oui" } }, "erreur"],
    ["réseau coupé", { jette: true }, "erreur"],
  ];
  for (const [nom, rep, etat] of cas) {
    it(`${nom} : état « ${etat} », liste vide, phrase simple, sans exception`, async () => {
      const s = fauxSite(rep);
      const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f });
      expect(r.etat).toBe(etat);
      expect(r.consignes).toEqual([]);
      expect(r.message.length).toBeGreaterThan(0);
      expect(r.message).not.toMatch(/boom|Error|undefined|stack|404|401|503|500/i);
      expect(s.mock).toHaveBeenCalledTimes(1);
    });
  }
  it("404 : phrase exacte « La Méthode n'est pas ouverte sur le site. »", async () => {
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite({ statut: 404 }).f });
    expect(r.message).toBe("La Méthode n'est pas ouverte sur le site.");
  });
  it("délai dépassé : erreur, liste vide, sans exception", async () => {
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite({ pendu: true }).f, delaiMs: 20 });
    expect(r.etat).toBe("erreur");
    expect(r.consignes).toEqual([]);
    expect(r.message).toMatch(/temps|réessayez/i);
  });
  it("réponse correcte sans passage : « vide »", async () => {
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite({ corps: { items: [], meta: { returned: 0 } } }).f });
    expect(r.etat).toBe("vide");
    expect(r.message).toMatch(/aucun/i);
  });
  it("l'action ne plante pas sur chaque cas (fetch global doublé)", async () => {
    vi.stubEnv("SITE_KB_URL", SITE);
    vi.stubEnv("METHODE_STUDIO_SECRET", SECRET);
    for (const [nom, rep] of cas) {
      svc.reinitialiserCadenceMethode();
      vi.stubGlobal("fetch", fauxSite(rep).f);
      const r = await actions.lireMethodeSiteAction("relances");
      expect(r.ok, nom).toBe(true);
    }
    vi.stubGlobal("fetch", fauxSite().f);
    svc.reinitialiserCadenceMethode();
    const ok = await actions.lireMethodeSiteAction("relances");
    expect(ok.ok && ok.donnees.consignes.length).toBe(1);
  });
});

describe("critère 5 — réponse validée, montants masqués avant la sortie du service", () => {
  beforeEach(allumer);
  it("mélange : seuls les items de forme exacte restent, champs en trop jetés", async () => {
    const s = fauxSite({ corps: { items: [{ ...item(1), entryId: "e1", rank: 0.3 }, { slug: "x" }, null, item(2, { source: "faq" }), item(3, { slug: "autre/3" }), item(4)], meta: { returned: 6 } } });
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f });
    expect(r.consignes.map((c) => c.slug)).toEqual(["methode/faux-1", "methode/faux-4"]);
    expect(Object.keys(r.consignes[0]!).sort()).toEqual(["slug", "source", "texte", "titre"]);
  });
  it("texte de 1 604 caractères refusé, 1 600 gardé ; 5 items au plus", async () => {
    const s = fauxSite({ corps: { items: [item(1, { texte: "a".repeat(1604) }), item(2, { texte: "a".repeat(1600) }), ...[3, 4, 5, 6, 7, 8].map((n) => item(n))] } });
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: s.f });
    expect(r.consignes).toHaveLength(5);
    expect(r.consignes.map((c) => c.slug)).not.toContain("methode/faux-1");
  });
  it("tout montant est masqué dans le titre et le texte", async () => {
    const s = fauxSite({ corps: { items: [item(1, { titre: `Offre à 99${E}`, texte: `Le forfait coûte 49 ${E} par mois, soit 1 200,50 ${E} par an.` })] } });
    const r = await svc.lireMethodeSite("forfait", { env: ENV, fetchImpl: s.f });
    expect(r.consignes).toHaveLength(1);
    expect(JSON.stringify(r)).not.toMatch(/\u20ac|99|49|1 200/);
    expect(r.consignes[0]!.texte).toContain("[montant masqué]");
  });
});

describe("critère 6 — le secret n'est jamais journalisé ni rendu", () => {
  const espions = () => (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
  const sujetSecret = "sujet-tres-particulier-xyz";

  it("aucun console.* ne reçoit le secret, le sujet ou les textes, sur tous les cas", async () => {
    const es = espions();
    const reponses: Reponse[] = [{}, { statut: 404 }, { statut: 401 }, { statut: 503 }, { statut: 429 }, { statut: 500, texte: SECRET }, { texte: "{pas du json" }, { jette: true }, { pendu: true }, { corps: { items: [item(1, { texte: "texte-recu-unique" })] } }];
    for (const rep of reponses) {
      svc.reinitialiserCadenceMethode();
      await ecrireParametre(svc.REGLAGE_METHODE_SITE, true);
      await svc.lireMethodeSite(sujetSecret, { env: ENV, fetchImpl: fauxSite(rep).f, delaiMs: 20 });
    }
    await ecrireParametre(svc.REGLAGE_METHODE_SITE, false);
    await svc.lireMethodeSite(sujetSecret, { env: ENV, fetchImpl: fauxSite().f });
    const tout = JSON.stringify(es.flatMap((e) => e.mock.calls));
    expect(tout).not.toContain(SECRET);
    expect(tout).not.toContain(sujetSecret);
    expect(tout).not.toContain("texte-recu-unique");
  });
  it("le résultat du service ne contient ni le secret ni le nom de l'en-tête (succès, erreurs, éteint)", async () => {
    await allumer();
    for (const rep of [{}, { statut: 404 }, { statut: 401 }, { statut: 500, texte: SECRET }, { jette: true }]) {
      svc.reinitialiserCadenceMethode();
      const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite(rep).f });
      const j = JSON.stringify(r);
      expect(j).not.toContain(SECRET);
      expect(j.toLowerCase()).not.toContain("x-methode-secret");
    }
    await ecrireParametre(svc.REGLAGE_METHODE_SITE, false);
    expect(JSON.stringify(await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite().f }))).not.toContain(SECRET);
  });
  it("le résultat de l'action ne contient ni le secret ni le nom de l'en-tête", async () => {
    await allumer();
    vi.stubEnv("SITE_KB_URL", SITE);
    vi.stubEnv("METHODE_STUDIO_SECRET", SECRET);
    for (const rep of [{}, { statut: 404 }, { jette: true }, { statut: 500, texte: SECRET }]) {
      svc.reinitialiserCadenceMethode();
      vi.stubGlobal("fetch", fauxSite(rep).f);
      const j = JSON.stringify(await actions.lireMethodeSiteAction("relances"));
      expect(j).not.toContain(SECRET);
      expect(j.toLowerCase()).not.toContain("x-methode-secret");
    }
  });
  it("la page n'affiche que « secret posé : oui / non »", () => {
    const page = readFileSync(join(RACINE, "src/app/(studio)/reglages/base-connaissances/page.tsx"), "utf8");
    expect(page).toMatch(/secret posé : \{[^}]*\? "oui" : "non"\}/i);
    expect(page).not.toMatch(/process\.env/);
    expect(page).not.toMatch(/METHODE_STUDIO_SECRET/);
  });
  it("le chemin de lecture n'écrit rien au journal ni en base", async () => {
    await allumer();
    const avant = JSON.stringify(await depots().preuves.lister());
    const es = espions();
    await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite().f });
    expect(es.flatMap((e) => e.mock.calls)).toEqual([]);
    expect(JSON.stringify(await depots().preuves.lister())).toBe(avant);
  });
});

describe("critère 7 — jamais une preuve ni un texte publiable", () => {
  it("proposerPreuveDepuisSite(consigne) est refusé et rien n'est écrit", async () => {
    await allumer();
    const r = await svc.lireMethodeSite("relances", { env: ENV, fetchImpl: fauxSite().f });
    await expect(proposerPreuveDepuisSite(r.consignes[0] as never, { env: ENV })).rejects.toThrow();
    expect(await depots().preuves.lister()).toHaveLength(0);
  });
  it("aucune action n'accepte un passage comme preuve", () => {
    const src = readFileSync(join(RACINE, "src/app/(studio)/reglages/base-connaissances/actions.ts"), "utf8");
    const debut = src.indexOf("export async function lireMethodeSiteAction");
    const bloc = src.slice(debut, src.indexOf("\n}\n", debut));
    expect(bloc).not.toMatch(/proposerPreuve/);
  });
  it("l'écran n'a aucun bouton « Proposer comme preuve », « Copier » ou « Utiliser dans un script » ; étiquette et slug présents", () => {
    const src = readFileSync(join(RACINE, "src/components/reglages/ConsignesMethode.tsx"), "utf8");
    expect(src).not.toMatch(/Proposer comme preuve|Copier|Utiliser dans un script|clipboard|proposerPreuve/i);
    expect(src).toContain("Consigne interne, à ne pas publier");
    expect(src).toContain("Lire la Méthode");
    expect(src).toMatch(/\.slug/);
    expect(src).not.toContain(E);
  });
  it("seuls les 5 fichiers de la fiche importent lireMethodeSite, ConsigneMethode ou lectureMethodeDisponible", () => {
    const permis = new Set(["src/domaine/kb-site.ts", "src/services/kb-site.ts", "src/app/(studio)/reglages/base-connaissances/actions.ts", "src/app/(studio)/reglages/base-connaissances/page.tsx", "src/components/reglages/ConsignesMethode.tsx"]);
    const hors = fichiersSrc().filter((f) => !permis.has(f) && /lireMethodeSite|ConsigneMethode|lectureMethodeDisponible/.test(lire(f)));
    expect(hors).toEqual([]);
  });
});

describe("critère 1 — client unique", () => {
  it("aucun autre fichier de src/** ne contient « /api/internal/ »", () => {
    const hors = fichiersSrc().filter((f) => f !== "src/domaine/kb-site.ts" && lire(f).includes("/api/internal/"));
    expect(hors).toEqual([]);
  });
  it("l'appel à la Méthode vit dans src/services/kb-site.ts, à côté de chercherFaitsSite", () => {
    const src = lire("src/services/kb-site.ts");
    expect(src).toContain("export async function lireMethodeSite");
    expect(src).toContain("export async function chercherFaitsSite");
    expect(src).toContain("CHEMIN_METHODE_SITE");
  });
  it("aucun autre service ne fait de fetch vers le site (SITE_KB_URL / METHODE_STUDIO_SECRET)", () => {
    const hors = fichiersSrc().filter((f) => f !== "src/services/kb-site.ts" && f !== "src/services/preuves.ts" && /METHODE_STUDIO_SECRET/.test(lire(f)));
    expect(hors).toEqual([]);
  });
  it("le secret est lu dans l'environnement, jamais en base", () => {
    const src = lire("src/services/kb-site.ts");
    expect(src).toContain('VARIABLE_SECRET_METHODE = "METHODE_STUDIO_SECRET"');
    expect(svc.VARIABLE_SECRET_METHODE).toBe("METHODE_STUDIO_SECRET");
    expect(svc.REGLAGE_METHODE_SITE).toBe("kb_site.methode.actif");
  });
});

describe("critère 8 — actions : même forme que « Lire la base du site »", () => {
  it("définir : booléen seulement, session exigée", async () => {
    expect((await actions.definirMethodeSiteAction(true)).ok).toBe(true);
    expect(await svc.lectureMethodeDisponible(ENV)).toMatchObject({ allumee: true });
    expect((await actions.definirMethodeSiteAction("true")).ok).toBe(false);
    expect((await actions.definirMethodeSiteAction(false)).ok).toBe(true);
    expect(await svc.lectureMethodeDisponible(ENV)).toMatchObject({ allumee: false });
    reinitialiserRequete();
    await expect(actions.definirMethodeSiteAction(true)).rejects.toThrow();
    await expect(actions.lireMethodeSiteAction("relances")).rejects.toThrow();
  });
  it("formulaire : « oui » allume, autre chose éteint", async () => {
    const f = new FormData();
    f.set("valeur", "oui");
    await actions.basculerMethodeSiteFormulaire(f);
    expect(await svc.lectureMethodeDisponible(ENV)).toMatchObject({ allumee: true });
    f.set("valeur", "non");
    await actions.basculerMethodeSiteFormulaire(f);
    expect(await svc.lectureMethodeDisponible(ENV)).toMatchObject({ allumee: false });
  });
  it("un sujet qui n'est pas une chaîne donne « vide » sans appel", async () => {
    await allumer();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    vi.stubEnv("SITE_KB_URL", SITE);
    vi.stubEnv("METHODE_STUDIO_SECRET", SECRET);
    const r = await actions.lireMethodeSiteAction(42);
    expect(r.ok && r.donnees.etat).toBe("vide");
    expect(f).toHaveBeenCalledTimes(0);
  });
});

describe("critère 9 — aucun contenu privé", () => {
  it("le test n'utilise que des slugs methode/faux-…, sans courriel ni téléphone", () => {
    const moi = lire("tests/kb-05c-methode-studio.test.ts");
    expect(moi).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(moi).not.toMatch(/(?:\+33|\b0)[1-9](?:[ .]?\d{2}){4}/);
    const slugs = [...moi.matchAll(/methode\/([a-z0-9-]+)/g)].map((m) => m[1]!).filter((s) => s !== "studio");
    for (const s of slugs) expect(s.startsWith("faux-"), s).toBe(true);
  });
});

const RACINE = process.cwd();
function lire(rel: string): string {
  return readFileSync(join(RACINE, rel), "utf8");
}
function fichiersSrc(): string[] {
  const sortie: string[] = [];
  const marcher = (dir: string) => {
    for (const nom of readdirSync(dir)) {
      const p = join(dir, nom);
      if (statSync(p).isDirectory()) marcher(p);
      else if (/\.(ts|tsx)$/.test(nom)) sortie.push(relative(RACINE, p).split("\\").join("/"));
    }
  };
  marcher(join(RACINE, "src"));
  return sortie;
}
