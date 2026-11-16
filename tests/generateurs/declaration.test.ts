import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { listerFormats } from "@/formats";
import { CATALOGUE_CAPACITES } from "@/briques/bibliotheque-video/catalogue";
import { famille } from "@/domaine/vignettes";
import { DECLARATIONS, declarationDuFormat } from "@/generateurs/declaration";

const RACINE = resolve(__dirname, "../..");
const FORMATS = listerFormats({ inclureMasques: true, inclureReservesAWill: true });
/** Écart connu, corrigé par G1-05b : `famille()` dit « visage » pour tutoriel-outil, la déclaration dit non. */
const ECARTS_VISAGE = ["tutoriel-outil"];

describe("déclaration unique des générateurs (G1-05a)", () => {
  it("couverture : une déclaration pour chaque format du registre, et rien d'autre", () => {
    expect(Object.keys(DECLARATIONS).sort()).toEqual(FORMATS.map((f) => f.id).sort());
    for (const f of FORMATS) expect(declarationDuFormat(f.id)?.formatId).toBe(f.id);
    expect(declarationDuFormat("inconnu")).toBeUndefined();
  });

  it("visage = !SANS_VISAGE (famille), sauf l'écart listé", () => {
    const ecarts = FORMATS.filter((f) => DECLARATIONS[f.id].visage !== famille(f.id).visage).map((f) => f.id);
    expect(ecarts).toEqual(ECARTS_VISAGE);
    expect(DECLARATIONS["tutoriel-outil"].visage).toBe(false);
  });

  it("ratios ⊆ ratios du format, non vides", () => {
    for (const f of FORMATS) {
      const d = DECLARATIONS[f.id];
      expect(d.ratios.length, f.id).toBeGreaterThan(0);
      for (const r of d.ratios) expect(f.ratios as readonly string[], `${f.id} ${r}`).toContain(r);
    }
  });

  it("capacités consommées ∈ catalogue", () => {
    const ids = new Set<string>(CATALOGUE_CAPACITES.map((l) => l.id));
    for (const d of Object.values(DECLARATIONS)) for (const c of d.consomme) expect(ids.has(c), `${d.formatId} ${c}`).toBe(true);
  });

  it("objets figés", () => {
    expect(Object.isFrozen(DECLARATIONS)).toBe(true);
    for (const d of Object.values(DECLARATIONS)) {
      expect(Object.isFrozen(d), d.formatId).toBe(true);
      for (const t of [d.consomme, d.artefacts, d.operations, d.ratios]) expect(Object.isFrozen(t), d.formatId).toBe(true);
    }
  });

  it("garde statique : aucun import de services, studio-rendu ni fichier d'argent ; rendu-couleur inchangé", () => {
    const src = readFileSync(join(RACINE, "src/generateurs/declaration.ts"), "utf8");
    const imports = [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) {
      expect(i).not.toMatch(/@\/services|studio-rendu|credits|budget|couts|plafond|depense|generation-claude|mode-budget|autonomie|cle-depense/);
    }
    expect(src).not.toMatch(/ecrivainSite|ecritSesTextes/);
    expect(readFileSync(join(RACINE, "src/briques/charte/rendu-couleur.ts"), "utf8")).not.toMatch(/generateurs\/declaration/);
  });
});
