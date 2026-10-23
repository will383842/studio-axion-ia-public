/** Le rendu face caméra v4 borne le cache vidéo de Remotion (SIGKILL à 99 % le 18/10 : le cache visait la moitié des 15 Go de la machine). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(p, "utf8");

describe("rendu v4 · cache vidéo borné", () => {
  it("la borne existe et tient largement dans les 3 Go du conteneur", () => {
    const m = lire("studio-rendu/src/remotion.ts").match(/CACHE_VIDEO_RENDU_OCTETS = (\d+) \* 1024 \* 1024/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(512);
  });
  it("renderMedia du v4 reçoit la borne pour les deux caches", () => {
    const s = lire("studio-rendu/src/operations/facecam-v4.ts");
    expect(s).toContain("offthreadVideoCacheSizeInBytes: CACHE_VIDEO_RENDU_OCTETS");
    expect(s).toContain("mediaCacheSizeInBytes: CACHE_VIDEO_RENDU_OCTETS");
  });
});
