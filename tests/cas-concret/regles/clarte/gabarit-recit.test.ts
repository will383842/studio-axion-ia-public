/** Clarté · le gabarit de simulation d'un cas qui a un récit passe R02-R23 ET les critères de clarté C1-C7. */
import { describe, expect, it } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { CAS_STOCK } from "@/formats/cas-concret/stock-metiers";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { controlerClarte } from "@/moteurs/montage-cas-concret/clarte";
import { ficheParGabarit, jugerFiche } from "@/moteurs/montage-cas-concret/ecriture";
import { RECITS_DE_TEST, RECIT_LT02 } from "../../clarte/recits-de-test";

const FIXE = { videoId: "video-g", versionId: "version-g", habillage: "charte-duo/1", origine: "porte-a" } as const;
const lt02 = { ...trouverCas("transporteur-demandes-de-cotation")!, recit: RECIT_LT02 };

describe("gabarit avec récit", () => {
  it("LT-02 : l'accroche dit le sujet, la fiche passe les règles et la clarté", () => {
    const f = ficheParGabarit(lt02, FIXE);
    expect(f.ecrans[0].texteDit).toBe("Vos demandes de prix arrivent sans le poids.");
    const j = jugerFiche(f, { ...FIXE, cas: lt02 });
    if (!j.ok) throw new Error(j.refus.join("\n"));
    expect(j.clarte, j.clarte.join("\n")).toEqual([]);
    expect(controlerClarte(f, lt02)).toEqual([]);
  });

  it("quatre autres cas du stock, avec un récit écrit à la main : mêmes règles, même clarté", () => {
    for (const [id, recit] of Object.entries(RECITS_DE_TEST)) {
      const base = CAS_STOCK.find((c) => c.id === id)!;
      const cas = { ...base, recit };
      const f = ficheParGabarit(cas, FIXE);
      const j = jugerFiche(f, { ...FIXE, cas });
      if (!j.ok) throw new Error(`${id} : ${j.refus.join(" | ")}`);
      expect(j.clarte, `${id} : ${j.clarte.join(" | ")}`).toEqual([]);
    }
  });

  it("les cas du stock qui ont un récit (aucun avant l'import) passent aussi", () => {
    const avecRecit: CasConcret[] = CAS_STOCK.filter((c) => c.recit);
    const refuses: string[] = [];
    for (const c of avecRecit) {
      const f = ficheParGabarit(c, FIXE);
      const j = jugerFiche(f, { ...FIXE, cas: c });
      if (!j.ok) refuses.push(`${c.id} : ${j.refus.join(" | ").slice(0, 300)}`);
      else if (j.clarte.length) refuses.push(`${c.id} : ${j.clarte.join(" | ").slice(0, 300)}`);
    }
    expect(refuses, refuses.join("\n")).toEqual([]);
  });
});
