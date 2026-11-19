/** Prédicat partagé « créneau / visuel envoyable » : table de vérité (pur, sans dépôt ni réseau). */
import { describe, expect, it } from "vitest";
import { STATUTS_CRENEAU_ENVOYABLES, creneauEnvoyable, visuelEnvoyable } from "@/domaine/plan-editorial/envoyable";

const base = { statut: "valide", valideeLe: "2026-11-12T10:00:00Z" };
const MAINTENANT = Date.parse("2026-11-19T10:00:00Z");

describe("creneauEnvoyable", () => {
  it("la liste des statuts envoyables est « valide » et « programme »", () => {
    expect([...STATUTS_CRENEAU_ENVOYABLES]).toEqual(["valide", "programme"]);
  });
  it.each([
    ["valide", base, true],
    ["programme", { ...base, statut: "programme" }, true],
    ["a_valider", { ...base, statut: "a_valider" }, false],
    ["propose", { ...base, statut: "propose" }, false],
    ["archive", { ...base, statut: "archive" }, false],
    ["valideeLe absent", { ...base, valideeLe: undefined }, false],
    ["valideeLe vide", { ...base, valideeLe: "" }, false],
    ["valideeLe illisible", { ...base, valideeLe: "demain" }, false],
    ["programme + refusé", { ...base, statut: "programme", refuseLe: "2026-11-13T10:00:00Z" }, false],
    ["programme + retiré", { ...base, statut: "programme", retireLe: "2026-11-13T10:00:00Z" }, false],
    ["programme + à renvoyer", { ...base, statut: "programme", aRenvoyer: true }, false],
  ])("%s → %s", (_n, c, attendu) => {
    expect(creneauEnvoyable(c as never)).toBe(attendu);
  });
  it("avec l'heure : une validation dans le futur est refusée", () => {
    expect(creneauEnvoyable(base as never, MAINTENANT)).toBe(true);
    expect(creneauEnvoyable({ ...base, valideeLe: "2026-11-20T10:00:00Z" } as never, MAINTENANT)).toBe(false);
  });
});

describe("visuelEnvoyable", () => {
  it.each([["valide", true], ["programme", true], ["a_valider", false], ["refuse", false], ["brouillon", false]])("%s → %s", (statut, attendu) => {
    expect(visuelEnvoyable({ statut } as never)).toBe(attendu);
  });
});
