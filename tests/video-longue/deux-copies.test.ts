/** Sous `next start`, l'action serveur et la boucle peuvent charger chacune leur copie du moteur : chaque copie doit être reliée. */
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

it("deux copies du moteur : les deux sont raccordées (le garde ne dépend pas d'un drapeau global)", async () => {
  const charger = async () => {
    vi.resetModules();
    const m = await import("@/moteurs/montage-video-longue");
    await import("@/services/video-longue-branchements");
    return m.moteurMontageVideoLongue;
  };
  const a = await charger();
  const b = await charger();
  expect(b).not.toBe(a);
  const marque = Symbol.for("studio-axion-ia.video-longue-branche");
  for (const m of [a, b]) expect((m as unknown as Record<symbol, unknown>)[marque]).toBe(true);
});
