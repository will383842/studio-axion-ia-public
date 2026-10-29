/**
 * Porte v2 (§ 3 quater) — garde commune de /api/usine/* et appel 5 (PUT /api/usine/reglages/budget).
 * Dépôts en mémoire, aucun réseau, aucun secret réel (valeurs d'essai).
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moisParis, decalerMois } = await import("@/services/couts");
const { reinitialiserGardePourEssai } = await import("@/usine/garde-porte");
const { PUT } = await import("@/app/api/usine/reglages/budget/route");
const { proxy } = await import("@/proxy");

const SECRET = "s".repeat(24) + "SECRET-ESSAI-porte-1234567";
const ANCIEN = "a".repeat(24) + "ANCIEN-ESSAI-porte-1234567";
const URL_BUDGET = "http://studio.test/api/usine/reglages/budget";
const courant = () => moisParis();
const suivant = () => decalerMois(moisParis(), 1);
const passe = () => decalerMois(moisParis(), -1);

function appel(corps: unknown, entetes: Record<string, string> = {}, secret: string | null = SECRET): NextRequest {
  const h: Record<string, string> = { "content-type": "application/json", ...entetes };
  if (secret !== null) h.authorization = `Bearer ${secret}`;
  return new NextRequest(URL_BUDGET, { method: "PUT", headers: h, body: typeof corps === "string" ? corps : JSON.stringify(corps) });
}
const ok = (extra: Record<string, unknown> = {}) => ({ contrat: 2, budget_mensuel_cents: 5000, mois: courant(), ...extra });

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserGardePourEssai();
  vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
  vi.stubEnv("USINE_PORTE_SECRET", "");
  vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", "");
  await ecrireParametre("budget.mensuel", { centimes: 10000, devise: "EUR" });
});

describe("garde : secret", () => {
  it("secret absent ou court → 404 sans détail", async () => {
    for (const v of ["", "trop-court"]) {
      vi.stubEnv("STUDIO_PORTE_SECRET", v);
      const r = await PUT(appel(ok(), {}, v || "x"));
      expect(r.status).toBe(404);
      expect(await r.json()).toEqual({ erreur: "Introuvable.", code: "introuvable" });
    }
  });

  it("secret faible (un caractère répété, préfixe dev- ou test-, espace) → 404 comme éteinte", async () => {
    for (const v of ["a".repeat(40), "dev-" + SECRET, "TEST-" + SECRET, SECRET.slice(0, 20) + " " + SECRET.slice(20)]) {
      vi.stubEnv("STUDIO_PORTE_SECRET", v);
      expect((await PUT(appel(ok(), {}, v))).status, v.slice(0, 6)).toBe(404);
    }
  });

  it("mauvais secret ou en-tête absent → 401 sans détail", async () => {
    for (const s of ["x".repeat(40), SECRET.slice(0, -1), null]) {
      const r = await PUT(appel(ok(), {}, s));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ erreur: "Non autorisé.", code: "non_autorise" });
    }
  });

  it("l'ancien secret est accepté avant l'échéance, refusé après, refusé sans échéance ou avec une échéance illisible", async () => {
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", ANCIEN);
    const dans = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", dans(2));
    expect((await PUT(appel(ok(), {}, ANCIEN))).status).toBe(200);
    expect((await PUT(appel(ok(), {}, SECRET))).status).toBe(200);
    expect((await proxy(appel(ok(), {}, ANCIEN))).status).not.toBe(401);
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", dans(-1));
    expect((await PUT(appel(ok(), {}, ANCIEN))).status).toBe(401);
    expect((await proxy(appel(ok(), {}, ANCIEN))).status).toBe(401);
    for (const v of ["", "pas une date"]) {
      vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", v);
      expect((await PUT(appel(ok(), {}, ANCIEN))).status).toBe(401);
    }
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", dans(2));
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "");
    expect((await PUT(appel(ok(), {}, ANCIEN))).status).toBe(401);
  });

  it("un ancien secret trop court n'ouvre rien", async () => {
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", "court");
    expect((await PUT(appel(ok(), {}, "court"))).status).toBe(401);
  });
});

describe("garde : un secret par sens", () => {
  const SORTANT = "o".repeat(20) + "SORTANT-ESSAI-porte-1234567";

  it("STUDIO_PORTE_SECRET égal à USINE_PORTE_SECRET → 404 comme éteinte, alerte au journal sans secret", async () => {
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("STUDIO_PORTE_SECRET", SORTANT);
    vi.stubEnv("USINE_PORTE_SECRET", SORTANT);
    const r = await PUT(appel(ok(), {}, SORTANT));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ erreur: "Introuvable.", code: "introuvable" });
    expect((await proxy(appel(ok(), {}, SORTANT))).status).toBe(404);
    const journal = JSON.stringify(await depots().evenements.lister());
    expect(journal).toContain("ALERTE");
    for (const sortie of [journal, JSON.stringify(erreurs.mock.calls)]) expect(sortie).not.toContain(SORTANT);
    erreurs.mockRestore();
  });

  it("STUDIO_PORTE_SECRET_PRECEDENT égal à USINE_PORTE_SECRET → 404 aussi, même avec le bon secret courant", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", SORTANT);
    vi.stubEnv("USINE_PORTE_SECRET", SORTANT);
    expect((await PUT(appel(ok(), {}, SECRET))).status).toBe(404);
    vi.mocked(console.error).mockRestore();
  });

  it("secrets distincts → la porte reste ouverte", async () => {
    vi.stubEnv("USINE_PORTE_SECRET", SORTANT);
    expect((await PUT(appel(ok()))).status).toBe(200);
  });
});

describe("garde : forme de l'appel", () => {
  it("contrat absent ou 1 ou inconnu → 426 contrat_inconnu", async () => {
    for (const corps of [{ budget_mensuel_cents: 1, mois: courant() }, ok({ contrat: 1 }), ok({ contrat: "2" })]) {
      const r = await PUT(appel(corps));
      expect(r.status).toBe(426);
      expect((await r.json()).code).toBe("contrat_inconnu");
    }
  });

  it("corps trop gros → 413 ; JSON absent → 415 ; illisible → 400", async () => {
    const gros = await PUT(appel(ok({ note: "x".repeat(17 * 1024) })));
    expect(gros.status).toBe(413);
    expect((await gros.json()).code).toBe("corps_trop_gros");
    const grosAnnonce = await PUT(appel(ok(), { "content-length": "20000" }));
    expect(grosAnnonce.status).toBe(413);
    expect((await PUT(appel(ok(), { "content-type": "text/plain" }))).status).toBe(415);
    expect((await PUT(appel("{pas du json"))).status).toBe(400);
    expect((await PUT(appel("[1,2]"))).status).toBe(400);
  });

  it("champ inconnu → 400 champ_invalide qui le nomme", async () => {
    const r = await PUT(appel(ok({ intrus: 1 })));
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.code).toBe("champ_invalide");
    expect(j.erreur).toContain("intrus");
  });

  it("429 au 61e appel de la minute, 200 avant", async () => {
    for (let i = 0; i < 60; i++) expect((await PUT(appel(ok()))).status).toBe(200);
    const r = await PUT(appel(ok()));
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("trop_d_appels");
  });

  it("les appels refusés (401) ne consomment pas le compteur", async () => {
    for (let i = 0; i < 70; i++) await PUT(appel(ok(), {}, "x".repeat(40)));
    expect((await PUT(appel(ok()))).status).toBe(200);
  });
});

describe("appel 5 : budget du mois", () => {
  it("règle le budget sous le plafond et répond mois, budget, plafond", async () => {
    const r = await PUT(appel(ok({ budget_mensuel_cents: 4000, mois: suivant() })));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ mois: suivant(), budget_mensuel_cents: 4000, plafond_cents: 10000, deja: false });
    expect((await lireParametre<{ budget_mensuel_cents: number }>(`budget.usine.${suivant()}`, null as never)).budget_mensuel_cents).toBe(4000);
  });

  it("au-dessus du plafond du studio → 400 champ_invalide, rien d'écrit", async () => {
    const r = await PUT(appel(ok({ budget_mensuel_cents: 10001 })));
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.code).toBe("champ_invalide");
    expect(j.erreur).toContain("budget_mensuel_cents");
    expect(await depots().parametres.obtenir(`budget.usine.${courant()}`)).toBeFalsy();
  });

  it("égal au plafond accepté ; zéro accepté", async () => {
    expect((await PUT(appel(ok({ budget_mensuel_cents: 10000 })))).status).toBe(200);
    expect((await PUT(appel(ok({ budget_mensuel_cents: 0 })))).status).toBe(200);
  });

  it("montant non entier, négatif ou texte → 400 budget_mensuel_cents", async () => {
    for (const v of [1.5, -1, "100", null]) {
      const r = await PUT(appel(ok({ budget_mensuel_cents: v })));
      expect(r.status).toBe(400);
      expect((await r.json()).erreur).toContain("budget_mensuel_cents");
    }
  });

  it("mois passé, lointain ou mal formé → 400 mois", async () => {
    for (const m of [passe(), decalerMois(courant(), 2), "2026-13", "octobre", 5]) {
      const r = await PUT(appel(ok({ mois: m })));
      expect(r.status).toBe(400);
      const j = await r.json();
      expect(j.code).toBe("champ_invalide");
      expect(j.erreur).toContain("mois");
    }
  });

  it("rejeu identique → 200 deja: true, un seul écrit au journal du budget", async () => {
    expect((await (await PUT(appel(ok()))).json()).deja).toBe(false);
    const r = await PUT(appel(ok()));
    expect(r.status).toBe(200);
    expect((await r.json()).deja).toBe(true);
    const budgets = (await depots().evenements.lister()).filter((e) => e.type === "budget");
    expect(budgets).toHaveLength(1);
  });

  it("peut baisser le budget déjà réglé", async () => {
    await PUT(appel(ok({ budget_mensuel_cents: 8000 })));
    const r = await PUT(appel(ok({ budget_mensuel_cents: 3000 })));
    expect((await r.json()).deja).toBe(false);
    expect((await lireParametre<{ budget_mensuel_cents: number }>(`budget.usine.${courant()}`, null as never)).budget_mensuel_cents).toBe(3000);
  });

  it("ne change pas le plafond du studio", async () => {
    await PUT(appel(ok()));
    expect(await lireParametre("budget.mensuel", null)).toEqual({ centimes: 10000, devise: "EUR" });
  });
});

describe("le secret n'apparaît jamais", () => {
  it("ni dans les réponses (toutes les erreurs), ni dans le journal ni dans la console", async () => {
    const avertissements = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT", ANCIEN);
    vi.stubEnv("STUDIO_PORTE_SECRET_PRECEDENT_JUSQU_A", new Date(Date.now() + 3_600_000).toISOString());
    const reponses = [
      await PUT(appel(ok(), {}, SECRET)),
      await PUT(appel(ok(), {}, ANCIEN)),
      await PUT(appel(ok(), {}, "z".repeat(40))),
      await PUT(appel(ok({ contrat: 1 }))),
      await PUT(appel(ok({ intrus: SECRET }))),
      await PUT(appel(ok({ budget_mensuel_cents: 999999 }))),
      await PUT(appel(ok({ repere: "usine:L12-3" }))),
    ];
    const texte = (await Promise.all(reponses.map((r) => r.text()))).join("\n");
    const journal = JSON.stringify(await depots().evenements.lister());
    const console_ = JSON.stringify(avertissements.mock.calls);
    for (const s of [SECRET, ANCIEN]) for (const sortie of [texte, journal, console_]) expect(sortie).not.toContain(s);
    expect(journal).toContain("/api/usine/reglages/budget");
    expect(journal).toContain("usine:L12-3");
    // Le champ inconnu portait le secret en VALEUR : jamais recopié ; son nom seul peut l'être.
    expect(journal).not.toContain("intrus");
    avertissements.mockRestore();
  });
});

describe("proxy et garde dans chaque handler", () => {
  const sansJeton = () => new NextRequest(URL_BUDGET, { method: "PUT" });

  it("proxy : porte éteinte → 404 ; jeton absent ou faux → 401 ; bon jeton → la requête passe", async () => {
    vi.stubEnv("STUDIO_PORTE_SECRET", "");
    expect((await proxy(sansJeton())).status).toBe(404);
    vi.stubEnv("STUDIO_PORTE_SECRET", SECRET);
    for (const s of [null, "x".repeat(40), SECRET.slice(0, -1)]) {
      const r = await proxy(appel(ok(), {}, s));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ erreur: "Non autorisé.", code: "non_autorise" });
    }
    expect((await proxy(appel(ok()))).headers.get("x-middleware-next")).toBe("1");
  });

  it("proxy : le préfixe /api/usine seul est gardé aussi", async () => {
    expect((await proxy(new NextRequest("http://studio.test/api/usine", { method: "GET" }))).status).toBe(401);
  });

  it("chaque route sous /api/usine (toute extension) refuse tout appel sans jeton : 404 porte éteinte, 401 sinon", async () => {
    const racine = join(process.cwd(), "src/app/api/usine");
    const routes: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/^route\.[^.]+$/.test(n)) routes.push(p);
      }
    };
    parcourir(racine);
    expect(routes.length).toBeGreaterThan(0);
    const verbes = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
    let appels = 0;
    for (const p of routes) {
      const module = (await import(/* @vite-ignore */ p)) as Record<string, unknown>;
      for (const verbe of verbes) {
        const handler = module[verbe];
        if (handler === undefined) continue;
        expect(typeof handler, `${p} ${verbe}`).toBe("function");
        for (const [secret, attendu] of [["", 404], [SECRET, 401]] as const) {
          vi.stubEnv("STUDIO_PORTE_SECRET", secret);
          const r = (await (handler as (r: NextRequest) => Promise<Response> | Response)(new NextRequest(URL_BUDGET, { method: verbe }))) as Response;
          expect(r.status, `${p} ${verbe} (secret ${secret ? "posé" : "absent"})`).toBe(attendu);
          appels += 1;
        }
      }
    }
    expect(appels).toBeGreaterThan(0);
  });
});
