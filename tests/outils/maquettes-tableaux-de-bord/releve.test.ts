/**
 * T-EXT-37b : le relevé de l'essai réel est pur. Aucun fichier, aucun réseau, aucun appel : 0 €.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DUREE_CIBLE_SEC } from "@/moteurs/montage-tutoriel-outil/equipe/chef-de-projet";
import { DUREE_MAX_SEC, DUREE_MIN_SEC, releverEssai, type EssaiReleve } from "../../../outils/maquettes-tableaux-de-bord/essai-reel/releve";

const bon = (): EssaiReleve => ({
  devis: { appelsClaude: 4, caracteresVoix: 700, rendus: 6 },
  consomme: { appelsClaude: 4, caracteresVoix: 700, rendus: 6 },
  depensesReelles: [
    { etape: "plan", fournisseur: "anthropic", centimes: 40 },
    { etape: "voix", fournisseur: "heygen", centimes: 90 },
  ],
  plafondClaudeCentimes: 100,
  dureeSec: 47,
  ratios: ["4:5", "9:16", "1:1"],
  grille: { note: 100, proposable: true, criteres: [] },
});
const avec = (sur: Partial<EssaiReleve>): EssaiReleve => ({ ...bon(), ...sur });

describe("relevé de l'essai réel du pilote 05", () => {
  it("consommé = devis : conforme, sans écart", () => {
    expect(releverEssai(bon())).toEqual({ verdict: "conforme", ecarts: [] });
  });

  it("moins que le devis : conforme (le devis est un plafond)", () => {
    expect(releverEssai(avec({ consomme: { appelsClaude: 2, caracteresVoix: 500, rendus: 3 } })).verdict).toBe("conforme");
  });

  it("un appel Claude de plus que le devis : à revoir", () => {
    const r = releverEssai(avec({ consomme: { appelsClaude: 5, caracteresVoix: 700, rendus: 6 } }));
    expect(r.verdict).toBe("a-revoir");
    expect(r.ecarts).toHaveLength(1);
    expect(r.ecarts[0]).toContain("Plus que le devis");
  });

  it("voix ou rendus au-dessus du devis : à revoir", () => {
    expect(releverEssai(avec({ consomme: { appelsClaude: 4, caracteresVoix: 701, rendus: 6 } })).verdict).toBe("a-revoir");
    expect(releverEssai(avec({ consomme: { appelsClaude: 4, caracteresVoix: 700, rendus: 7 } })).verdict).toBe("a-revoir");
  });

  it("dépense Claude au-dessus du plafond par vidéo : à revoir ; pile au plafond : conforme", () => {
    const sur = releverEssai(avec({ depensesReelles: [{ etape: "plan", fournisseur: "claude", centimes: 101 }] }));
    expect(sur.verdict).toBe("a-revoir");
    expect(sur.ecarts[0]).toContain("plafond");
    expect(releverEssai(avec({ depensesReelles: [{ etape: "plan", fournisseur: "claude", centimes: 100 }] })).verdict).toBe("conforme");
  });

  it("les dépenses réelles inscrites sous « anthropic » comptent : au-dessus du plafond, à revoir (et « claude », « Anthropic » aussi)", () => {
    for (const f of ["anthropic", "claude", " Anthropic "]) {
      const r = releverEssai(avec({ depensesReelles: [{ etape: "plan", fournisseur: f, centimes: 101 }] }));
      expect(r.verdict).toBe("a-revoir");
      expect(r.ecarts[0]).toContain("plafond");
    }
    expect(releverEssai(avec({ depensesReelles: [{ etape: "plan", fournisseur: "anthropic", centimes: 60 }, { etape: "ecrit", fournisseur: "claude", centimes: 41 }] })).verdict).toBe("a-revoir");
  });

  it("chiffre de dépense Claude illisible ou plafond illisible (NaN, négatif) : à revoir, jamais conforme par défaut", () => {
    const lisible = releverEssai(avec({ depensesReelles: [{ etape: "plan", fournisseur: "anthropic", centimes: Number.NaN }] }));
    expect(lisible.verdict).toBe("a-revoir");
    expect(lisible.ecarts.join(" ")).toContain("illisible");
    // une ligne négative ne doit pas masquer un dépassement : 150 anthropic + (-100) claude pour un plafond de 100
    const negatif = releverEssai(avec({ plafondClaudeCentimes: 100, depensesReelles: [{ etape: "plan", fournisseur: "anthropic", centimes: 150 }, { etape: "ecrit", fournisseur: "claude", centimes: -100 }] }));
    expect(negatif.verdict).toBe("a-revoir");
    expect(negatif.ecarts.join(" ")).toContain("illisible");
    for (const plafond of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const r = releverEssai(avec({ plafondClaudeCentimes: plafond }));
      expect(r.verdict).toBe("a-revoir");
      expect(r.ecarts.join(" ")).toContain("illisible");
    }
  });

  it("la durée vient de DUREE_CIBLE_SEC (une seule source)", () => {
    expect([DUREE_MIN_SEC, DUREE_MAX_SEC]).toEqual([...DUREE_CIBLE_SEC]);
  });

  it("la voix n'entre pas dans le plafond Claude", () => {
    expect(releverEssai(avec({ depensesReelles: [{ etape: "voix", fournisseur: "heygen", centimes: 5000 }] })).verdict).toBe("conforme");
  });

  it("ratio 1:1 manquant : à revoir", () => {
    const r = releverEssai(avec({ ratios: ["4:5", "9:16"] }));
    expect(r.verdict).toBe("a-revoir");
    expect(r.ecarts).toEqual(["Il manque le format 1:1."]);
  });

  it("durée : 40 et 55 s passent, 56 s et 39 s sont à revoir", () => {
    expect(releverEssai(avec({ dureeSec: 40 })).verdict).toBe("conforme");
    expect(releverEssai(avec({ dureeSec: 55 })).verdict).toBe("conforme");
    expect(releverEssai(avec({ dureeSec: 56 })).verdict).toBe("a-revoir");
    expect(releverEssai(avec({ dureeSec: 39 })).verdict).toBe("a-revoir");
    expect(releverEssai(avec({ dureeSec: Number.NaN })).verdict).toBe("a-revoir");
  });

  it("grille non proposable : à revoir", () => {
    const r = releverEssai(avec({ grille: { note: 60, proposable: false, criteres: [] } }));
    expect(r.verdict).toBe("a-revoir");
    expect(r.ecarts[0]).toContain("grille");
  });

  it("chiffre manquant : à revoir, jamais conforme par défaut", () => {
    const r = releverEssai(avec({ consomme: { appelsClaude: Number.NaN, caracteresVoix: 700, rendus: 6 } }));
    expect(r.verdict).toBe("a-revoir");
  });

  it("plusieurs écarts : tous listés, en phrases simples, sans montant", () => {
    const r = releverEssai(avec({ ratios: ["4:5"], dureeSec: 60, grille: { note: 10, proposable: false, criteres: [] } }));
    expect(r.ecarts.length).toBe(4);
    expect(r.ecarts.join(" ")).not.toMatch(/€|euro|JSON|API/i);
  });

  it("aucune entrée-sortie : le module n'importe ni fs ni fetch", () => {
    const source = readFileSync(join(process.cwd(), "outils/maquettes-tableaux-de-bord/essai-reel/releve.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["'](node:)?(fs|child_process|http|https|net)["']/);
    expect(source).not.toMatch(/\bfetch\s*\(|\brequire\s*\(|\bimport\s*\(/);
  });
});
