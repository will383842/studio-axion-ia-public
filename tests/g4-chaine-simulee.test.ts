import { describe, expect, it } from "vitest";
import { executerChaine } from "@/generateur/chaine";
import { SUJETS_BANC } from "./generateur/banc/registre-banc-g4";
import { etapeZeroBanc, executeurSimule, TOURNURES_G4 } from "./helpers/g4";
import { CONTEXTE_BANC } from "./generateur/banc/registre-banc-g4";

describe("chaîne G4 en simulation (fumée)", () => {
  for (const s of SUJETS_BANC) {
    it(`${s.code} : étapes 1 à 12 sans clé`, async () => {
      const z0 = etapeZeroBanc(s);
      if (!z0.ok) throw new Error(JSON.stringify(z0.manque));
      const { executeur } = executeurSimule();
      const r = await executerChaine(z0.donnees, executeur, { tiragesJuges: 1, tournures: TOURNURES_G4, contexteWill: { interdits: CONTEXTE_BANC.interdits, promessesInterdites: CONTEXTE_BANC.promessesInterdites, rolesDestinataires: CONTEXTE_BANC.rolesDestinataires, termesVagues: CONTEXTE_BANC.termesVagues } });
      expect(["terminee", "arretee"]).toContain(r.statut);
    });
  }
});
