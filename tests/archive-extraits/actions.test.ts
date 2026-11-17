/** C3-UT-3.10b-b : actions serveur minces de l'écran des extraits (aucune page, rien ne les appelle). */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  exigerSession: vi.fn(),
  revalidatePath: vi.fn(),
  ecarterPlage: vi.fn(),
  retablirPlage: vi.fn(),
  validerPlage: vi.fn(),
  rangerSource: vi.fn(),
  cocherVideo: vi.fn(),
}));
vi.mock("@/services/auth", () => ({ exigerSession: m.exigerSession }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidatePath }));
vi.mock("@/services/archive-extraits", () => ({
  ecarterPlage: m.ecarterPlage,
  retablirPlage: m.retablirPlage,
  validerPlage: m.validerPlage,
  rangerSource: m.rangerSource,
  cocherVideo: m.cocherVideo,
}));

import * as actions from "@/app/(studio)/bibliotheque/source-extraits/actions";

const CHEMIN = "/bibliotheque/source-extraits";
type Cas = { nom: string; appeler: (...a: unknown[]) => Promise<{ ok: boolean }>; geste: ReturnType<typeof vi.fn>; valides: unknown[]; invalides: unknown[][] };
const cas: Cas[] = [
  { nom: "ecarterPlageAction", appeler: actions.ecarterPlageAction as Cas["appeler"], geste: m.ecarterPlage, valides: ["v1", "p1"], invalides: [["", "p1"], ["v1", ""], [1, "p1"], ["v1", undefined]] },
  { nom: "retablirPlageAction", appeler: actions.retablirPlageAction as Cas["appeler"], geste: m.retablirPlage, valides: ["v1", "p1"], invalides: [["", "p1"], ["v1", "  "], [null, "p1"]] },
  { nom: "validerPlageAction", appeler: actions.validerPlageAction as Cas["appeler"], geste: m.validerPlage, valides: ["v1", "p1"], invalides: [["", ""], ["v1", 5]] },
  { nom: "rangerSourceAction", appeler: actions.rangerSourceAction as Cas["appeler"], geste: m.rangerSource, valides: ["v1", true], invalides: [["", true], ["v1", "oui"], ["v1", undefined], ["v1", 1]] },
  { nom: "cocherVideoAction", appeler: actions.cocherVideoAction as Cas["appeler"], geste: m.cocherVideo, valides: ["v1", false], invalides: [["", false], ["v1", "non"], [undefined, true]] },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.exigerSession.mockResolvedValue(undefined);
  for (const c of cas) c.geste.mockResolvedValue({ ok: true });
});

describe.each(cas)("$nom", (c) => {
  it("sans session : refus, geste non appelé", async () => {
    m.exigerSession.mockRejectedValue(new Error("pas de session"));
    await expect(c.appeler(...c.valides)).rejects.toThrow("pas de session");
    expect(c.geste).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
  it("argument vide ou mauvais type : refus en français, geste non appelé", async () => {
    for (const args of c.invalides) {
      const r = await c.appeler(...args);
      expect(r.ok).toBe(false);
      expect((r as unknown as { message: string }).message).toMatch(/[a-zé]{4,}/i);
    }
    expect(c.geste).not.toHaveBeenCalled();
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
  it("refus du service renvoyé tel quel, sans revalidatePath", async () => {
    const refus = { ok: false, message: "Refus du service." };
    c.geste.mockResolvedValue(refus);
    expect(await c.appeler(...c.valides)).toEqual(refus);
    expect(m.revalidatePath).not.toHaveBeenCalled();
  });
  it("succès : un appel du geste, un revalidatePath", async () => {
    expect(await c.appeler(...c.valides)).toEqual({ ok: true });
    expect(c.geste).toHaveBeenCalledTimes(1);
    expect(c.geste).toHaveBeenCalledWith(...c.valides);
    expect(m.revalidatePath).toHaveBeenCalledTimes(1);
    expect(m.revalidatePath).toHaveBeenCalledWith(CHEMIN);
  });
});

describe("P-7 : rien ne supprime", () => {
  it("aucun export ne parle de supprimer ou d'effacer", () => {
    const noms = Object.keys(actions);
    expect(noms.sort()).toEqual(["cocherVideoAction", "ecarterPlageAction", "rangerSourceAction", "retablirPlageAction", "validerPlageAction"]);
    expect(noms.some((n) => /suppr|efface|delete|retir(er|e)(?!blir)/i.test(n))).toBe(false);
  });
});
