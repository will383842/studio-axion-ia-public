/** Chiffres par mot : une personne = une racine de clé (le renvoi rangé sous `racine|…` ne compte pas deux fois). Valeurs fictives. */
import { describe, expect, it } from "vitest";
import { agregerStatsMots, type ConversationStat } from "@/domaine/guide-reseau/stats-mots";

const MAINTENANT = Date.parse("2026-06-30T12:00:00.000Z");
const JOUR = 86_400_000;
const il_y_a = (ms: number): string => new Date(MAINTENANT - ms).toISOString();
const conv = (o: Partial<ConversationStat> & { cle: string }): ConversationStat => ({
  etat: "attente_email",
  creeLe: il_y_a(JOUR),
  m1Le: il_y_a(JOUR),
  ...o,
});
const personnes = (convs: ConversationStat[]) =>
  agregerStatsMots([], convs, MAINTENANT).find((s) => s.mot === "GUIDE")!.personnes.total;

describe("une personne = une racine de clé", () => {
  it("premier message (clé R) et renvoi (clé R|x) de la même personne : 1 personne", () => {
    expect(personnes([conv({ cle: "R" }), conv({ cle: "R|x", nature: "renvoi" })])).toBe(1);
  });
  it("deux personnes différentes (chacune avec son renvoi) : 2 personnes", () => {
    expect(
      personnes([
        conv({ cle: "R" }),
        conv({ cle: "R|x", nature: "renvoi" }),
        conv({ cle: "S" }),
        conv({ cle: "S|y", nature: "renvoi" }),
      ]),
    ).toBe(2);
  });
});
