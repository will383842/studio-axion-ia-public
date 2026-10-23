/** Le réalisateur v4 a plus de 300 s pour une longue prise ; l'appel reçoit ce délai (relevé du 18/10 : « Claude n'a pas répondu à temps (300 s) »). */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { roleRealisateurV4, DELAI_TOTAL_REALISATEUR_V4_MS } = await import("@/moteurs/montage-facecam-animee/realisateur/role-v4");
const { DELAI_TOTAL_MS } = await import("@/fournisseurs/claude/client");

describe("réalisateur v4 · délai de l'appel", () => {
  it("dépasse le délai par défaut (300 s) mais reste borné à 15 min", () => {
    const r = roleRealisateurV4();
    expect(r.delaiTotalMs).toBe(DELAI_TOTAL_REALISATEUR_V4_MS);
    expect(DELAI_TOTAL_REALISATEUR_V4_MS).toBeGreaterThan(DELAI_TOTAL_MS);
    expect(DELAI_TOTAL_REALISATEUR_V4_MS).toBeLessThanOrEqual(15 * 60_000);
  });
});
