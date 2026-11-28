/**
 * S-13-d-v20j · le réglage `tableau.preteAvecRemarques` (ÉTEINT par défaut, seul `true` exact allume) est lu par UN module
 * (`tableau-remarques.ts`) et passe l'option `preteAvecRemarques: true` (S-13-b) aux outils de la fabrication ET à la relecture
 * de la console. Chemin réel : `servicesTableau().outils`, vraie `relireBrouillonTableau`, dépôts en mémoire, 0 appel réel.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { servicesTableau } from "@/moteurs/montage-tableau";
import { PARAM_PRETE_AVEC_REMARQUES, preteAvecRemarquesActive } from "@/services/tableau-remarques";
import { relireBrouillonTableau } from "@/services/tableau-creation";
import { AUJOURDHUI_EXEMPLES, contexteExemple, ficheDemonstration } from "./regles/exemples";

vi.mock("@/services/tableau-outils", async (original) => {
  const vrai = await original<typeof import("@/services/tableau-outils")>();
  return { ...vrai, branchementsReels: async () => ({ env: "dev", voix: { fournisseurVoix: "simulation" }, scenes: {}, montage: {} }) };
});
// Espion de passage : la vraie relecture tourne ; on note l'option reçue.
const recues: Record<string, unknown>[] = [];
vi.mock("@/moteurs/montage-tableau/relecture", async (original) => {
  const vrai = await original<typeof import("@/moteurs/montage-tableau/relecture")>();
  return { ...vrai, relireFicheTableau: (e: Record<string, unknown>) => (recues.push(e), vrai.relireFicheTableau(e as never)) };
});

const COMMANDE = { videoId: "v-remarques", formatId: "tableau-anime", distribution: [{ role: "voix", source: "double", personnageId: "williams" }], entrees: { tableau: { sorties: ["vertical"] } }, reseaux: [] } as never;
async function outils() {
  await import("@/services/tableau-branchements");
  return (await servicesTableau().outils!(COMMANDE, "trav-remarques"))!;
}
const BROUILLON = { donnees: { reseaux: ["instagram"], texte: "t", mot: undefined }, dejaVu: undefined } as never;
async function console_() {
  recues.length = 0;
  const f = ficheDemonstration;
  const r = await relireBrouillonTableau(BROUILLON, f, { ...contexteExemple(f), aujourdhui: AUJOURDHUI_EXEMPLES } as never);
  return { r, recu: recues[0] };
}

describe("S-13-d-v20j · tableau.preteAvecRemarques", () => {
  beforeEach(() => reinitialiserDepots());

  it("(a) éteint = identique : absent, false, « true », 1, {}, null : aucune clé dans les outils ni dans la relecture de la console", async () => {
    expect(PARAM_PRETE_AVEC_REMARQUES).toBe("tableau.preteAvecRemarques");
    expect("preteAvecRemarques" in (await outils())).toBe(false);
    expect("preteAvecRemarques" in (await console_()).recu!).toBe(false);
    for (const v of [false, "true", 1, {}, null]) {
      await ecrireParametre(PARAM_PRETE_AVEC_REMARQUES, v);
      expect("preteAvecRemarques" in (await outils()), JSON.stringify(v)).toBe(false);
      expect("preteAvecRemarques" in (await console_()).recu!, JSON.stringify(v)).toBe(false);
    }
  });

  it("(a bis) lecture qui lève : faux, aucune clé", async () => {
    expect(await preteAvecRemarquesActive(async () => { throw new Error("panne"); })).toBe(false);
    for (const v of [undefined, false, "true", 1, null, {}]) expect(await preteAvecRemarquesActive((async () => v) as never)).toBe(false);
  });

  it("(b) réglage = true : les outils de la fabrication ET la relecture de la console portent preteAvecRemarques: true ; retour à false : l'option disparaît", async () => {
    await ecrireParametre(PARAM_PRETE_AVEC_REMARQUES, true);
    expect((await outils()).preteAvecRemarques).toBe(true);
    expect((await outils()).preteAvecRemarques).toBe(true); // 2e appel identique
    const c = await console_();
    expect(c.recu!.preteAvecRemarques).toBe(true);
    expect(c.r).toBeDefined();
    await ecrireParametre(PARAM_PRETE_AVEC_REMARQUES, false);
    expect("preteAvecRemarques" in (await outils())).toBe(false);
    expect("preteAvecRemarques" in (await console_()).recu!).toBe(false);
  });

  it("(c) un seul lecteur de la clé dans src/** : tableau-remarques.ts, défaut false, seul true exact allume", () => {
    const fichiers = execSync("git ls-files --cached --others --exclude-standard 'src/**/*.ts' 'src/**/*.tsx'", { encoding: "utf8" }).split("\n").filter(Boolean);
    const lecteurs = fichiers.filter((f) => /lireParametre|l<unknown>/.test(readFileSync(f, "utf8")) && /PARAM_PRETE_AVEC_REMARQUES(?![A-Z_])|tableau\.preteAvecRemarques/.test(readFileSync(f, "utf8")));
    expect(lecteurs).toEqual(["src/services/tableau-remarques.ts"]);
    expect(readFileSync("src/services/tableau-remarques.ts", "utf8")).toMatch(/l<unknown>\(PARAM_PRETE_AVEC_REMARQUES, false\)\) === true/);
  });

  it("(d) garde : tableau-creation.ts n'importe jamais tableau-branchements (qui se branche à l'import)", () => {
    expect(readFileSync("src/services/tableau-creation.ts", "utf8")).not.toMatch(/from ["'](?:\.\/|@\/services\/)tableau-branchements["']/);
  });
});
