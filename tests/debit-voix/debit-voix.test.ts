import { describe, expect, it } from "vitest";
import { debitMesure } from "@/briques/declinaison";
import { CARACTERES_PAR_MOT_FR, DEBIT_CIBLE_MOTS_PAR_SEC, MESURES_VOIX, motsMaxPour, motsParSecondeMesures, plafondMotsParSec, TOLERANCE_DEBIT, verdictDebit } from "@/domaine/debit-voix";

describe("débit de la voix (module pur, non branché)", () => {
  it("constantes", () => {
    expect(DEBIT_CIBLE_MOTS_PAR_SEC).toBe(2.75);
    expect(TOLERANCE_DEBIT).toBe(0.1);
    expect(CARACTERES_PAR_MOT_FR).toBe(6.15);
    expect(plafondMotsParSec()).toBeCloseTo(3.025, 3);
  });
  it("motsMaxPour borne par la cible, même si la voix est plus rapide", () => {
    expect(motsMaxPour(50, 3.4)).toBe(137);
    expect(motsMaxPour(50, 2.5)).toBe(125);
  });
  it("verdictDebit", () => {
    expect(verdictDebit(3.53)).toBe("alerte");
    expect(verdictDebit(2.7)).toBe("ok");
    expect(verdictDebit(plafondMotsParSec())).toBe("ok");
  });
  it("motsParSecondeMesures : premier mot à dernier mot, et debitMesure le réexporte", () => {
    const mots = Array.from({ length: 10 }, (_, i) => ({ debutSec: i, finSec: i + 0.5 }));
    expect(motsParSecondeMesures(mots as never)).toBe(+(10 / 9.5).toFixed(3));
    expect(debitMesure(mots as never)).toBe(motsParSecondeMesures(mots as never));
    expect(motsParSecondeMesures(mots.slice(0, 3) as never)).toBeNull();
  });
  it("mesures saisies", () => {
    expect(MESURES_VOIX["v-dcc902c3f3dd"].motsParSec).toBe(3.52);
    expect(MESURES_VOIX["v-dd3049053f88"].motsParSec).toBe(3.27);
    expect(verdictDebit(MESURES_VOIX["v-dcc902c3f3dd"].motsParSec)).toBe("alerte");
  });
});
