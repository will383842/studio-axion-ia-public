/**
 * L2-06 · infographie : un spec par gabarit donne une image aux dimensions du profil (1:1, 9:16) ; un texte qui déborde est refusé ;
 * palette 2026 seule ; rendu simulé (aucun navigateur, aucun réseau, aucun appel réel).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE } from "@/briques/charte/axion-2026";
import { InfographieSpec } from "@/domaine/visuels/schema-infographie";
import type { DemandeRendu, EtatRendu, OperationRendu, ServiceRendu } from "@/fournisseurs/types";
import { OPERATIONS, verifierDemande } from "../../studio-rendu/src/contrat";
import {
  ErreurDebordementInfographie,
  FORMATS_INFOGRAPHIE,
  GABARITS_INFOGRAPHIE,
  miseEnPageInfographie,
  type Gabarit,
  type RatioInfographie,
} from "../../studio-rendu/compositions/visuels/infographie/gabarits/mise-en-page";

const DOSSIER = resolve(__dirname, "../../studio-rendu/compositions/visuels/infographie");

const bloc = (i: number, valeur = true) => ({ titre: `Point ${i}`, texte: `Une phrase courte pour le point ${i}.`, ...(valeur ? { valeur: `${i * 10} %` } : {}) });
const spec = (n: number, valeur = true) => InfographieSpec.parse({ version: "infographie/1", alt: "Exemple fictif", titre: "Trois chiffres à retenir", blocs: Array.from({ length: n }, (_, i) => bloc(i + 1, valeur)) });
const NB: Record<Gabarit, number> = { "chiffres-cles": 4, etapes: 4, comparaison: 2 };
const RATIOS: RatioInfographie[] = ["1:1", "9:16"];

describe("L2-06 · dimensions du profil", () => {
  it("1:1 = 1080 × 1080 et 9:16 = 1080 × 1920", () => {
    expect(FORMATS_INFOGRAPHIE["1:1"]).toEqual({ largeur: 1080, hauteur: 1080 });
    expect(FORMATS_INFOGRAPHIE["9:16"]).toEqual({ largeur: 1080, hauteur: 1920 });
    expect([...GABARITS_INFOGRAPHIE].sort()).toEqual(["chiffres-cles", "comparaison", "etapes"]);
  });
  for (const g of GABARITS_INFOGRAPHIE) {
    for (const r of RATIOS) {
      it(`${g} en ${r} : image aux dimensions du profil, tout le texte dans l'image et ≥ 26 px`, () => {
        const m = miseEnPageInfographie(g, r, spec(NB[g]));
        expect({ largeur: m.largeur, hauteur: m.hauteur }).toEqual(FORMATS_INFOGRAPHIE[r]);
        expect(m.textes.length).toBeGreaterThan(NB[g]);
        for (const t of m.textes) {
          expect(t.taille).toBeGreaterThanOrEqual(26);
          expect(t.x).toBeGreaterThanOrEqual(0);
          expect(t.y).toBeGreaterThanOrEqual(0);
          expect(t.x + t.largeur).toBeLessThanOrEqual(m.largeur);
          expect(t.y + t.hauteur).toBeLessThanOrEqual(m.hauteur);
          expect(t.lignes.length * t.taille).toBeLessThanOrEqual(t.hauteur);
        }
      });
    }
  }
});

describe("L2-06 · un texte qui déborde est refusé", () => {
  it("huit étapes en 1:1 : trop serré, refusé avec le nom de la zone", () => {
    expect(() => miseEnPageInfographie("etapes", "1:1", spec(8))).toThrow(ErreurDebordementInfographie);
  });
  it("un mot plus large que sa boîte est refusé", () => {
    const s = InfographieSpec.parse({ version: "infographie/1", alt: "x", titre: "Titre", blocs: [{ titre: "A".repeat(60), texte: "ok", valeur: "1" }, bloc(2)] });
    expect(() => miseEnPageInfographie("comparaison", "1:1", s)).toThrow(/déborde/);
  });
  it("chiffres clés sans valeur, ou comparaison de plus de deux blocs : refusés", () => {
    expect(() => miseEnPageInfographie("chiffres-cles", "1:1", spec(3, false))).toThrow(/valeur/);
    expect(() => miseEnPageInfographie("comparaison", "1:1", spec(3))).toThrow(/deux/);
  });
});

describe("L2-06 · palette 2026 seule", () => {
  const permises = new Set<string>(Object.values(PALETTE).map((c) => c.toLowerCase()));
  it("toutes les couleurs de la mise en page viennent de la palette", () => {
    for (const g of GABARITS_INFOGRAPHIE) for (const r of RATIOS) {
      const m = miseEnPageInfographie(g, r, spec(NB[g]));
      expect(permises.has(m.fond.toLowerCase())).toBe(true);
      for (const f of m.formes) expect(permises.has(f.fond.toLowerCase())).toBe(true);
      for (const t of m.textes) expect(permises.has(t.couleur.toLowerCase())).toBe(true);
    }
  });
  it("orange seulement sur fond noir ; terracotta jamais sur noir", () => {
    for (const g of GABARITS_INFOGRAPHIE) for (const r of RATIOS) {
      const m = miseEnPageInfographie(g, r, spec(NB[g]));
      for (const t of m.textes) {
        if (t.couleur === PALETTE.orange) expect(t.surFond).toBe(PALETTE.noir);
        if (t.couleur === PALETTE.terracotta) expect(t.surFond).not.toBe(PALETTE.noir);
      }
    }
  });
  it("aucune couleur en dur dans les fichiers de l'infographie", () => {
    const lire = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? lire(join(d, n)) : [readFileSync(join(d, n), "utf8")]));
    for (const src of lire(DOSSIER)) expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|gradient/);
  });
});

describe("L2-06 · rendu simulé", () => {
  it("l'opération « infographie » est connue des deux copies du contrat, file courte", () => {
    const op: OperationRendu = "infographie";
    expect(OPERATIONS).toContain(op);
    const d: DemandeRendu = { idRendu: "r1", operation: op, file: "courte", entrees: {}, sortie: { urlDepot: "https://r2.exemple/depot", cle: "sorties/r1" }, parametres: { gabarit: "etapes", ratio: "9:16", spec: spec(4) } };
    expect(() => verifierDemande(d)).not.toThrow();
  });
  it("service simulé : une demande par gabarit et par ratio, terminée, sans appel réel", async () => {
    const soumises: DemandeRendu[] = [];
    const service: ServiceRendu = {
      async soumettre(d) { soumises.push(d); return { idRendu: d.idRendu }; },
      async etat(id): Promise<EtatRendu> { return { statut: "termine", sortieCle: `cle/${id}`, mesures: { debordements: 0 } }; },
    };
    for (const g of GABARITS_INFOGRAPHIE) for (const r of RATIOS) {
      const id = `${g}-${r}`;
      await service.soumettre({ idRendu: id, operation: "infographie", file: "courte", entrees: {}, sortie: { urlDepot: "https://r2.exemple/d", cle: id }, parametres: { gabarit: g, ratio: r, spec: spec(NB[g]) } });
      expect(await service.etat(id)).toMatchObject({ statut: "termine" });
    }
    expect(soumises).toHaveLength(6);
  });
});
