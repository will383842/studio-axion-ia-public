/** GV2-15 : un groupe de sous-titres n'est masqué que si la plaquette affiche déjà TOUS ses mots porteurs. */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";

const charger = async () => import("../../studio-rendu/compositions/interface-claire/motion-v4/registre-v4");
const remotionDisponible = (() => {
  try { createRequire(new URL("../../studio-rendu/package.json", import.meta.url)).resolve("remotion"); return true; } catch { return false; }
})();
const FPS = 30;
const CARTE: ElementV4Plan = { id: "CarteListe", debut: 10, fin: 16, mots: ["Pour vous"], lignes: [{ texte: "Relancer les clients", a: 11, icone: "x" }] } as ElementV4Plan;
const img = (s: number) => Math.round(s * FPS);

describe("groupeDoubleV4 · masquage par mots porteurs", () => {
  it.skipIf(!remotionDisponible)("sonde A3-3 : FACTURES, ET, QUE restent visibles", async () => {
    const { groupeDoubleV4 } = await charger();
    expect(groupeDoubleV4([CARTE], img(12), ["factures"])).toBe(false);
    expect(groupeDoubleV4([CARTE], img(12), ["et"])).toBe(false);
    expect(groupeDoubleV4([CARTE], img(12), ["que"])).toBe(false);
    expect(groupeDoubleV4([CARTE], img(12), ["vous", "oubliez"])).toBe(false);
  });
  it.skipIf(!remotionDisponible)("« LES CLIENTS » pendant la ligne « Relancer les clients » reste masqué", async () => {
    const { groupeDoubleV4 } = await charger();
    expect(groupeDoubleV4([CARTE], img(12), ["les", "clients"])).toBe(true);
  });
  it.skipIf(!remotionDisponible)("la ligne datée ne compte qu'à partir de son apparition", async () => {
    const { groupeDoubleV4 } = await charger();
    expect(groupeDoubleV4([CARTE], img(10.5), ["les", "clients"])).toBe(false);
  });
  it.skipIf(!remotionDisponible)("« VOS DEVIS » sous une plaquette « DEVIS » reste visible", async () => {
    const { groupeDoubleV4 } = await charger();
    const e: ElementV4Plan = { id: "EtiquetteTete", debut: 1, fin: 3, mots: ["DEVIS"] };
    expect(groupeDoubleV4([e], img(2), ["vos", "devis"])).toBe(true);
    expect(groupeDoubleV4([e], img(2), ["vos", "devis", "clients"])).toBe(false);
  });
  it.skipIf(!remotionDisponible)("un groupe sans mot porteur n'est pas masqué", async () => {
    const { groupeDoubleV4 } = await charger();
    expect(groupeDoubleV4([CARTE], img(12), ["les", "des"])).toBe(false);
  });
});
