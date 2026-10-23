/**
 * L'ANCIEN témoin (15/10, « Ce devis collé dans ChatGPT contient trois données de trop ») : un TUTORIEL numéroté à
 * l'impératif (« Un. Remplacez… Deux. Effacez… Trois. Coupez… »). Depuis le lot B1 (décision D1 de Will, 18/10), il est
 * REFUSÉ par le programme (`etape-imperatif`) ; ses données ne sont gardées que pour illustrer l'ancien défaut. Le témoin
 * qui fait foi est celui de `exemples-v5.ts` (`exemples-v5.test.ts`).
 */
import { describe, expect, it } from "vitest";
import { QUESTIONS_IA } from "@/domaine/scripts-tableau";
import { aDesEliminatoires, controlerEcriture, controlerEtapes } from "@/domaine/scripts-tableau-controles";
import { EXEMPLES_V4 } from "./exemples-v4";

for (const e of EXEMPLES_V4) {
  describe(`ancien défaut : ${e.titre}`, () => {
    it("est refusé : chaque étape est un impératif numéroté, adressé au spectateur", () => {
      const d = controlerEtapes(e.ecriture.script);
      expect(d.filter((x) => x.code === "etape-imperatif")).toHaveLength(3);
      expect(aDesEliminatoires(controlerEcriture(e.ecriture, e.demande, { questionIa: QUESTIONS_IA[0] }))).toBe(true);
    });
    it("n'a aucune question dans la douleur ni dans la promesse (il en reste la seule question sur l'IA, ajoutée à la fin)", () => {
      const s = e.ecriture.script;
      expect([...s.douleur, ...s.promesse].some((p) => p.dit.includes("?"))).toBe(false);
    });
  });
}
