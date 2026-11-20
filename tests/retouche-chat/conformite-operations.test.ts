/**
 * G14-05-b — Conformité des OPÉRATIONS du chat de retouche : chaque retouche offerte par un générateur
 * est annoncée à Claude (consigne) ET sait s'appliquer (`case` dans appliquer.ts).
 * La boucle porte sur `GENERATEURS_RETOUCHE` (jamais une liste recopiée).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TYPES_OPERATIONS_RETOUCHE } from "@/briques/operations";
import { consigneRetouche } from "@/services/retouche-chat/comprendre";
import { ADAPTATEURS_RETOUCHE, GENERATEURS_RETOUCHE } from "@/services/retouche-chat/generateurs";

const TYPES: readonly string[] = TYPES_OPERATIONS_RETOUCHE;
const consigne = consigneRetouche();
const appliquer = readFileSync(join(process.cwd(), "src/services/retouche-chat/appliquer.ts"), "utf8");

describe("conformité des opérations du chat de retouche", () => {
  it("le registre et la consigne ne sont pas vides", () => {
    expect(GENERATEURS_RETOUCHE.length).toBeGreaterThan(0);
    expect(consigne.length).toBeGreaterThan(0);
  });

  describe.each([...GENERATEURS_RETOUCHE])("%s", (g) => {
    const operations = ADAPTATEURS_RETOUCHE[g].operations;

    it("offre au moins une opération", () => {
      expect(operations.length).toBeGreaterThan(0);
    });

    it.each([...operations])("%s : listée, annoncée à Claude, appliquée, jamais modifier-script", (op) => {
      expect(TYPES.includes(op)).toBe(true);
      expect(consigne).toContain(`"type": "${op}"`);
      expect(appliquer).toContain(`case "${op}"`);
      expect(op).not.toBe("modifier-script");
    });
  });

  it("aucune retouche fantôme n'est annoncée à Claude", () => {
    const annoncees = [...consigne.matchAll(/"type": "([a-z-]+)"/g)].map((m) => m[1]);
    expect(annoncees.length).toBeGreaterThan(0);
    for (const op of annoncees) expect(TYPES).toContain(op);
  });
});
