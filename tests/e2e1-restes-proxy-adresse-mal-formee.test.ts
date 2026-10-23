/**
 * Relecture des changements du correcteur console sur `src/proxy.ts` (n° 23, 30) : une fiche à l'adresse MAL FORMÉE
 * (« /videos/%E0%A4%A ») faisait lever `decodeURIComponent` DANS le proxy (erreur 500 pour Will connecté). Attendu :
 * le proxy laisse passer, la page répond comme pour toute adresse inconnue.
 */
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

const { proxy } = await import("@/proxy");
const { signerJeton, NOM_COOKIE_SESSION } = await import("@/lib/jeton-session");

beforeAll(() => {
  process.env.SESSION_SECRET = "f".repeat(48);
});

describe("proxy · adresse de fiche mal formée", () => {
  it("connecté : pas d'erreur, la requête suit son cours", async () => {
    const jeton = await signerJeton({ jti: "essai", rc: false }, 3600);
    // Aucune requête interne ne doit partir pour une adresse qu'on ne sait pas lire.
    const appel = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ existe: true })));
    const r = await proxy(new NextRequest("http://localhost:3321/videos/%E0%A4%A", { headers: { cookie: `${NOM_COOKIE_SESSION}=${jeton}` } }));
    expect(r.status).toBe(200);
    expect(appel).not.toHaveBeenCalled();
    appel.mockRestore();
  });
});
