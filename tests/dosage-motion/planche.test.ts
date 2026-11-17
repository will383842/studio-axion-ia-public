/**
 * X3-13a : la planche du dosage (tableau « gardé / retiré » par générateur et par cran). Pure, sans rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CRANS_PERMIS, DOSAGE_DEFAUT_CODE, RETRAITS } from "@/briques/dosage-motion/crans";
import type { IdGenerateurDosage } from "@/briques/dosage-motion/types";
import { enMarkdown, tableauDosage } from "../../scripts/dosage-motion/planche";

const IDS = Object.keys(CRANS_PERMIS) as IdGenerateurDosage[];

afterEach(() => vi.restoreAllMocks());

describe("planche du dosage", () => {
  it("une ligne par couple générateur × cran permis, aucune pour un cran non permis", () => {
    const lignes = tableauDosage();
    const attendu = IDS.flatMap((g) => CRANS_PERMIS[g].map((c) => `${g}/${c}`));
    expect(lignes.map((l) => `${l.generateur}/${l.cran}`).sort()).toEqual(attendu.sort());
    expect(lignes.some((l) => l.generateur === "facecam-animee" && l.cran !== "dynamique")).toBe(false);
    expect(lignes.some((l) => l.generateur === "tableau" && l.cran === "aucun")).toBe(false);
  });

  it("sous-titres présents partout, défaut du code et retraits lus dans les tables", () => {
    for (const l of tableauDosage()) {
      expect(l.sousTitresPresents).toBe(true);
      expect(l.defautDuCode).toBe(DOSAGE_DEFAUT_CODE[l.generateur] === l.cran);
      expect(l.retraits).toEqual(RETRAITS[l.cran]);
      expect(l.commande.dosageMotion).toEqual({ cran: l.cran, choisiPar: "code" });
    }
  });

  it("sortie identique sur deux appels, sans réseau", () => {
    const f = vi.spyOn(globalThis, "fetch");
    expect(JSON.stringify(tableauDosage())).toBe(JSON.stringify(tableauDosage()));
    expect(enMarkdown(tableauDosage())).toBe(enMarkdown(tableauDosage()));
    expect(f).not.toHaveBeenCalled();
  });

  it("aucun import de service, fournisseur ou dépôt", () => {
    const src = readFileSync(join(process.cwd(), "scripts/dosage-motion/planche.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']@\/(services|fournisseurs|donnees)|depots/);
  });
});
