/**
 * Essai réel du 14/10 (v-e99a49ee86cb) : « La mesure des blancs : rendu en cours » a arrêté la voix, déjà payée, au lieu
 * de la faire attendre. Le signal doit être reconnu à son nom, même venu d'une autre copie du module.
 */
import { describe, expect, it } from "vitest";
import { estRenduEnCours, RenduEnCours } from "@/moteurs/montage-cas-concret";

describe("« rendu en cours » reconnu partout", () => {
  it("la classe du module, et une copie de même nom (autre module), sont des attentes ; une vraie panne non", () => {
    expect(estRenduEnCours(new RenduEnCours("La mesure des blancs"))).toBe(true);
    class RenduEnCoursCopie extends Error {
      constructor(quoi: string) {
        super(`${quoi} : rendu en cours.`);
        this.name = "RenduEnCours";
      }
    }
    expect(estRenduEnCours(new RenduEnCoursCopie("La mesure des blancs"))).toBe(true);
    expect(estRenduEnCours(new Error("La mesure des blancs : panne"))).toBe(false);
    expect(estRenduEnCours({ name: "RenduEnCours" })).toBe(false);
    expect(estRenduEnCours(undefined)).toBe(false);
  });
});
