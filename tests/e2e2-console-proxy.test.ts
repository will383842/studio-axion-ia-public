/**
 * Vérification de bout en bout n° 2 — statuts HTTP vus par le proxy :
 * - données n° 9 : `/maquettes-generateur` et `/styleguide` affichaient « Cette page n'existe pas » avec le statut 200
 *   en production ; attendu 404 ;
 * - parcours n° 26 : un sujet inconnu (`/ecrire/sujets/…`) répondait 200 ; attendu 404, comme une vidéo inconnue.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { proxy, fermeeEnProduction } = await import("@/proxy");
const { signerJeton, NOM_COOKIE_SESSION } = await import("@/lib/jeton-session");

let cookie = "";
const envOriginal = process.env.NODE_ENV;

beforeAll(async () => {
  process.env.SESSION_SECRET = "f".repeat(48);
  cookie = `${NOM_COOKIE_SESSION}=${await signerJeton({ jti: "essai", rc: false }, 3600)}`;
});

afterEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = envOriginal;
  vi.restoreAllMocks();
});

function enProduction() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";
}

describe("E2E-2 données n° 9 · pages fermées en production → 404", () => {
  it("règle pure : seulement en production, seulement ces deux adresses", () => {
    expect(fermeeEnProduction("/maquettes-generateur", { NODE_ENV: "production" })).toBe(true);
    expect(fermeeEnProduction("/maquettes-generateur/sujet", { NODE_ENV: "production" })).toBe(true);
    expect(fermeeEnProduction("/styleguide", { NODE_ENV: "production" })).toBe(true);
    expect(fermeeEnProduction("/maquettes-generateur", { NODE_ENV: "development" })).toBe(false);
    expect(fermeeEnProduction("/styleguides-autre", { NODE_ENV: "production" })).toBe(false);
  });

  for (const adresse of ["/maquettes-generateur", "/maquettes-generateur/resultat", "/styleguide"]) {
    it(`${adresse} connecté, en production : 404`, async () => {
      enProduction();
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>Cette page n'existe pas</html>"));
      const r = await proxy(new NextRequest(`http://localhost:3513${adresse}`, { headers: { cookie } }));
      expect(r.status).toBe(404);
    });
  }

  it("en développement : la page s'ouvre normalement", async () => {
    const appel = vi.spyOn(globalThis, "fetch");
    const r = await proxy(new NextRequest("http://localhost:3513/maquettes-generateur", { headers: { cookie } }));
    expect(r.status).toBe(200);
    expect(appel).not.toHaveBeenCalled();
  });

  it("sans connexion, en production : toujours vers /connexion", async () => {
    enProduction();
    const r = await proxy(new NextRequest("http://localhost:3513/styleguide"));
    expect(r.status).toBe(307);
  });
});

describe("E2E-2 parcours n° 26 · sujet inconnu → 404", () => {
  it("le proxy demande /api/fiches/sujets/<id>, puis renvoie la page avec 404", async () => {
    const appel = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => (String(url).includes("/api/fiches/") ? new Response(JSON.stringify({ existe: false })) : new Response("<html>introuvable</html>")));
    const r = await proxy(new NextRequest("http://localhost:3513/ecrire/sujets/inconnu", { headers: { cookie } }));
    expect(r.status).toBe(404);
    expect(String(appel.mock.calls[0][0])).toContain("/api/fiches/sujets/inconnu");
  });

  it("sujet connu : la page suit son cours", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ existe: true })));
    const r = await proxy(new NextRequest("http://localhost:3513/ecrire/sujets/m-1", { headers: { cookie } }));
    expect(r.status).toBe(200);
  });

  it("ficheExiste connaît le type « sujets »", async () => {
    const { reinitialiserDepots } = await import("@/donnees/memoire");
    const { ficheExiste } = await import("@/services/recherche");
    const d = reinitialiserDepots();
    expect(await ficheExiste("sujets", "inconnu")).toBe(false);
    const premier = (await d.scriptsMaitres.lister())[0];
    if (premier) expect(await ficheExiste("sujets", premier.id)).toBe(true);
  });
});
