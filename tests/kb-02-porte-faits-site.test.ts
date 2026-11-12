/**
 * KB-02 — porte unique de lecture des faits du site (recherche en lecture seule) ; chaque fait trouvé n'est qu'une
 * preuve PROPOSÉE. Tout en doublure locale : faux serveur (fetch injecté), dépôts en mémoire. Aucun appel réel.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre } = await import("@/services/_commun");
const { construireAdresseRecherche, validerReponseRecherche, masquerMontants, contientMontant, LIMITE_FAITS } = await import("@/domaine/kb-site");
const { chercherFaitsSite, REGLAGE_LECTURE_SITE, reinitialiserCadenceSite } = await import("@/services/kb-site");
const { proposerPreuveDepuisSite } = await import("@/services/preuves");
const { preuveDisponible } = await import("@/domaine/matieres");

const MDP = "essai-kb-02-porte";
const SITE = "https://site.exemple.fr";
/** Le symbole est construit : aucun montant écrit en clair dans le dépôt. */
const E = String.fromCharCode(0x20ac);
const ENV = { SITE_KB_URL: SITE };

function hit(n = 1, surcharge: Record<string, unknown> = {}) {
  return {
    entryId: `entree-${n}`,
    translationId: `trad-${n}`,
    type: "faq",
    slug: `question-${n}`,
    title: `Fait fictif ${n}`,
    excerpt: `Un extrait neutre numéro ${n}.`,
    locale: "fr",
    rank: 0.5 + n / 100,
    ...surcharge,
  };
}

type Reponse = { statut?: number; corps?: unknown; texte?: string; jette?: boolean; pendu?: boolean };
function fauxSite(r: Reponse = {}) {
  const appels: { url: string; init: RequestInit | undefined }[] = [];
  const f = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    appels.push({ url: String(entree), init });
    if (r.jette) throw new Error("réseau coupé");
    if (r.pendu)
      return new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(new DOMException("délai", "AbortError")));
      });
    const corps = r.texte ?? JSON.stringify(r.corps ?? { hits: [hit(1)], total: 1 });
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
  reinitialiserCadenceSite();
  await auth.seConnecter(MDP, false);
});
afterEach(() => vi.restoreAllMocks());

describe("domaine : adresse, validation, masquage", () => {
  it("construit GET /api/internal/kb/search avec q, locale=fr, limit ≤ 10", () => {
    const u = new URL(construireAdresseRecherche(`${SITE}/`, "  gestion des relances ")!);
    expect(u.origin + u.pathname).toBe(`${SITE}/api/internal/kb/search`);
    expect([...u.searchParams.keys()].sort()).toEqual(["limit", "locale", "q"]);
    expect(u.searchParams.get("q")).toBe("gestion des relances");
    expect(u.searchParams.get("locale")).toBe("fr");
    expect(Number(u.searchParams.get("limit"))).toBeLessThanOrEqual(10);
    expect(LIMITE_FAITS).toBeLessThanOrEqual(10);
  });
  it("refuse une base absente, illisible ou non http(s), et une recherche vide", () => {
    for (const base of [undefined, "", "   ", "pas une adresse", "ftp://x.exemple.fr", "javascript:alert(1)", "https://u:p@site.exemple.fr"]) {
      expect(construireAdresseRecherche(base, "relances"), String(base)).toBeNull();
    }
    expect(construireAdresseRecherche(SITE, "   ")).toBeNull();
    expect(construireAdresseRecherche(SITE, "")).toBeNull();
  });
  it("coupe la recherche à 200 caractères (limite du site)", () => {
    const u = new URL(construireAdresseRecherche(SITE, "a".repeat(500))!);
    expect(u.searchParams.get("q")!.length).toBe(200);
  });
  it("ne garde que les résultats de la forme exacte", () => {
    const bons = [hit(1), hit(2)];
    const mauvais = [null, 3, "x", [], {}, hit(3, { rank: "0.4" }), hit(4, { rank: Number.NaN }), hit(5, { title: 7 }), hit(6, { locale: undefined }), { ...hit(7), entryId: undefined }, hit(8, { slug: "" })];
    expect(validerReponseRecherche({ hits: [...mauvais, ...bons], total: 99 }).map((h) => h.entryId)).toEqual(["entree-1", "entree-2"]);
  });
  it("une réponse mal formée donne une liste vide, sans exception", () => {
    for (const corps of [null, undefined, 12, "texte", [], {}, { hits: null }, { hits: "x" }, { hits: {} }, { total: 2 }]) {
      expect(validerReponseRecherche(corps), JSON.stringify(corps)).toEqual([]);
    }
  });
  it("ne garde que les champs attendus et au plus 10 résultats", () => {
    const hits = Array.from({ length: 30 }, (_, i) => ({ ...hit(i), secret: "x" }));
    const sortie = validerReponseRecherche({ hits });
    expect(sortie).toHaveLength(LIMITE_FAITS);
    expect(Object.keys(sortie[0]!).sort()).toEqual(["entryId", "excerpt", "locale", "rank", "slug", "title", "translationId", "type"]);
  });
  it("masque tout montant, et ne touche pas les autres nombres", () => {
    const prix = [`12 ${E}`, `12${E}`, `${E}12`, `1 200,50 ${E}`, `1.200 ${E}`, "49 euros", "49 Euros", "30 EUR", "$30", "30 $", "30 dollars", `2k${E}`, `à partir de 99${E} par mois`];
    for (const p of prix) {
      const m = masquerMontants(`Offre ${p} ici`);
      expect(m, p).not.toMatch(/\u20ac|\$|euro|eur\b|dollar/i);
      expect(m, p).not.toMatch(/\d/);
      expect(contientMontant(`Offre ${p} ici`), p).toBe(true);
    }
    const sains = "Plus de 12 000 clients, 100 % des cas, 30 jours, 3 étapes, en 2026.";
    expect(masquerMontants(sains)).toBe(sains);
    expect(contientMontant(sains)).toBe(false);
    expect(masquerMontants("")).toBe("");
  });
});

describe("critère 1 — réglage absent ou faux : aucune requête, « lecture du site éteinte »", () => {
  const cas: [string, () => Promise<void>][] = [
    ["réglage absent", async () => undefined],
    ["réglage faux", async () => ecrireParametre(REGLAGE_LECTURE_SITE, false)],
    ["réglage texte « true »", async () => ecrireParametre(REGLAGE_LECTURE_SITE, "true")],
    ["réglage 1", async () => ecrireParametre(REGLAGE_LECTURE_SITE, 1)],
  ];
  for (const [nom, preparer] of cas) {
    it(nom, async () => {
      await preparer();
      const s = fauxSite();
      const r = await chercherFaitsSite("relances", { env: ENV, fetchImpl: s.f });
      expect(s.mock).toHaveBeenCalledTimes(0);
      expect(r.etat).toBe("eteinte");
      expect(r.faits).toEqual([]);
      expect(r.message).toMatch(/lecture du site éteinte/i);
    });
  }
  it("réglage vrai mais SITE_KB_URL absente ou invalide : éteinte, zéro appel", async () => {
    await ecrireParametre(REGLAGE_LECTURE_SITE, true);
    for (const env of [{}, { SITE_KB_URL: "" }, { SITE_KB_URL: "n'importe quoi" }]) {
      const s = fauxSite();
      const r = await chercherFaitsSite("relances", { env, fetchImpl: s.f });
      expect(s.mock).toHaveBeenCalledTimes(0);
      expect(r.etat).toBe("eteinte");
    }
  });
  it("lecture du réglage impossible : éteinte, zéro appel", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base absente"));
    const s = fauxSite();
    const r = await chercherFaitsSite("relances", { env: ENV, fetchImpl: s.f });
    expect(s.mock).toHaveBeenCalledTimes(0);
    expect(r.etat).toBe("eteinte");
  });
  it("le réglage est relu à chaque recherche (bascule sans redémarrage)", async () => {
    const s = fauxSite();
    await ecrireParametre(REGLAGE_LECTURE_SITE, true);
    expect((await chercherFaitsSite("a", { env: ENV, fetchImpl: s.f })).etat).toBe("ok");
    await ecrireParametre(REGLAGE_LECTURE_SITE, false);
    expect((await chercherFaitsSite("a", { env: ENV, fetchImpl: s.f })).etat).toBe("eteinte");
    expect(s.mock).toHaveBeenCalledTimes(1);
  });
});

describe("critère 2 — réglage vrai : seulement GET /api/internal/kb/search", () => {
  beforeEach(async () => ecrireParametre(REGLAGE_LECTURE_SITE, true));

  it("un seul appel GET, bons paramètres, sans signature, sans ingest", async () => {
    const s = fauxSite({ corps: { hits: [hit(1), hit(2)], total: 2 } });
    const r = await chercherFaitsSite("  relances clients ", { env: ENV, fetchImpl: s.f });
    expect(s.mock).toHaveBeenCalledTimes(1);
    const { url, init } = s.appels[0]!;
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${SITE}/api/internal/kb/search`);
    expect(u.pathname).not.toContain("ingest");
    expect(u.searchParams.get("q")).toBe("relances clients");
    expect(u.searchParams.get("locale")).toBe("fr");
    expect(Number(u.searchParams.get("limit"))).toBeLessThanOrEqual(10);
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeDefined();
    const entetes = Object.keys((init?.headers ?? {}) as Record<string, string>).map((k) => k.toLowerCase());
    for (const interdit of ["authorization", "x-signature", "x-kb-signature", "x-hub-signature", "x-hub-signature-256", "content-type"]) expect(entetes).not.toContain(interdit);
    expect(entetes.filter((k) => k.includes("sign") || k.includes("secret") || k.includes("token"))).toEqual([]);
    expect(r.etat).toBe("ok");
    expect(r.faits.map((h) => h.entryId)).toEqual(["entree-1", "entree-2"]);
  });
  it("une base avec chemin ou barre finale reste sous le même point d'entrée", async () => {
    const s = fauxSite();
    await chercherFaitsSite("x", { env: { SITE_KB_URL: `${SITE}/` }, fetchImpl: s.f });
    expect(new URL(s.appels[0]!.url).pathname).toBe("/api/internal/kb/search");
  });
  it("recherche vide : aucun appel, message simple", async () => {
    const s = fauxSite();
    for (const q of ["", "   ", "\n\t"]) {
      const r = await chercherFaitsSite(q, { env: ENV, fetchImpl: s.f });
      expect(r.etat).toBe("vide");
      expect(r.faits).toEqual([]);
      expect(r.message.length).toBeGreaterThan(0);
    }
    expect(s.mock).toHaveBeenCalledTimes(0);
  });
  it("jamais plus d'un appel par recherche, et un plafond de cadence sous les 30 par minute du site", async () => {
    const s = fauxSite();
    let refus = 0;
    for (let i = 0; i < 40; i++) {
      const r = await chercherFaitsSite(`q${i}`, { env: ENV, fetchImpl: s.f });
      if (r.etat === "trop-rapide") refus++;
    }
    expect(s.mock.mock.calls.length).toBeLessThan(30);
    expect(refus).toBeGreaterThan(0);
    expect(s.mock.mock.calls.length + refus).toBe(40);
  });
});

describe("critère 3 — réponses du faux serveur validées, erreurs sans exception", () => {
  beforeEach(async () => ecrireParametre(REGLAGE_LECTURE_SITE, true));

  const erreurs: [string, Reponse][] = [
    ["400", { statut: 400, corps: { error: "invalid" } }],
    ["429", { statut: 429, corps: { error: "rate" } }],
    ["500", { statut: 500, texte: "boom" }],
    ["404", { statut: 404, texte: "" }],
    ["302 sans suite", { statut: 302, texte: "" }],
    ["JSON illisible", { texte: "{pas du json" }],
    ["corps vide", { texte: "" }],
    ["hits absent", { corps: { total: 1 } }],
    ["hits d'un mauvais type", { corps: { hits: "oui" } }],
    ["réseau coupé", { jette: true }],
  ];
  for (const [nom, rep] of erreurs) {
    it(`${nom} : liste vide, message simple, sans exception`, async () => {
      const s = fauxSite(rep);
      const r = await chercherFaitsSite("relances", { env: ENV, fetchImpl: s.f });
      expect(r.faits).toEqual([]);
      expect(r.etat).not.toBe("ok");
      expect(r.message.length).toBeGreaterThan(0);
      expect(r.message).not.toMatch(/boom|Error|undefined|stack/i);
      expect(s.mock).toHaveBeenCalledTimes(1);
    });
  }
  it("429 : message qui invite à patienter", async () => {
    const r = await chercherFaitsSite("x", { env: ENV, fetchImpl: fauxSite({ statut: 429 }).f });
    expect(r.etat).toBe("trop-rapide");
    expect(r.message).toMatch(/minute/i);
  });
  it("délai dépassé : liste vide, sans exception", async () => {
    const s = fauxSite({ pendu: true });
    const r = await chercherFaitsSite("relances", { env: ENV, fetchImpl: s.f, delaiMs: 20 });
    expect(r.etat).toBe("erreur");
    expect(r.faits).toEqual([]);
    expect(r.message).toMatch(/délai|trop long|réessayez/i);
  });
  it("une réponse correcte mais sans résultat : « vide », message qui le dit", async () => {
    const r = await chercherFaitsSite("x", { env: ENV, fetchImpl: fauxSite({ corps: { hits: [], total: 0 } }).f });
    expect(r.etat).toBe("vide");
    expect(r.message).toMatch(/aucun/i);
  });
  it("mélange bon et mauvais : seuls les bons restent", async () => {
    const s = fauxSite({ corps: { hits: [hit(1), { entryId: "x" }, null, hit(2, { rank: "n" }), hit(3)], total: 5 } });
    const r = await chercherFaitsSite("x", { env: ENV, fetchImpl: s.f });
    expect(r.faits.map((h) => h.entryId)).toEqual(["entree-1", "entree-3"]);
    expect(r.etat).toBe("ok");
  });
  it("ne suit aucune redirection hors du site", async () => {
    const s = fauxSite();
    await chercherFaitsSite("x", { env: ENV, fetchImpl: s.f });
    expect(["error", "manual"]).toContain(s.appels[0]!.init?.redirect);
  });
});

describe("critère 5 — aucun montant à l'écran : extrait masqué", () => {
  beforeEach(async () => ecrireParametre(REGLAGE_LECTURE_SITE, true));
  it("un extrait ou un titre avec « € » ressort masqué", async () => {
    const s = fauxSite({ corps: { hits: [hit(1, { excerpt: `Le forfait coûte 49 ${E} par mois, soit 1 200,50 ${E} par an.`, title: `Offre à 99${E}` })] } });
    const r = await chercherFaitsSite("forfait", { env: ENV, fetchImpl: s.f });
    expect(r.faits).toHaveLength(1);
    expect(r.faits[0]!.excerpt).not.toMatch(/\u20ac|\d{2}/);
    expect(r.faits[0]!.title).not.toMatch(/\u20ac|99/);
    expect(r.faits[0]!.excerpt).toContain("par mois");
  });
});

describe("critère 4 — « Proposer comme preuve » : a-valider, machine, jamais disponible", () => {
  const H = () => validerReponseRecherche({ hits: [hit(1, { excerpt: "Les relances automatiques réduisent les retards de paiement.", title: "Relances" })] })[0]!;

  it("crée une Preuve a-valider / machine / source { titre, url, date }", async () => {
    const { preuve } = await proposerPreuveDepuisSite(H(), { env: ENV });
    const lue = await depots().preuves.obtenir(preuve.id);
    expect(lue).toBeTruthy();
    expect(lue!.statut).toBe("a-valider");
    expect(lue!.saisiePar).toBe("machine");
    expect(lue!.valideeLe).toBeUndefined();
    expect(lue!.source.titre).toBe("Relances");
    expect(lue!.source.url).toBeTruthy();
    expect(new URL(lue!.source.url!).origin).toBe(SITE);
    expect(lue!.source.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(lue!.enonce).toContain("relances automatiques");
  });
  it("n'invente aucune adresse de fiche : l'adresse est celle de la recherche", async () => {
    const { preuve } = await proposerPreuveDepuisSite(H(), { env: ENV });
    const u = new URL(preuve.source.url!);
    expect(u.pathname).toBe("/api/internal/kb/search");
    expect(u.pathname).not.toContain("question-1");
  });
  it("sans SITE_KB_URL : la preuve est créée sans adresse", async () => {
    const { preuve } = await proposerPreuveDepuisSite(H(), { env: {} });
    expect(preuve.source.url).toBeUndefined();
    expect(preuve.statut).toBe("a-valider");
  });
  it("preuveDisponible reste faux tant que le fondateur n'a pas validé, même bien plus tard", async () => {
    const { preuve } = await proposerPreuveDepuisSite(H(), { env: ENV });
    for (const t of ["2026-11-12T10:00:00.000Z", "2027-06-01T10:00:00.000Z", "2030-01-01T00:00:00.000Z"]) {
      expect(preuveDisponible(preuve, t), t).toBe(false);
    }
    expect(preuveDisponible({ ...preuve, statut: "validee" }, "2026-11-12T10:00:00.000Z")).toBe(true); // contrôle : seule la validation ouvre
  });
  it("la liste « Chiffres et preuves » ne la donne pas comme disponible", async () => {
    const { listerPreuves } = await import("@/services/preuves");
    await proposerPreuveDepuisSite(H(), { env: ENV });
    const vues = await listerPreuves();
    expect(vues).toHaveLength(1);
    expect(vues[0]!.disponible).toBe(false);
  });
  it("le rejeu ne crée pas de doublon", async () => {
    const a = await proposerPreuveDepuisSite(H(), { env: ENV });
    const b = await proposerPreuveDepuisSite(H(), { env: ENV });
    expect(b.preuve.id).toBe(a.preuve.id);
    expect(await depots().preuves.lister()).toHaveLength(1);
  });
  it("un résultat mal formé venu de l'écran est refusé, rien n'est écrit", async () => {
    for (const mauvais of [null, {}, { ...hit(1), rank: "x" }, { ...hit(1), title: "" }, "texte", 3]) {
      await expect(proposerPreuveDepuisSite(mauvais as never, { env: ENV })).rejects.toThrow();
    }
    expect(await depots().preuves.lister()).toHaveLength(0);
  });
  it("sans session : refusé, rien n'est écrit", async () => {
    reinitialiserRequete();
    await expect(proposerPreuveDepuisSite(H(), { env: ENV })).rejects.toThrow();
    expect(await depots().preuves.lister()).toHaveLength(0);
  });
  it("un extrait avec un prix est enregistré masqué, jamais en clair", async () => {
    const h = validerReponseRecherche({ hits: [hit(1, { excerpt: `Le forfait coûte 49 ${E} par mois.`, title: `Forfait à 49 ${E}` })] })[0]!;
    const { preuve } = await proposerPreuveDepuisSite(h, { env: ENV });
    expect(preuve.enonce).not.toMatch(/\u20ac|49/);
    expect(preuve.source.titre).not.toMatch(/\u20ac|49/);
  });
  it("un extrait vide garde le titre comme énoncé", async () => {
    const h = validerReponseRecherche({ hits: [hit(1, { excerpt: "   ", title: "Titre seul" })] })[0]!;
    const { preuve } = await proposerPreuveDepuisSite(h, { env: ENV });
    expect(preuve.enonce).toBe("Titre seul");
  });
  it("aucun appel réseau pendant la proposition", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await proposerPreuveDepuisSite(H(), { env: ENV });
    vi.unstubAllGlobals();
    expect(f).toHaveBeenCalledTimes(0);
  });
});
