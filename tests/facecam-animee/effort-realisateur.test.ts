/** Le réalisateur v4 pense peu (`low`) : à `medium`, une longue prise épuisait les 32 000 jetons dans la pensée (18/10, sortie vide, 3 essais payés). */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { roleRealisateurV4 } = await import("@/moteurs/montage-facecam-animee/realisateur/role-v4");

describe("réalisateur v4 · effort", () => {
  it("effort bas, plafond de sortie inchangé", () => {
    const r = roleRealisateurV4();
    expect(r.effort).toBe("low");
    expect(r.maxTokens).toBe(32_000);
  });
});
