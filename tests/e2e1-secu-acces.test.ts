/**
 * VÉRIFICATION E2E-1 — accès et production :
 *  - proxy : plus d'exception par extension (`.mp4`, `.png`, `.txt`…) ; seuls des chemins NOMMÉS passent sans connexion ;
 *  - n° 10 : maquettes du lot GM fermées en production ;
 *  - n° 12 : dictée, mention discrète « Dictée de votre téléphone » pendant l'écoute.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { mockNavigation } from "./helpers/next-mocks";

vi.mock("next/navigation", () => mockNavigation);

const { config, proxy } = await import("@/proxy");

/** Le motif du proxy tel que Next l'applique au chemin entier. */
function couvert(chemin: string): boolean {
  return new RegExp(`^${config.matcher[0]}$`).test(chemin);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("E2E-1 · proxy : le premier filtre ne dépend plus de l'extension", () => {
  it("une adresse protégée qui finit par .mp4, .png, .txt… passe par le proxy", () => {
    for (const c of ["/ecrire/sujets/x.mp4", "/videos/abc.png", "/scripts/x.txt", "/essais/mes-images/f-0c62174f9432.jpg", "/luts/axion-buffer-doux.cube", "/api/telechargements.mp4", "/robots.txt.mp4", "/demo"]) {
      expect(couvert(c), c).toBe(true);
    }
  });

  it("seuls les fichiers publics NOMMÉS y échappent", () => {
    for (const c of ["/_next/static/chunks/a.js", "/_next/image", "/demo/avocat-droits.mp4", "/icones/icone-192.png", "/favicon.ico", "/robots.txt", "/manifest.webmanifest", "/sw.js"]) {
      expect(couvert(c), c).toBe(false);
    }
  });

  it("sans connexion : /ecrire/sujets/x.mp4 → /connexion, /api/telechargements.mp4 → 401", async () => {
    const page = await proxy(new NextRequest("http://localhost:3304/ecrire/sujets/x.mp4"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/connexion");
    const api = await proxy(new NextRequest("http://localhost:3304/api/telechargements.mp4"));
    expect(api.status).toBe(401);
  });
});

describe("E2E-1 n° 10 · maquettes du générateur réservées au développement", () => {
  it("la garde est fermée en production, ouverte ailleurs", async () => {
    const { maquettesOuvertes } = await import("@/app/(studio)/maquettes-generateur/_garde");
    expect(maquettesOuvertes({ NODE_ENV: "production" })).toBe(false);
    expect(maquettesOuvertes({ NODE_ENV: "development" })).toBe(true);
    expect(maquettesOuvertes({ NODE_ENV: "test" })).toBe(true);
  });

  it("en production, toute page sous /maquettes-generateur répond « introuvable » (gabarit commun)", async () => {
    const { default: Gabarit } = await import("@/app/(studio)/maquettes-generateur/layout");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => Gabarit({ children: "maquette" })).toThrow("NOT_FOUND");
    vi.stubEnv("NODE_ENV", "development");
    expect(Gabarit({ children: "maquette" })).toBe("maquette");
  });
});

describe("E2E-1 n° 12 · dictée : on sait que le son passe par le téléphone", () => {
  it("la mention apparaît pendant l'écoute seulement", async () => {
    const { BoutonMicro, MENTION_DICTEE } = await import("@/components/matieres/Dictee");
    expect(MENTION_DICTEE).toBe("Dictée de votre téléphone");
    expect(renderToStaticMarkup(createElement(BoutonMicro, { ecoute: true, onClick: () => undefined }))).toContain(MENTION_DICTEE);
    expect(renderToStaticMarkup(createElement(BoutonMicro, { ecoute: false, onClick: () => undefined }))).not.toContain(MENTION_DICTEE);
  }, 60_000);
});
