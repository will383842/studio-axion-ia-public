/** « l'administratif » transcrit en « l » + « 'administratif. » : le mot doit compter comme dit (18/10, plan refusé 3 fois à tort). */
import { describe, expect, it } from "vitest";
import { nettoyer, sansElision, simplifier } from "@/moteurs/montage-facecam-animee/realisateur/mots";

const forme = (w: string) => simplifier(sansElision(nettoyer(w)));

describe("mots · apostrophe de tête", () => {
  it("« 'administratif. » et « 'automatisation. » se comparent à « administratif » et « automatisation »", () => {
    expect(forme("'administratif.")).toBe("administratif");
    expect(forme("’automatisation.")).toBe("automatisation");
  });
  it("les élisions normales ne changent pas", () => {
    expect(forme("l'IA")).toBe("ia");
    expect(forme("qu'est-ce")).toBe("est-ce");
    expect(forme("fuite.")).toBe("fuite");
  });
});
