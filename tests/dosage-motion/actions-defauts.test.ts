import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({
  exigerSession: vi.fn(),
  definir: vi.fn(),
  lire: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/services/auth", () => ({ exigerSession: mocks.exigerSession }));
vi.mock("@/services/dosage-motion-defauts", () => ({
  definirDefautDosage: mocks.definir,
  lireDefautsDosage: mocks.lire,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { definirDefautDosageAction, lireDefautsDosageAction } from "@/app/(studio)/reglages/actions-dosage-motion";

const REFUS = { ok: false, message: "Ce choix n'existe pas pour ce générateur." };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exigerSession.mockResolvedValue(undefined);
});

describe("dosage-motion : action des défauts", () => {
  it("session absente : refus, service non appelé", async () => {
    mocks.exigerSession.mockRejectedValue(new Error("pas de session"));
    await expect(definirDefautDosageAction("avocat", "sobre")).rejects.toThrow("pas de session");
    expect(mocks.definir).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  for (const [g, c] of [["inconnu", "sobre"], ["avocat", "turbo"], [42, "sobre"], ["avocat", null], ["toString", "sobre"]] as const) {
    it(`valeur inconnue (${String(g)}, ${String(c)}) : refus, service non appelé`, async () => {
      expect(await definirDefautDosageAction(g, c)).toEqual(REFUS);
      expect(mocks.definir).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  }

  it("refus du service renvoyé tel quel, sans revalidation", async () => {
    mocks.definir.mockResolvedValue({ ok: false, message: "Pas encore actif." });
    expect(await definirDefautDosageAction("avocat", "sobre")).toEqual({ ok: false, message: "Pas encore actif." });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("succès : un appel au service, une revalidation", async () => {
    mocks.definir.mockResolvedValue({ ok: true });
    expect(await definirDefautDosageAction("avocat", "sobre")).toEqual({ ok: true });
    expect(mocks.definir).toHaveBeenCalledTimes(1);
    expect(mocks.definir).toHaveBeenCalledWith("avocat", "sobre");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/reglages");
  });

  it("lecture : session exigée, renvoie les défauts, aucune revalidation", async () => {
    mocks.lire.mockResolvedValue({ avocat: "sobre" });
    const r = await lireDefautsDosageAction();
    expect(r).toMatchObject({ ok: true });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.exigerSession).toHaveBeenCalledTimes(1);
  });

  it("garde statique : n'importe ni reglages.ts, ni travaux.ts, ni argent", () => {
    const src = readFileSync(join(process.cwd(), "src/app/(studio)/reglages/actions-dosage-motion.ts"), "utf8");
    const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const i of imports) expect(i).not.toMatch(/reglages$|travaux|argent|plafond|zernio|publications/);
  });
});
