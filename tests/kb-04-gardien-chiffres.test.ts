/**
 * KB-04 — gardien des chiffres clés : contrôle SANS IA qui compare le site, l'usine et les preuves validées du Studio.
 * Il alerte par la cloche, ne bloque rien, ne montre aucune valeur. Tout en doublure locale (faux site, dépôts en mémoire,
 * lecteur d'usine injecté) : aucun appel réel. Valeurs inventées.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { reinitialiserCadenceSite, REGLAGE_LECTURE_SITE } = await import("@/services/kb-site");
const dom = await import("@/domaine/gardien-chiffres");
const { controlerChiffresCles, REGLAGE_GARDIEN_CHIFFRES } = await import("@/services/gardien-chiffres");
const actions = await import("@/app/(studio)/reglages/base-connaissances/actions");
const { preuveParDefaut } = await import("@/domaine/preuves-saisie");
const { nouvelId } = await import("@/lib/ids");

const MDP = "essai-kb-04-gardien";
const SITE = "https://site.exemple.fr";
const ENV = { SITE_KB_URL: SITE };
const E = String.fromCharCode(0x20ac);
/** Ce que la cloche n'a pas le droit de contenir. */
const INTERDIT = /\d|€|euro/i;

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

/** Faux site : répond selon les mots de la recherche. `parCode` = extrait renvoyé pour chaque chiffre clé. */
function fauxSite(extraits: Partial<Record<string, string>>, opts: { statut?: number } = {}) {
  const requetes: string[] = [];
  const f = vi.fn(async (entree: RequestInfo | URL) => {
    const u = new URL(String(entree));
    const q = u.searchParams.get("q") ?? "";
    requetes.push(q);
    if (opts.statut) return new Response("{}", { status: opts.statut });
    const cle = dom.CHIFFRES_CLES.find((c) => c.requete === q);
    const texte = cle ? extraits[cle.code] : undefined;
    const hits = texte
      ? [{ entryId: "e-" + cle!.code, translationId: "t-" + cle!.code, type: "faq", slug: "s-" + cle!.code, title: "Fait fictif", excerpt: texte, locale: "fr", rank: 0.9 }]
      : [];
    return new Response(JSON.stringify({ hits, total: hits.length }), { status: 200 });
  });
  return { f: f as unknown as typeof fetch, mock: f, requetes };
}

async function allumer(site = true) {
  await ecrireParametre(REGLAGE_GARDIEN_CHIFFRES, true);
  if (site) await ecrireParametre(REGLAGE_LECTURE_SITE, true);
}

async function poserPreuve(enonce: string, valeurs?: { brut: string; normalise: number; unite?: string }[], surcharge: Record<string, unknown> = {}) {
  const base = preuveParDefaut({ enonce }, new Date().toISOString());
  const p = { ...base, id: nouvelId("preuve"), statut: "validee" as const, valideeLe: new Date().toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString(), ...(valeurs ? { valeurs } : {}), ...surcharge };
  await depots().preuves.enregistrer(p as never);
  return p;
}

const code = (c: string) => dom.CHIFFRES_CLES.find((x) => x.code === c)!;
const cloche = async () => (await depots().notifications.lister()).filter((n) => n.titre === dom.TITRE_NOTIFICATION_GARDIEN);

describe("domaine : extraction et comparaison pures", () => {
  it("la liste des chiffres clés porte des libellés, jamais un montant", () => {
    expect(dom.CHIFFRES_CLES.map((c) => c.code).sort()).toEqual(["duree-journee", "duree-rdv", "garantie", "prix-journee"]);
    for (const c of dom.CHIFFRES_CLES) expect(`${c.libelle} ${c.requete}`).not.toMatch(INTERDIT);
  });

  it("durées : « 1h30 », « 90 minutes » et « 1,5 heure » donnent la même valeur", () => {
    const d = code("duree-rdv");
    expect(dom.extraireValeur("Le rendez-vous dure 1h30.", d)).toBe(90);
    expect(dom.extraireValeur("Le rendez-vous dure 90 minutes.", d)).toBe(90);
    expect(dom.extraireValeur("Le rendez-vous dure 1,5 heure.", d)).toBe(90);
    expect(dom.extraireValeur("Le rendez-vous dure 7 heures", code("duree-journee"))).toBeNull(); // mots absents (rendez-vous, pas journée)
    expect(dom.extraireValeur("La Journée IA dure 7 heures.", code("duree-journee"))).toBe(420);
  });

  it("garantie : « 30 jours » et « 1 mois » s'accordent", () => {
    const g = code("garantie");
    expect(dom.extraireValeur("Garantie de 30 jours.", g)).toBe(30);
    expect(dom.extraireValeur("Garantie de 1 mois.", g)).toBe(30);
    expect(dom.extraireValeur("Garantie de 2 semaines.", g)).toBe(14);
  });

  it("prix : nombre + devise ; un montant masqué ne donne rien", () => {
    const p = code("prix-journee");
    expect(dom.extraireValeur(`La journée IA coûte 1 200 ${E}.`, p)).toBe(1200);
    expect(dom.extraireValeur(`La journée IA : 99,50 euros.`, p)).toBe(99.5);
    expect(dom.extraireValeur("La journée IA coûte [montant masqué].", p)).toBeNull();
  });

  it("cas limites : vide, sans nombre, deux valeurs différentes (ambigu), même valeur répétée", () => {
    const d = code("duree-rdv");
    expect(dom.extraireValeur("", d)).toBeNull();
    expect(dom.extraireValeur("Le rendez-vous est gratuit.", d)).toBeNull();
    expect(dom.extraireValeur("Le rendez-vous dure 30 minutes ou 45 minutes.", d)).toBeNull();
    expect(dom.extraireValeur("Le rendez-vous dure 30 minutes, soit une demi-heure : 30 min.", d)).toBe(30);
    expect(dom.extraireValeur("Le rendez-vous dure 0 minute.", d)).toBe(0);
  });

  it("comparer : accord, écart, non comparé (une seule source ou aucune)", () => {
    expect(dom.comparer({ site: 90, preuve: 90, usine: null }).verdict).toBe("accord");
    expect(dom.comparer({ site: 90, preuve: 60, usine: null })).toMatchObject({ verdict: "ecart", sources: ["site", "preuve"] });
    expect(dom.comparer({ site: 90, preuve: null, usine: null }).verdict).toBe("non-compare");
    expect(dom.comparer({ site: null, preuve: null, usine: null }).verdict).toBe("non-compare");
    expect(dom.comparer({ site: 90, preuve: 90, usine: 60 })).toMatchObject({ verdict: "ecart", sources: ["site", "preuve", "usine"] });
    expect(dom.comparer({ site: 90.001, preuve: 90, usine: null }).verdict).toBe("accord"); // arrondi à 2 décimales
  });

  it("la phrase nomme la donnée et les sources, sans chiffre ni monnaie", () => {
    for (const c of dom.CHIFFRES_CLES) {
      const t = dom.phraseEcart(c, ["site", "preuve"]);
      expect(t).not.toMatch(INTERDIT);
      expect(t).toContain(c.libelle);
    }
    expect(dom.phraseEcart(code("duree-rdv"), ["site", "preuve"])).toBe("Écart sur la durée du rendez-vous gratuit entre le site et une preuve du Studio");
    expect(dom.phraseEcart(code("garantie"), ["site", "preuve", "usine"])).toBe("Écart sur la garantie entre le site, une preuve du Studio et la base de l'usine");
  });

  it("l'empreinte dépend de la donnée et des valeurs, pas de l'ordre", () => {
    const a = dom.empreinteEcart("garantie", { site: 30, preuve: 14, usine: null });
    expect(a).toBe(dom.empreinteEcart("garantie", { usine: null, preuve: 14, site: 30 }));
    expect(a).not.toBe(dom.empreinteEcart("garantie", { site: 30, preuve: 7, usine: null }));
    expect(a).not.toBe(dom.empreinteEcart("duree-rdv", { site: 30, preuve: 14, usine: null }));
    expect(a).not.toMatch(/30|14/);
  });
});

describe("critère 1 — réglage éteint : rien n'est lu, rien n'est envoyé", () => {
  for (const [nom, valeur] of [["absent", undefined], ["faux", false], ["« true » texte", "true"], ["1", 1]] as const) {
    it(`réglage ${nom}`, async () => {
      if (valeur !== undefined) await ecrireParametre(REGLAGE_GARDIEN_CHIFFRES, valeur);
      await ecrireParametre(REGLAGE_LECTURE_SITE, true);
      await poserPreuve("Le rendez-vous gratuit dure 60 minutes.");
      const site = fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." });
      const lister = vi.spyOn(depots().preuves, "lister");
      const usine = vi.fn(async () => 15);
      const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f, lecteurUsine: usine });
      expect(r.etat).toBe("eteint");
      expect(r.donnees).toEqual([]);
      expect(site.mock).toHaveBeenCalledTimes(0);
      expect(lister).toHaveBeenCalledTimes(0);
      expect(usine).toHaveBeenCalledTimes(0);
      expect(await cloche()).toHaveLength(0);
    });
  }

  it("lecture du réglage impossible : on reste éteint", async () => {
    vi.spyOn(depots().parametres, "obtenir").mockRejectedValue(new Error("base coupée"));
    const site = fauxSite({});
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(r.etat).toBe("eteint");
    expect(site.mock).toHaveBeenCalledTimes(0);
  });

  it("le réglage par défaut est faux", async () => {
    expect(await lireParametre(REGLAGE_GARDIEN_CHIFFRES, false)).toBe(false);
    expect(REGLAGE_GARDIEN_CHIFFRES).toBe("gardien.chiffres.actif");
  });
});

describe("critère 2 — accord, écart, non comparé", () => {
  it("accord : même valeur normalisée des deux côtés (1h30 / 90 min), aucune notification", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 90 minutes.", [{ brut: "90 minutes", normalise: 90, unite: "min" }]);
    const site = fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 1h30." });
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(r.donnees.find((d) => d.code === "duree-rdv")?.verdict).toBe("accord");
    expect(await cloche()).toHaveLength(0);
  });

  it("écart : valeurs différentes", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60 minutes", normalise: 60, unite: "min" }]);
    const site = fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." });
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(r.donnees.find((d) => d.code === "duree-rdv")?.verdict).toBe("ecart");
    expect(r.notifications).toBe(1);
  });

  it("non comparé : une seule source, ou site illisible / en erreur", async () => {
    await allumer();
    await poserPreuve("La garantie est de 30 jours.", [{ brut: "30 jours", normalise: 30, unite: "jour" }]);
    const seul = await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({}).f });
    for (const d of seul.donnees) expect(d.verdict).toBe("non-compare");
    const panne = await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({}, { statut: 500 }).f });
    for (const d of panne.donnees) expect(d.verdict).toBe("non-compare");
    expect(await cloche()).toHaveLength(0);
  });

  it("porte du site éteinte (réglage KB-02 faux) : côté site non comparé, aucun appel", async () => {
    await allumer(false);
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }]);
    const site = fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." });
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(site.mock).toHaveBeenCalledTimes(0);
    expect(r.donnees.find((d) => d.code === "duree-rdv")?.verdict).toBe("non-compare");
  });

  it("seules les preuves VALIDÉES, non archivées, non retirées et non périmées comptent", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }], { statut: "a-valider" });
    await poserPreuve("Le rendez-vous gratuit dure 61 minutes.", [{ brut: "61", normalise: 61, unite: "min" }], { archiveLe: new Date().toISOString() });
    await poserPreuve("Le rendez-vous gratuit dure 62 minutes.", [{ brut: "62", normalise: 62, unite: "min" }], { retrait: { le: new Date().toISOString(), motif: "autre" } });
    await poserPreuve("Le rendez-vous gratuit dure 63 minutes.", [{ brut: "63", normalise: 63, unite: "min" }], { perimeLe: "2000-01-01T00:00:00.000Z" });
    const site = fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." });
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(r.donnees.find((d) => d.code === "duree-rdv")?.verdict).toBe("non-compare");
    expect(await cloche()).toHaveLength(0);
  });

  it("preuves qui se contredisent entre elles : côté Studio non comparé (pas d'alerte inventée)", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }]);
    await poserPreuve("Le rendez-vous gratuit dure 45 minutes.", [{ brut: "45", normalise: 45, unite: "min" }]);
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." }).f });
    expect(r.donnees.find((d) => d.code === "duree-rdv")?.verdict).toBe("non-compare");
  });

  it("l'usine : lecteur injecté ; par défaut « non relié »", async () => {
    await allumer();
    await poserPreuve("La garantie est de 30 jours.", [{ brut: "30 jours", normalise: 30, unite: "jour" }]);
    const site = fauxSite({ garantie: "La garantie est de 30 jours." });
    const defaut = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(defaut.donnees.find((d) => d.code === "garantie")).toMatchObject({ verdict: "accord", usineRelie: false });
    const usine = vi.fn(async (c: string) => (c === "garantie" ? 14 : null));
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ garantie: "La garantie est de 30 jours." }).f, lecteurUsine: usine });
    expect(r.donnees.find((d) => d.code === "garantie")).toMatchObject({ verdict: "ecart", usineRelie: true });
    const [n] = await cloche();
    expect(n.message).toBe("Écart sur la garantie entre le site, une preuve du Studio et la base de l'usine");
  });

  it("lecteur d'usine qui plante ou rend n'importe quoi : traité comme non relié, jamais d'exception", async () => {
    await allumer();
    await poserPreuve("La garantie est de 30 jours.", [{ brut: "30", normalise: 30, unite: "jour" }]);
    for (const lecteur of [async () => { throw new Error("hors ligne"); }, async () => Number.NaN, async () => ("x" as never)]) {
      const r = await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ garantie: "La garantie est de 30 jours." }).f, lecteurUsine: lecteur });
      expect(r.donnees.find((d) => d.code === "garantie")?.verdict).toBe("accord");
    }
  });

  it("une requête par chiffre clé, jamais plus de 30 par minute, même en rejouant le contrôle", async () => {
    await allumer();
    const site = fauxSite({});
    await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(site.requetes.sort()).toEqual(dom.CHIFFRES_CLES.map((c) => c.requete).sort());
    for (let i = 0; i < 20; i++) await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(site.mock.mock.calls.length).toBeLessThanOrEqual(30);
  });
});

describe("critère 3 — une notification cloche, sans chiffre ni monnaie", () => {
  it("écart : UNE notification « info », cloche seulement, texte nommant donnée et sources", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60 minutes", normalise: 60, unite: "min" }]);
    await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." }).f });
    const liste = await cloche();
    expect(liste).toHaveLength(1);
    const n = liste[0];
    expect(n.type).toBe("info");
    expect(n.envoi).toBeUndefined(); // cloche seulement : ni courriel ni push (aucune file d'envoi)
    expect(n.lue).toBe(false);
    expect(n.message).toBe("Écart sur la durée du rendez-vous gratuit entre le site et une preuve du Studio");
    expect(`${n.titre} ${n.message} ${n.lien ?? ""}`).not.toMatch(INTERDIT);
  });

  it("même pour un écart de prix : aucun chiffre ni symbole, nulle part (cloche, résultat, réglages)", async () => {
    await allumer();
    await poserPreuve(`La journée IA coûte 900 ${E}.`, [{ brut: `900 ${E}`, normalise: 900, unite: "eur" }]);
    const site = fauxSite({ "prix-journee": `La journée IA coûte 1 200 ${E}.` });
    // la porte du site masque les montants : le prix du site n'est jamais lisible → non comparé, pas d'alerte, rien à fuiter
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    expect(r.donnees.find((d) => d.code === "prix-journee")?.verdict).toBe("non-compare");
    const tout = JSON.stringify({ r, cloche: await depots().notifications.lister(), p: await depots().parametres.lister() });
    expect(tout).not.toContain("900");
    expect(tout).not.toContain("1 200");
    expect(tout).not.toContain(E);
  });

  it("le résultat ne contient aucune valeur : seulement code, libellé, verdict", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60 minutes", normalise: 60, unite: "min" }]);
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." }).f });
    for (const d of r.donnees) expect(Object.keys(d).sort()).toEqual(["code", "libelle", "usineRelie", "verdict"]);
    expect(JSON.stringify(r)).not.toMatch(/\b(30|60)\b/);
  });

  it("si la création de la notification échoue : pas d'exception, et le contrôle suivant réessaie", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }]);
    const site = () => fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." }).f;
    const spy = vi.spyOn(depots().notifications, "enregistrer").mockRejectedValueOnce(new Error("base coupée"));
    const r = await controlerChiffresCles({ env: ENV, fetchImpl: site() });
    expect(r.donnees.find((d) => d.code === "duree-rdv")?.verdict).toBe("ecart");
    expect(r.notifications).toBe(0);
    spy.mockRestore();
    const r2 = await controlerChiffresCles({ env: ENV, fetchImpl: site() });
    expect(r2.notifications).toBe(1);
    expect(await cloche()).toHaveLength(1);
  });
});

describe("critère 4 — pas de deuxième notification pour le même écart", () => {
  const contexte = async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }]);
  };
  const lancer = (texte: string) => controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ "duree-rdv": texte }).f });

  it("deux contrôles de suite : une seule notification, empreinte gardée dans un paramètre", async () => {
    await contexte();
    await lancer("Le rendez-vous gratuit dure 30 minutes.");
    const r2 = await lancer("Le rendez-vous gratuit dure 30 minutes.");
    expect(r2.notifications).toBe(0);
    expect(await cloche()).toHaveLength(1);
    const params = await depots().parametres.lister();
    expect(JSON.stringify(params)).toContain(dom.REGLAGE_EMPREINTES);
  });

  it("deux contrôles en même temps : une seule notification", async () => {
    await contexte();
    await Promise.all([lancer("Le rendez-vous gratuit dure 30 minutes."), lancer("Le rendez-vous gratuit dure 30 minutes.")]);
    expect(await cloche()).toHaveLength(1);
  });

  it("écart qui change de valeur : nouvelle notification ; retour à l'accord puis nouvel écart : nouvelle notification", async () => {
    await contexte();
    await lancer("Le rendez-vous gratuit dure 30 minutes.");
    await lancer("Le rendez-vous gratuit dure 45 minutes.");
    expect(await cloche()).toHaveLength(2);
    await lancer("Le rendez-vous gratuit dure 60 minutes."); // accord : l'empreinte est oubliée
    await lancer("Le rendez-vous gratuit dure 45 minutes.");
    expect(await cloche()).toHaveLength(3);
  });

  it("la donnée devenue « non comparée » ne rend pas l'ancienne empreinte neuve", async () => {
    await contexte();
    await lancer("Le rendez-vous gratuit dure 30 minutes.");
    await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({}, { statut: 500 }).f }); // site en panne
    await lancer("Le rendez-vous gratuit dure 30 minutes.");
    expect(await cloche()).toHaveLength(1);
  });

  it("un paramètre d'empreintes abîmé est ignoré sans exception", async () => {
    await contexte();
    await ecrireParametre(dom.REGLAGE_EMPREINTES, "n'importe quoi");
    const r = await lancer("Le rendez-vous gratuit dure 30 minutes.");
    expect(r.notifications).toBe(1);
  });
});

describe("critère 5 — le contrôle ne bloque rien et n'écrit rien d'autre", () => {
  it("aucune preuve, matière, script ou publication n'est modifié ; seules la cloche, les empreintes et le dernier résultat s'écrivent", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }]);
    const d = depots();
    const avant = JSON.stringify([await d.preuves.lister(), await d.scriptsMaitres.lister(), await d.scripts.lister(), await d.variantes.lister()]);
    const ecritures = [d.preuves, d.scriptsMaitres, d.scripts, d.variantes].map((x) => vi.spyOn(x, "enregistrer"));
    await controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." }).f });
    for (const s of ecritures) expect(s).not.toHaveBeenCalled();
    expect(JSON.stringify([await d.preuves.lister(), await d.scriptsMaitres.lister(), await d.scripts.lister(), await d.variantes.lister()])).toBe(avant);
  });

  it("un écart ne lève aucune erreur et le résultat dit « ecart » : rien n'est bloqué", async () => {
    await allumer();
    await poserPreuve("Le rendez-vous gratuit dure 60 minutes.", [{ brut: "60", normalise: 60, unite: "min" }]);
    await expect(controlerChiffresCles({ env: ENV, fetchImpl: fauxSite({ "duree-rdv": "Le rendez-vous gratuit dure 30 minutes." }).f })).resolves.toMatchObject({ etat: "fait" });
  });

  it("n'utilise ni écriture vers le site ni autre méthode que GET", async () => {
    await allumer();
    const site = fauxSite({});
    await controlerChiffresCles({ env: ENV, fetchImpl: site.f });
    for (const [, init] of site.mock.mock.calls as unknown as [unknown, RequestInit | undefined][]) expect(init?.method).toBe("GET");
  });
});

describe("actions de la sous-page (session exigée)", () => {
  it("l'interrupteur écrit le réglage ; une valeur non booléenne est refusée", async () => {
    expect((await actions.definirGardienChiffresAction(true)).ok).toBe(true);
    expect(await lireParametre(REGLAGE_GARDIEN_CHIFFRES, false)).toBe(true);
    expect((await actions.definirGardienChiffresAction("oui")).ok).toBe(false);
    expect(await lireParametre(REGLAGE_GARDIEN_CHIFFRES, false)).toBe(true);
    await actions.definirGardienChiffresAction(false);
    expect(await lireParametre(REGLAGE_GARDIEN_CHIFFRES, true)).toBe(false);
  });

  it("« Vérifier maintenant » : éteint, il ne fait rien ; sans session, il est refusé", async () => {
    const r = await actions.verifierChiffresAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnees.etat).toBe("eteint");
    await auth.seDeconnecter();
    await expect(actions.verifierChiffresAction()).rejects.toThrow();
    await expect(actions.definirGardienChiffresAction(true)).rejects.toThrow();
    expect(await lireParametre(REGLAGE_GARDIEN_CHIFFRES, false)).toBe(false);
  });
});
