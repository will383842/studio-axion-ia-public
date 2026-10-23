/** La police des briques v4 (sous-titres) se recharge au rendu de production : à l'import, `mediasBase` est illisible (404, repli, 18/10). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ic = "studio-rendu/compositions/interface-claire";
const lire = (p: string) => readFileSync(`${ic}/${p}`, "utf8").replace(/\r\n/g, "\n");

describe("briques v4 · police rechargée au rendu", () => {
  it("chargerPolice est exportée et un échec n'est pas mémorisé", () => {
    const s = lire("motion-v4/communs/briques-v4.tsx");
    expect(s).toContain("export function chargerPolice()");
    expect(s).toContain("if (echecsPolice++ < 1) policeChargee = null;");
    expect(s).toMatch(/policeChargee = null;\n\s+continueRender\(attente\);/);
  });
  it("VideoAnimeeV4 l'appelle comme les polices des lots 2 et 4", () => {
    const s = lire("VideoAnimeeV4.tsx");
    expect(s).toContain("chargerPolice,");
    expect(s).toMatch(/chargerMontserratBlack\(\);\n\s+chargerPolice\(\);/);
  });
});
