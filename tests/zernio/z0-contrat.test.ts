import { describe, expect, it } from "vitest";
import { chargerExtrait, creerValidateur } from "./aides/schema";

const D6: Array<[string, string]> = [
  ["get", "/v1/accounts"],
  ["get", "/v1/accounts/{accountId}/facebook-page"],
  ["get", "/v1/accounts/{accountId}/linkedin-organizations"],
  ["get", "/v1/accounts/{accountId}/tiktok/creator-info"],
  ["get", "/v1/accounts/{accountId}/instagram/publishing-limit"],
  ["post", "/v1/media/presign"],
  ["post", "/v1/posts"],
  ["get", "/v1/posts/{postId}"],
  ["get", "/v1/posts"],
  ["put", "/v1/posts/{postId}"],
  ["get", "/v1/analytics"],
];

describe("z0 · contrat Zernio (extrait de la spec 1.429.1)", () => {
  const spec = chargerExtrait();

  it.each(D6)("%s %s existe", (methode, chemin) => {
    expect(spec.paths[chemin]?.[methode]).toBeDefined();
  });

  it("l'extrait ne contient que la liste fermée D6", () => {
    const trouves = Object.entries(spec.paths).flatMap(([p, ms]) =>
      Object.keys(ms).map((m) => `${m} ${p}`),
    );
    expect(trouves.sort()).toEqual(D6.map(([m, p]) => `${m} ${p}`).sort());
  });

  it("valide des réglages TikTok conformes", () => {
    const valider = creerValidateur(spec);
    const r = valider("TikTokPlatformData", {
      privacyLevel: "PUBLIC_TO_EVERYONE",
      allowComment: true,
      allowDuet: true,
      allowStitch: true,
      commercialContentType: "none",
      contentPreviewConfirmed: true,
      expressConsentGiven: true,
    });
    expect(r.erreurs).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejette un type invalide", () => {
    const valider = creerValidateur(spec);
    expect(valider("TikTokPlatformData", { allowComment: "oui" }).ok).toBe(false);
  });

  it("Idempotency-Key est un en-tête de POST /v1/posts", () => {
    const post = spec.paths["/v1/posts"].post as { parameters: Array<{ name: string; in: string }> };
    expect(post.parameters.some((p) => p.name === "Idempotency-Key" && p.in === "header")).toBe(true);
  });
});
