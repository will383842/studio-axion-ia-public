/** PV-2 : clé d'idempotence du parcours guide (sans réseau). */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ACCORDS_SITE, RE_CLE_IDEMPOTENCE, RE_MOT_GUIDE, cleIdempotence } from "@/domaine/guide-reseau/cle-idempotence";

describe("PV-2 clé d'idempotence", () => {
  it("un identifiant de run conforme est envoyé tel quel", () => {
    expect(cleIdempotence("run_exemple_0001")).toBe("run_exemple_0001");
    expect(cleIdempotence("A-b_c1234")).toBe("A-b_c1234");
  });
  it("un identifiant à autres caractères ou hors longueur devient un sha256 hex de 64 caractères, déterministe", () => {
    for (const brut of ["run:avec:deux-points", "court", "x".repeat(81), "run é 1234"]) {
      const cle = cleIdempotence(brut);
      expect(cle).toBe(createHash("sha256").update(brut, "utf8").digest("hex"));
      expect(cle).toMatch(/^[0-9a-f]{64}$/);
      expect(RE_CLE_IDEMPOTENCE.test(cle)).toBe(true);
      expect(cleIdempotence(brut)).toBe(cle);
    }
  });
  it("la clé de 80 caractères reste telle quelle, 81 est hachée", () => {
    expect(cleIdempotence("a".repeat(80))).toBe("a".repeat(80));
    expect(cleIdempotence("a".repeat(81))).not.toBe("a".repeat(81));
  });
  it("mot : lettres et chiffres, accents compris, 2 à 30", () => {
    for (const ok of ["GUIDE", "dévis", "Été2", "ab", "a".repeat(30)]) expect(RE_MOT_GUIDE.test(ok), ok).toBe(true);
    for (const ko of ["a", "a".repeat(31), "deux mots", "ab-c", "a_b", "", "👍👍"]) expect(RE_MOT_GUIDE.test(ko), ko).toBe(false);
  });
  it("valeurs d'accord du site", () => {
    expect([...ACCORDS_SITE]).toEqual(["non_demande", "non", "oui_en_attente_de_clic", "oui_deja_confirme", "ecarte"]);
  });
});
