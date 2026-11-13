/**
 * GV2-32 : le remixage des sons garde le fondu de fin, et la progression avance pendant les longues passes ffmpeg.
 * Aucun ffmpeg ni Remotion n'est lancé : on teste les arguments et les minuteurs. Passe avec ou sans les
 * dépendances de `studio-rendu` (le chargement de l'opération est sauté proprement s'il échoue).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Operation = typeof import("../../studio-rendu/src/operations/composition");
let op: Operation | null = null;
try {
  op = await import("../../studio-rendu/src/operations/composition");
} catch {
  op = null;
}
const ici = op ? describe : describe.skip;

ici("remixage : fondu de fin du son", () => {
  it("avec fonduFinSec : la commande contient le fondu de sortie (afade)", () => {
    const fondu = op!.fonduAudioDuRecalque({ dureeSec: 20, fonduFinSec: 0.3 });
    expect(fondu).toContain("afade");
    const args = op!.argumentsRemplacerSon("m.mov", "s.wav", "out.mov", fondu);
    expect(args[args.indexOf("-af") + 1]).toMatch(/^afade=.*,/);
  });
  it("l'image d'origine (image.fonduFinSec) est aussi lue", () => {
    expect(op!.fonduAudioDuRecalque({ dureeSec: 20, image: { fonduFinSec: 0.3 } })).toContain("afade");
  });
  it("sans fondu : commande inchangée", () => {
    expect(op!.fonduAudioDuRecalque({ dureeSec: 20 })).toBeUndefined();
    const args = op!.argumentsRemplacerSon("m.mov", "s.wav", "out.mov", undefined);
    expect(args[args.indexOf("-af") + 1]).not.toContain("afade");
  });
});

ici("progression estimée pendant une longue passe", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("une passe de 3 min publie au moins deux valeurs croissantes entre 55 et 95", async () => {
    const valeurs: number[] = [];
    const passe = op!.avecProgressionEstimee((p) => valeurs.push(p), { de: 55, a: 94, dureeSec: 30 }, () => new Promise<string>((ok) => setTimeout(() => ok("fini"), 180_000)));
    await vi.advanceTimersByTimeAsync(180_000);
    expect(await passe).toBe("fini");
    expect(valeurs.length).toBeGreaterThanOrEqual(2);
    for (const v of valeurs) { expect(v).toBeGreaterThan(55); expect(v).toBeLessThanOrEqual(94); }
    expect([...valeurs].sort((a, b) => a - b)).toEqual(valeurs);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("une erreur arrête le minuteur et remonte", async () => {
    const passe = op!.avecProgressionEstimee(() => {}, { de: 55, a: 94, dureeSec: 30 }, () => Promise.reject(new Error("raté")));
    await expect(passe).rejects.toThrow("raté");
    expect(vi.getTimerCount()).toBe(0);
  });
});
