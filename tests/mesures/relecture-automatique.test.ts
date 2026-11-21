/**
 * L5-18b : relecture automatique des chiffres à J+1, J+3 et J+7 (interrupteur « mesures.relecture_automatique », ÉTEINT par défaut).
 * Faux client qui COMPTE les requêtes, dépôts en mémoire, horloge fixe. Aucune requête réelle, aucune donnée de personne.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import type { Publication } from "@/domaine/types";
import { injecterClientZernio, BUDGET_REQUETES_PAR_PASSAGE } from "@/services/zernio";

vi.mock("server-only", () => ({}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const notifs = await import("@/services/notifications");
const ma = await import("@/services/mesures-automatiques");

const JOUR = 86_400_000;
const T0 = Date.parse("2026-11-20T10:00:00.000Z");
const IL_Y_A = (jours: number) => new Date(T0 - jours * JOUR).toISOString();
const CLE = "mesures.relecture_automatique";

type Appel = { methode: string; chemin: string; query?: Record<string, unknown> };
const analytics = (n: number) => ({ views: 100 + n, reach: 80 + n, likes: 5, comments: 2, shares: 4, lastUpdated: "2026-11-20T08:00:00Z" });
const post = (id: string, a: Record<string, unknown> | null = analytics(1)) => ({ _id: `d-${id}`, latePostId: id, platform: "instagram", platformPostUrl: `https://exemple.test/p/${id}`, ...(a ? { analytics: a } : {}) });

let ids: string[] = [];
function fauxClient(o: { page1?: { statut: number; corps?: unknown }; sansChiffres?: boolean } = {}) {
  const appels: Appel[] = [];
  const base = {
    async requete(req: Appel) {
      appels.push(req);
      if (req.methode !== "GET") throw new Error(`méthode interdite : ${req.methode}`);
      if (req.chemin !== "/v1/analytics") throw new Error(`chemin interdit : ${req.chemin}`);
      const page = Number(req.query?.page ?? 1);
      if (page === 1 && o.page1) return { ...o.page1, route: "analytics" };
      const tranche = ids.slice((page - 1) * 50, page * 50);
      return { statut: 200, corps: { posts: tranche.map((i, k) => post(i, o.sansChiffres ? null : analytics(k))), pagination: { page, limit: 50 } }, route: "analytics" };
    },
  };
  const client = new Proxy(base, { get: (c, nom: string) => (nom in c ? (c as Record<string, unknown>)[nom] : () => { throw new Error(`méthode interdite : ${nom}`); }) }) as unknown as ClientZernio;
  return { client, appels };
}

async function publications(n: number, extra: (i: number) => Partial<Publication> = () => ({})) {
  for (let i = 0; i < n; i++) {
    const id = `essai-st-${i}`;
    ids.push(id);
    await depots().publications.enregistrer({
      id: `essai-pub-${i}`, videoId: `essai-v-${i}`, varianteId: `essai-var-${i}`, reseau: "instagram", statut: "publiee", via: "zernio",
      date: IL_Y_A(1.5), texte: "", idExterne: id, creeLe: IL_Y_A(2), modifieLe: IL_Y_A(2), ...extra(i),
    } as never);
  }
}
const allumer = () => ecrireParametre(CLE, true);
async function passage(f: ReturnType<typeof fauxClient>, instant = T0) {
  injecterClientZernio(f.client);
  return ma.relireMesuresDues({ instant, client: f.client });
}

beforeEach(() => {
  reinitialiserDepots();
  ids = [];
  injecterClientZernio(null);
  delete (globalThis as Record<string, unknown>)[ma.CLE_MEMOIRE_RELECTURE];
  vi.restoreAllMocks();
});

describe("constantes", () => {
  it("plafonds de la fiche, budget de la synchro inchangé", () => {
    expect([...ma.JOURS_RELECTURE]).toEqual([1, 3, 7]);
    expect(ma.INTERVALLE_RELECTURE_MS).toBe(6 * 3_600_000);
    expect(ma.PAGES_PAR_PASSAGE).toBe(2);
    expect(BUDGET_REQUETES_PAR_PASSAGE).toBe(51);
  });
  it("recensé « eteint » ; clé en littéral, défaut false, jugée par === true", () => {
    expect(readFileSync("tests/usine/inventaire/publication-et-mesures.test.ts", "utf8")).toMatch(/"mesures\.relecture_automatique": "eteint"/);
    expect(readFileSync("src/services/mesures-automatiques.ts", "utf8")).toMatch(/lireParametre<boolean>\("mesures\.relecture_automatique", false\)/);
  });
  it("la boucle lance la relecture hors du tour (une ligne)", () => {
    expect(readFileSync("src/services/boucle.ts", "utf8")).toContain('void lancerAnnexe("relecture des mesures", async () => (await import("./mesures-automatiques")).relireMesuresDues(), 0);');
  });
});

describe("éteint", () => {
  it("réglage absent ou faux : 0 requête, 0 lecture de publications, 0 écriture", async () => {
    await publications(5);
    for (const valeur of [undefined, false, "oui", 1, "true"]) {
      if (valeur !== undefined) await ecrireParametre(CLE, valeur);
      const lister = vi.spyOn(depots().publications, "lister");
      const obtenir = vi.spyOn(depots().publications, "obtenir");
      const modifier = vi.spyOn(depots().publications, "modifier");
      const enregistrer = vi.spyOn(depots().publications, "enregistrer");
      const f = fauxClient();
      const r = await passage(f);
      expect(r).toEqual({ requetes: 0 });
      expect(f.appels).toHaveLength(0);
      expect(lister).not.toHaveBeenCalled();
      expect(obtenir).not.toHaveBeenCalled();
      expect(modifier).not.toHaveBeenCalled();
      expect(enregistrer).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });
});

describe("allumé", () => {
  it("120 publications dues : 2 requêtes GET au plus ; le relevé est écrit", async () => {
    await allumer();
    await publications(120);
    const f = fauxClient();
    const r = await passage(f);
    expect(f.appels.length).toBeLessThanOrEqual(2);
    expect(r.requetes).toBe(f.appels.length);
    expect(f.appels.every((a) => a.methode === "GET" && a.chemin === "/v1/analytics")).toBe(true);
    const p = await depots().publications.obtenir("essai-pub-0");
    expect(p?.releves?.some((x) => x.source === "zernio")).toBe(true);
  });

  it("deuxième appel 1 h après : 0 requête ; 7 h après : de nouveau 2 au plus", async () => {
    await allumer();
    await publications(120, () => ({ date: IL_Y_A(1.5) }));
    const f = fauxClient();
    await passage(f);
    const avant = f.appels.length;
    await passage(f, T0 + 3_600_000);
    expect(f.appels).toHaveLength(avant);
    // 7 h plus tard, toujours dues (J+3 pas encore atteint) : les relevés d'hier ne comptent pas, ceux d'après l'échéance si.
    await depots().publications.lister().then(async (l) => { for (const p of l) await depots().publications.modifier(p.id, { releves: [] }); });
    await passage(f, T0 + 7 * 3_600_000);
    expect(f.appels.length - avant).toBeGreaterThan(0);
    expect(f.appels.length - avant).toBeLessThanOrEqual(2);
  });

  it("aucune due : 0 requête", async () => {
    await allumer();
    await publications(3, () => ({ date: IL_Y_A(0.2) }));
    const f = fauxClient();
    expect((await passage(f)).requetes).toBe(0);
    expect(f.appels).toHaveLength(0);
  });

  it("clé absente (sans client injecté) : 0 requête", async () => {
    await allumer();
    await publications(2);
    const f = fauxClient();
    vi.stubEnv("ZERNIO_API_KEY", "");
    const r = await ma.relireMesuresDues({ instant: T0 });
    vi.unstubAllEnvs();
    expect(r).toEqual({ requetes: 0 });
    expect(f.appels).toHaveLength(0);
  });

  it("page en 202 : aucune écriture, toujours due au passage suivant", async () => {
    await allumer();
    await publications(3);
    const modifier = vi.spyOn(depots().publications, "modifier");
    const f = fauxClient({ page1: { statut: 202, corps: {} } });
    await passage(f);
    expect(modifier).not.toHaveBeenCalled();
    const pubs = await depots().publications.lister();
    expect(ma.publicationsDues(pubs, T0)).toHaveLength(3);
    await passage(f, T0 + 7 * 3_600_000);
    expect(f.appels.length).toBe(2);
  });

  it("valeur absente → champ absent (jamais 0)", async () => {
    await allumer();
    await publications(1);
    const f = fauxClient();
    f.client.requete = (async (req: Appel) => {
      f.appels.push(req);
      return { statut: 200, corps: { posts: [post("essai-st-0", { views: 42 })], pagination: { page: 1, limit: 50 } }, route: "analytics" };
    }) as never;
    await passage(f);
    const rel = (await depots().publications.obtenir("essai-pub-0"))?.releves?.find((x) => x.source === "zernio");
    expect(rel?.valeurs.vues).toBe(42);
    expect("likes" in (rel?.valeurs ?? {})).toBe(false);
    expect("commentaires" in (rel?.valeurs ?? {})).toBe(false);
  });

  it("aucune notification ; aucun import de Claude, notification ou notifications", async () => {
    await allumer();
    await publications(3);
    const espion = vi.spyOn(notifs, "creerNotification");
    await passage(fauxClient());
    expect(espion).not.toHaveBeenCalled();
    const src = readFileSync("src/services/mesures-automatiques.ts", "utf8");
    expect(src).not.toMatch(/@\/fournisseurs\/claude/);
    expect(src).not.toMatch(/@\/fournisseurs\/notification/);
    expect(src).not.toMatch(/\.\/notifications/);
    expect(src).toMatch(/^"server-only"|import "server-only"/m);
  });
});

describe("publicationsDues (pure)", () => {
  const base = { id: "p", videoId: "v", reseau: "instagram", statut: "publiee", via: "zernio", idExterne: "x", date: IL_Y_A(1.5), texte: "" } as unknown as Publication;
  it("J+1, J+3, J+7 dans la fenêtre de 3 jours", () => {
    expect(ma.publicationsDues([base], T0)).toHaveLength(1);
    expect(ma.publicationsDues([{ ...base, date: IL_Y_A(3.5) }], T0)).toHaveLength(1);
    expect(ma.publicationsDues([{ ...base, date: IL_Y_A(7.5) }], T0)).toHaveLength(1);
    expect(ma.publicationsDues([{ ...base, date: IL_Y_A(0.5) }], T0)).toHaveLength(0);
    expect(ma.publicationsDues([{ ...base, date: IL_Y_A(12) }], T0)).toHaveLength(0);
  });
  it("exclut simulation, exemple, sans identifiant, autre outil, déjà relevée après l'échéance", () => {
    expect(ma.publicationsDues([{ ...base, via: "simulation" }], T0)).toHaveLength(0);
    expect(ma.publicationsDues([{ ...base, via: "buffer" }], T0)).toHaveLength(0);
    expect(ma.publicationsDues([{ ...base, estDemo: true }], T0)).toHaveLength(0);
    expect(ma.publicationsDues([{ ...base, idExterne: undefined }], T0)).toHaveLength(0);
    const releve = { le: IL_Y_A(0.3), jour: 1, source: "zernio", valeurs: {}, definitions: {} };
    expect(ma.publicationsDues([{ ...base, releves: [releve] } as never], T0)).toHaveLength(0);
    expect(ma.publicationsDues([{ ...base, releves: [{ ...releve, le: IL_Y_A(1.2) }] } as never], T0)).toHaveLength(1);
  });
});
