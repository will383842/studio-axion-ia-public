/** Relecture Opus (11) : l'ancien module de notation garde la même règle que le module partagé. */
import { describe, expect, it } from "vitest";
import { faitLeVousMeme } from "@/domaine/qualite-script/regles/positionnement";

describe("PO-01 : dispenses limitées à « nous » / « notre équipe »", () => {
  it("« avec notre guide » ne dispense pas", () => expect(faitLeVousMeme("Faites-le vous-même avec notre guide.")).toBeTruthy());
  it("« avec notre équipe », « avec nous », « pour vous » dispensent", () => {
    expect(faitLeVousMeme("Installez-le avec notre équipe.")).toBeUndefined();
    expect(faitLeVousMeme("Essayez-le avec nous.")).toBeUndefined();
    expect(faitLeVousMeme("On le fait pour vous, sans que vous le fassiez vous-même.")).toBeUndefined();
  });
  it("« vous-même » seul décrit une douleur", () => expect(faitLeVousMeme("Avant, vous relanciez vous-même chaque client.")).toBeUndefined());
});
