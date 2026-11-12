/**
 * KB-01 — branchement de la source d'idées du comité éditorial sur la porte de l'usine, derrière un réglage éteint.
 * Tout en doublure locale : faux serveur (fetch injecté), dépôts en mémoire. Aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";
import { ecrireParametre } from "@/services/_commun";
import { brancherIdeesUsine, REGLAGE_SOURCE_USINE } from "@/services/branchement-idees-usine";
import { brancherSourceIdees, sourceIdees } from "@/services/source-idees";

const SECRET = "t".repeat(40);
const ENV = { USINE_URL: "https://usine.exemple.fr", USINE_PORTE_SECRET: SECRET };

function ligne(signature: string) {
  return {
    signature,
    parts: { metier: "m1", douleur: null },
    metier: { code: "m1", libelle: "Expert-comptable" },
    taille: { code: "PME", libelle: "PME" },
    service: { code: "s1", libelle: "Audit" },
    douleur: { code: "d1", dite: `Douleur fictive ${signature}` },
    cas_usage: { code: "c1", titre: "Relances", ce_que_ca_change: "Les pièces arrivent à temps." },
    sujet: { code: "j1", titre: "L'audit sans stress" },
    format: { code: "f1", libelle: "Tableau animé" },
    accroche: { code: "a1", famille: "scène vécue" },
    fins: { x: { dit: "Et vous ?" } },
  };
}

/** Faux serveur : 5 lignes neuves par appel, ou une réponse d'erreur. */
function fauxServeur(comportement: { statut?: number; repete?: boolean; vide?: boolean } = {}) {
  let compteur = 0;
  const appels: { url: string; corps: Record<string, unknown> | null }[] = [];
  const f = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree);
    appels.push({ url, corps: init?.body ? JSON.parse(init.body as string) : null });
    if (comportement.statut && comportement.statut !== 200) return new Response(JSON.stringify({ erreur: "non", code: "x" }), { status: comportement.statut });
    const lignes = comportement.vide ? [] : Array.from({ length: 5 }, (_, i) => ligne(comportement.repete ? `rep-${i}` : `sig-${compteur++}`));
    return new Response(JSON.stringify({ demandees: 5, pourquoi: [], lignes }), { status: 200 });
  });
  return { f: f as unknown as typeof fetch, mock: f, appels };
}

beforeEach(() => {
  reinitialiserDepots();
  brancherSourceIdees(null);
});
afterEach(() => {
  brancherSourceIdees(null);
  vi.unstubAllGlobals();
});

describe("KB-01 — réglage éteint par défaut", () => {
  it("le réglage s'appelle comite.source_usine.actif", () => {
    expect(REGLAGE_SOURCE_USINE).toBe("comite.source_usine.actif");
  });

  it("réglage absent : simulation, la porte n'est jamais appelée", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    const r = await sourceIdees().tirer(30);
    expect(r).toHaveLength(30);
    expect(sourceIdees().simulee).toBe(true);
    expect(s.mock).toHaveBeenCalledTimes(0);
  });

  it("réglage faux (et toute valeur autre que vrai) : simulation, zéro appel", async () => {
    for (const v of [false, "true", 1, null]) {
      const s = fauxServeur();
      await ecrireParametre(REGLAGE_SOURCE_USINE, v);
      brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
      await sourceIdees().tirer(30);
      expect(sourceIdees().simulee).toBe(true);
      expect(s.mock).toHaveBeenCalledTimes(0);
    }
  });

  it("réglage vrai mais usine non reliée (URL, secret absent ou trop court) : simulation, zéro appel", async () => {
    await ecrireParametre(REGLAGE_SOURCE_USINE, true);
    for (const env of [{}, { USINE_URL: ENV.USINE_URL }, { USINE_PORTE_SECRET: SECRET }, { USINE_URL: ENV.USINE_URL, USINE_PORTE_SECRET: "court" }, { USINE_URL: "  ", USINE_PORTE_SECRET: SECRET }]) {
      const s = fauxServeur();
      brancherIdeesUsine({ env, fetchImpl: s.f });
      const r = await sourceIdees().tirer(30);
      expect(r).toHaveLength(30);
      expect(sourceIdees().simulee).toBe(true);
      expect(s.mock).toHaveBeenCalledTimes(0);
    }
  });

  it("lecture du réglage impossible (erreur du dépôt) : simulation, zéro appel, aucune exception", async () => {
    const s = fauxServeur();
    const d = await import("@/donnees/memoire");
    const spy = vi.spyOn(d.depots().parametres, "obtenir").mockRejectedValue(new Error("base absente"));
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await expect(sourceIdees().tirer(30)).resolves.toHaveLength(30);
    expect(sourceIdees().simulee).toBe(true);
    expect(s.mock).toHaveBeenCalledTimes(0);
    spy.mockRestore();
  });
});

describe("KB-01 — réglage vrai et usine reliée (faux serveur)", () => {
  beforeEach(async () => {
    await ecrireParametre(REGLAGE_SOURCE_USINE, true);
  });

  it("un lot de 30 rend au plus 30 combinaisons neuves, sans doublon, simulee = faux", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    const r = await sourceIdees().tirer(30);
    expect(r).toHaveLength(30);
    expect(new Set(r.map((c) => c.signature)).size).toBe(30);
    expect(sourceIdees().simulee).toBe(false);
    expect(s.mock).toHaveBeenCalledTimes(6);
  });

  it("un lot de 7 : deux appels de 5, au plus 7 rendus", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    expect(await sourceIdees().tirer(7)).toHaveLength(7);
    expect(s.mock).toHaveBeenCalledTimes(2);
  });

  it("lot de 0 ou négatif : liste vide, aucun appel", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    expect(await sourceIdees().tirer(0)).toEqual([]);
    expect(await sourceIdees().tirer(-3)).toEqual([]);
    expect(s.mock).toHaveBeenCalledTimes(0);
  });

  it("le serveur répète les mêmes signatures : aucun doublon rendu", async () => {
    const s = fauxServeur({ repete: true });
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    const r = await sourceIdees().tirer(30);
    expect(new Set(r.map((c) => c.signature)).size).toBe(r.length);
    expect(r.length).toBeLessThanOrEqual(5);
  });

  it("conversion IdeeUsine → CombinaisonUsine : parts gardées, textes metier…fin, famille → familleAccroche", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    const [c] = await sourceIdees().tirer(1);
    expect(c.signature).toBe("sig-0");
    expect(c.parts).toEqual({ metier: "m1", douleur: null });
    expect(c.textes).toEqual({
      metier: "Expert-comptable",
      taille: "PME",
      service: "Audit",
      douleur: "Douleur fictive sig-0",
      casUsage: "Relances · Les pièces arrivent à temps.",
      sujet: "L'audit sans stress",
      format: "Tableau animé",
      familleAccroche: "scène vécue",
      fin: "Et vous ?",
    });
    expect(Object.keys(c.textes)).not.toContain("famille");
  });

  it("filtres envoyés : vidéo, réseaux de déclinaison, ni métiers ni tailles, n = 5, secret en Bearer", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await sourceIdees().tirer(5);
    expect(s.appels).toHaveLength(1);
    expect(s.appels[0].url).toBe("https://usine.exemple.fr/api/porte/sujets");
    expect(s.appels[0].corps).toEqual({ n: 5, type_contenu: "video", reseaux: [...RESEAUX_DECLINAISON] });
    const init = s.mock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(init.method).toBe("POST");
  });

  it("RESEAUX_DECLINAISON compte au plus 6 réseaux (limite de la porte de l'usine)", () => {
    expect(RESEAUX_DECLINAISON.length).toBeLessThanOrEqual(6);
  });

  it("jamais de « retenir » : le faux serveur ne voit que /api/porte/sujets, en POST", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await sourceIdees().tirer(30);
    expect(s.appels.length).toBeGreaterThan(0);
    for (const a of s.appels) expect(new URL(a.url).pathname).toBe("/api/porte/sujets");
    expect(s.appels.some((a) => a.url.includes("retenir"))).toBe(false);
  });

  it.each([401, 403, 404, 413, 500])("faux serveur en erreur %i : liste vide, aucune exception, rien de simulé", async (statut) => {
    const s = fauxServeur({ statut });
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await expect(sourceIdees().tirer(30)).resolves.toEqual([]);
    expect(sourceIdees().simulee).toBe(false);
    expect(s.mock).toHaveBeenCalledTimes(1); // arrêt au premier échec
  });

  it("délai dépassé : liste vide, aucune exception, arrêt au premier échec", async () => {
    const f = vi.fn((_u: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, rejeter) => {
      init?.signal?.addEventListener("abort", () => rejeter(Object.assign(new Error("abandon"), { name: "AbortError" })));
    }));
    brancherIdeesUsine({ env: ENV, fetchImpl: f as unknown as typeof fetch, delaiMs: 20 });
    await expect(sourceIdees().tirer(30)).resolves.toEqual([]);
    expect(sourceIdees().simulee).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("réseau injoignable (fetch qui lève) : liste vide, aucune exception", async () => {
    const f = vi.fn(async () => {
      throw new Error("coupé");
    });
    brancherIdeesUsine({ env: ENV, fetchImpl: f as unknown as typeof fetch });
    await expect(sourceIdees().tirer(30)).resolves.toEqual([]);
  });

  it("réponse vide ou illisible : liste vide, un seul appel", async () => {
    const s = fauxServeur({ vide: true });
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await expect(sourceIdees().tirer(30)).resolves.toEqual([]);
    expect(s.mock).toHaveBeenCalledTimes(1);
    const f = vi.fn(async () => new Response("pas du json", { status: 200 }));
    brancherIdeesUsine({ env: ENV, fetchImpl: f as unknown as typeof fetch });
    await expect(sourceIdees().tirer(30)).resolves.toEqual([]);
  });

  it("échec au milieu du lot : on garde les vraies idées déjà reçues, aucune simulée", async () => {
    let n = 0;
    const f = vi.fn(async () => {
      n++;
      if (n > 2) return new Response("{}", { status: 500 });
      const lignes = Array.from({ length: 5 }, (_, i) => ligne(`m-${n}-${i}`));
      return new Response(JSON.stringify({ lignes }), { status: 200 });
    });
    brancherIdeesUsine({ env: ENV, fetchImpl: f as unknown as typeof fetch });
    const r = await sourceIdees().tirer(30);
    expect(r).toHaveLength(10);
    expect(r.every((c) => c.signature.startsWith("m-"))).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
  });
});

describe("KB-01 — bascule sans redémarrage", () => {
  it("deux lots : le second suit la nouvelle valeur du réglage (et inversement)", async () => {
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await sourceIdees().tirer(30);
    expect(sourceIdees().simulee).toBe(true);
    expect(s.mock).toHaveBeenCalledTimes(0);

    await ecrireParametre(REGLAGE_SOURCE_USINE, true);
    const reel = await sourceIdees().tirer(30);
    expect(reel).toHaveLength(30);
    expect(sourceIdees().simulee).toBe(false);
    expect(s.mock).toHaveBeenCalledTimes(6);

    await ecrireParametre(REGLAGE_SOURCE_USINE, false);
    const sim = await sourceIdees().tirer(30);
    expect(sim).toHaveLength(30);
    expect(sourceIdees().simulee).toBe(true);
    expect(s.mock).toHaveBeenCalledTimes(6);
  });

  it("rebrancher deux fois ne double rien (une seule source branchée)", async () => {
    await ecrireParametre(REGLAGE_SOURCE_USINE, true);
    const s = fauxServeur();
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    brancherIdeesUsine({ env: ENV, fetchImpl: s.f });
    await sourceIdees().tirer(5);
    expect(s.mock).toHaveBeenCalledTimes(1);
  });
});

describe("KB-01 — démarrage et page", () => {
  it("instrumentation.ts appelle brancherIdeesUsine une seule fois, dans un try, sans toucher au bloc Zernio", () => {
    const code = readFileSync("src/instrumentation.ts", "utf8");
    expect(code.match(/brancherIdeesUsine\(\)/g)).toHaveLength(1);
    expect(code).toContain("brancherParcoursZernio();");
    expect(code).toContain('import("@/services/branchement-idees-usine")');
  });

});

describe("KB-01 — action du réglage (session exigée)", () => {
  it("sans session : rien n'est écrit ; avec session : booléen seulement, aucun appel à l'usine", async () => {
    vi.resetModules();
    const exiger = vi.fn(async () => {
      throw new Error("pas de session");
    });
    vi.doMock("@/services/auth", () => ({ exigerSession: exiger }));
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    const f = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", f);
    const { definirSourceUsineAction } = await import("@/app/(studio)/reglages/base-connaissances/actions");
    const { lireParametre } = await import("@/services/_commun");
    await expect(definirSourceUsineAction(true)).rejects.toThrow("pas de session");
    expect(await lireParametre(REGLAGE_SOURCE_USINE, false)).toBe(false);

    exiger.mockResolvedValue(undefined as never);
    const refus = await definirSourceUsineAction("oui");
    expect(refus.ok).toBe(false);
    expect(await lireParametre(REGLAGE_SOURCE_USINE, false)).toBe(false);
    const ok = await definirSourceUsineAction(true);
    expect(ok.ok).toBe(true);
    expect(await lireParametre(REGLAGE_SOURCE_USINE, false)).toBe(true);
    expect((await definirSourceUsineAction(false)).ok).toBe(true);
    expect(await lireParametre(REGLAGE_SOURCE_USINE, true)).toBe(false);
    expect(f).not.toHaveBeenCalled();
    vi.doUnmock("@/services/auth");
    vi.doUnmock("next/cache");
  });
});
