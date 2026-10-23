/** Lot H2 · point 1 : le pire cas de la chaîne courte compte le bloc mémoire (réglage allumé) ; éteint, il ne change pas d'un octet. */
import { describe, expect, it } from "vitest";
import { pireCasChaine } from "@/generateur/pire-cas";
import { MEMOIRE_MAX_CARACTERES } from "@/domaine/ecriture-commune/memoire";
import { etapeZeroBanc } from "../helpers/g4";
import { SUJETS_BANC } from "../generateur/banc/registre-banc-g4";

const z = etapeZeroBanc(SUJETS_BANC[0]);
if (!z.ok) throw new Error("étape 0");
// Le banc est un sujet « avocat » (hors mémoire) : on le range sous un autre format pour mesurer la mémoire.
const donnees = { ...z.donnees, sujet: { ...z.donnees.sujet, formatId: "facecam" } };

describe("pire cas chaîne courte et mémoire centrale", () => {
  it("réglage éteint : identique octet pour octet (option absente ou fausse)", () => {
    const sans = pireCasChaine("courte", { donnees });
    expect(JSON.stringify(pireCasChaine("courte", { donnees, options: { memoireAuPire: false } }))).toBe(JSON.stringify(sans));
    expect(JSON.stringify(pireCasChaine("courte", { donnees, options: {} }))).toBe(JSON.stringify(sans));
  });
  it("réglage allumé : l'étape 2 compte au moins le bloc maximal en plus (entrée), les autres étapes ne bougent pas", () => {
    const sans = pireCasChaine("courte", { donnees });
    const avec = pireCasChaine("courte", { donnees, options: { memoireAuPire: true } });
    const entree = (p: typeof sans, etape: number) => p.detail.find((x) => x.etape === etape)!.jetonsEntree;
    expect(entree(avec, 2) - entree(sans, 2)).toBeGreaterThanOrEqual(Math.floor(MEMOIRE_MAX_CARACTERES / 6));
    for (const e of [1, 3]) expect(entree(avec, e)).toBe(entree(sans, e));
    expect(avec.usd).toBeGreaterThanOrEqual(sans.usd);
  });
  it("avocat : la mémoire n'entre jamais, le pire cas ne bouge pas", () => {
    const d = z.donnees;
    expect(JSON.stringify(pireCasChaine("courte", { donnees: d, options: { memoireAuPire: true } }))).toBe(JSON.stringify(pireCasChaine("courte", { donnees: d })));
  });
});
