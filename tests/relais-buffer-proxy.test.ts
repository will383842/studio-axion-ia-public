/**
 * Exemption du garde pour le relais Buffer : SEULE l'adresse exacte /api/media-buffer/<jeton>/video.mp4 passe sans session ;
 * toute variante garde le comportement d'avant l'exemption (401 pour /api/, redirection vers /connexion sinon).
 */
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

const { proxy } = await import("@/proxy");

beforeAll(() => {
  process.env.SESSION_SECRET = "f".repeat(48);
});

const appeler = (chemin: string) => proxy(new NextRequest(`https://studio.essai.example${chemin}`));

describe("proxy : exemption stricte du relais Buffer", () => {
  for (const chemin of ["/api/media-buffer/a/video.mp4", "/api/media-buffer/eyJmIjoxfQ.sig-_9/video.mp4"]) {
    it(`${chemin} passe sans session`, async () => {
      const r = await appeler(chemin);
      expect(r.status).toBe(200);
      expect(r.headers.get("x-middleware-next")).toBe("1");
    });
  }

  for (const chemin of ["/api/media-buffer-x/a/video.mp4", "/api/media-buffer/a/b/c", "/api/media-buffer/a/video.mp4/x", "/api/media-buffer/a/autre.mp4", "/api/media-buffer//video.mp4", "/api/media-buffer/a b/video.mp4"]) {
    it(`${chemin} ne passe PAS sans session : 401`, async () => {
      const r = await appeler(chemin);
      expect(r.status).toBe(401);
      expect(r.headers.get("x-middleware-next")).toBeNull();
    });
  }

  for (const chemin of ["/API/media-buffer/a/video.mp4", "//api/media-buffer/a/video.mp4"]) {
    it(`${chemin} ne passe PAS sans session : redirection vers /connexion`, async () => {
      const r = await appeler(chemin);
      expect(r.status).toBe(307);
      expect(new URL(r.headers.get("location")!).pathname).toBe("/connexion");
    });
  }
});
