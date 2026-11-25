/** Sous `next start`, l'action de retouche / autre format ne passe pas par la boucle : modifications.ts doit raccorder le moteur seul. */
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

it("importer seulement modifications.ts (ni boucle ni branchements) raccorde le moteur vidéo longue", async () => {
  vi.resetModules();
  await import("@/services/modifications");
  const { moteurMontageVideoLongue } = await import("@/moteurs/montage-video-longue");
  const marque = Symbol.for("studio-axion-ia.video-longue-branche");
  expect((moteurMontageVideoLongue as unknown as Record<symbol, unknown>)[marque]).toBe(true);
}, 60_000);
