import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DECLARATIONS } from "../../src/generateurs/declaration";
import { ECARTS_CONNUS, LECTEURS_ARTEFACTS, artefactsDuResultat, type EntreeResultat } from "../../src/moteurs/contrat-artefacts";

const RACINE = join(__dirname, "..", "..");
const VIDE: EntreeResultat = { projetMontage: {} };
const plan = { ordre: 0 } as unknown as NonNullable<EntreeResultat["plans"]>[number];
const COMPLET_CAS_CONCRET: EntreeResultat = {
  projetMontage: { casConcret: { journal: { version: 1, etapes: {} }, voix: { fournisseur: "x" } } },
  plans: [plan],
};

describe("contrat des artefacts (G12-04)", () => {
  it("couverture : chaque (format, artefact) de DECLARATIONS a une entrée, et rien d'autre", () => {
    expect(Object.keys(LECTEURS_ARTEFACTS).sort()).toEqual(Object.keys(DECLARATIONS).sort());
    for (const [f, d] of Object.entries(DECLARATIONS)) {
      expect(Object.keys(LECTEURS_ARTEFACTS[f]).sort(), f).toEqual([...d.artefacts].sort());
    }
  });

  it("chaque entrée est un lecteur ou une raison non vide", () => {
    for (const [f, t] of Object.entries(LECTEURS_ARTEFACTS)) {
      for (const [a, e] of Object.entries(t)) {
        if (typeof e !== "function") expect(e.nonVerifiable.length, `${f}/${a}`).toBeGreaterThan(10);
      }
    }
  });

  it("chaque lecteur : avec le champ → presents, sans → manquants", () => {
    const avec: Record<string, EntreeResultat> = { "cas-concret": COMPLET_CAS_CONCRET };
    let vus = 0;
    for (const [f, t] of Object.entries(LECTEURS_ARTEFACTS)) {
      for (const [a, e] of Object.entries(t)) {
        if (typeof e !== "function") continue;
        vus++;
        const plein: EntreeResultat = a === "rendus-scenes"
          ? { projetMontage: { casConcret: { journal: { version: 1, etapes: {}, ecrans: { rendues: [] } } } } }
          : avec[f];
        expect(artefactsDuResultat(f, plein).presents, `${f}/${a} avec`).toContain(a);
        expect(artefactsDuResultat(f, VIDE).manquants, `${f}/${a} sans`).toContain(a);
      }
    }
    expect(vus).toBe(3);
  });

  it("non vérifiable n'est jamais présent ni manquant", () => {
    const r = artefactsDuResultat("facecam", COMPLET_CAS_CONCRET);
    expect(r).toEqual({ presents: [], manquants: [], nonVerifiables: ["plan"] });
  });

  it("ne lève jamais : format inconnu, résultat bancal, clés héritées", () => {
    const vide = { presents: [], manquants: [], nonVerifiables: [] };
    expect(artefactsDuResultat("inconnu", VIDE)).toEqual(vide);
    expect(artefactsDuResultat("constructor", VIDE)).toEqual(vide);
    expect(() => artefactsDuResultat("cas-concret", { projetMontage: null } as unknown as EntreeResultat)).not.toThrow();
    expect(artefactsDuResultat("cas-concret", { projetMontage: { casConcret: [] } }).manquants).toEqual(["plan", "voix", "rendus-scenes"]);
  });

  it("ECARTS_CONNUS égale exactement les manquants des résultats complets d'aujourd'hui", () => {
    const manquants = Object.keys(DECLARATIONS).flatMap((f) => {
      const complet = f === "cas-concret" ? COMPLET_CAS_CONCRET : VIDE;
      return artefactsDuResultat(f, complet).manquants
        .filter(() => f === "cas-concret")
        .map((a) => `${f}/${a}`);
    });
    expect(ECARTS_CONNUS.map((e) => `${e.formatId}/${e.artefact}`).sort()).toEqual(manquants.sort());
    for (const e of ECARTS_CONNUS) expect(e.raison.length).toBeGreaterThan(10);
  });

  it("garde statique : aucun import de services, studio-rendu ni fichier d'argent", () => {
    const src = readFileSync(join(RACINE, "src/moteurs/contrat-artefacts.ts"), "utf8");
    const imports = [...src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]);
    for (const i of imports) {
      expect(i).not.toMatch(/@\/services|studio-rendu|credits|budget|couts|plafond|depense|generation-claude|mode-budget|autonomie|cle-depense/);
    }
  });
});
