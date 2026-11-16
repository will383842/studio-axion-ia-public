/** C9-01 — socle des petits objets : zones, graine, tremblement, tons, contrat. */
import { describe, expect, it } from "vitest";
import { ZONE_VISAGE } from "../../src/briques/plan-scenes/zones";
import { DEMI_HAUTEUR_ST, Y_ST_MAX } from "../../studio-rendu/compositions/interface-claire/motion-v4/communs/zone-sure-v4";
import { CHARTE_AXION, TEINTES_INTERDITES } from "../../src/briques/jetons-motion";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import {
  BANDE_SOUS_TITRES, ZONE_VISAGE_OBJETS, verifierZone,
  fnv1a32, graineObjet, aleaGraine,
  tremblement, TREMBLEMENT,
  couleurDuTon, ERREUR_FILET_PERMIS,
  CAPACITES_OBJET, verifierDefinition, OBJETS_A_L_ECRAN_MAX, OBJETS_PAR_VIDEO_MAX, MOTS_MAX, SURFACE_MAX, DUREE_SEC,
  type DefinitionObjet,
} from "../../src/briques/motion/petits-objets";

describe("zones", () => {
  it("copie du visage égale à plan-scenes", () => expect(ZONE_VISAGE_OBJETS).toEqual(ZONE_VISAGE));
  it("bande des sous-titres égale à zone-sure-v4 (en %)", () => {
    expect(BANDE_SOUS_TITRES.x).toBe(0);
    expect(BANDE_SOUS_TITRES.largeur).toBe(100);
    expect(Math.abs(BANDE_SOUS_TITRES.y - (Y_ST_MAX - DEMI_HAUTEUR_ST) * 100)).toBeLessThan(1e-9);
    expect(Math.abs(BANDE_SOUS_TITRES.y + BANDE_SOUS_TITRES.hauteur - (Y_ST_MAX + DEMI_HAUTEUR_ST) * 100)).toBeLessThan(1e-9);
  });
  it("verifierZone", () => {
    expect(verifierZone({ x: 5, y: 72, largeur: 40, hauteur: 15 })).toBe("ok");
    expect(verifierZone({ x: 30, y: 20, largeur: 10, hauteur: 10 })).toMatchObject({ refus: expect.stringContaining("visage") });
    expect(verifierZone({ x: 5, y: 64, largeur: 20, hauteur: 3 })).toMatchObject({ refus: expect.stringContaining("sous-titres") });
    expect(verifierZone({ x: 90, y: 72, largeur: 20, hauteur: 10 })).toMatchObject({ refus: expect.stringContaining("cadre") });
    expect(verifierZone({ x: 0, y: 0, largeur: 100, hauteur: 70 })).toMatchObject({ refus: expect.stringContaining("surface") });
    // visage surchargé
    const visage = { x: 5, y: 72, largeur: 40, hauteur: 15 };
    expect(verifierZone(visage, { visage })).toMatchObject({ refus: expect.stringContaining("visage") });
    expect(verifierZone({ x: 30, y: 20, largeur: 10, hauteur: 10 }, { visage })).toBe("ok");
  });
});

describe("graine", () => {
  it("FNV-1a 32", () => {
    expect(fnv1a32("")).toBe(2166136261);
    expect(fnv1a32("a")).toBe(0xe40c292c);
  });
  it("déterministe, et distincte", () => {
    expect(graineObjet("v1", 2)).toBe(graineObjet("v1", 2));
    expect(graineObjet("v1", 2)).toBe(fnv1a32("v1#2"));
    const s = new Set<number>();
    for (let i = 0; i < 1000; i++) s.add(graineObjet(`video-${i % 250}`, Math.floor(i / 250)));
    expect(s.size).toBeGreaterThanOrEqual(990);
  });
  it("aleaGraine dans [0,1[ et pur", () => {
    for (let n = 0; n < 200; n++) {
      const a = aleaGraine(12345, n);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
      expect(a).toBe(aleaGraine(12345, n));
    }
  });
});

describe("tremblement 8 i/s", () => {
  it("déterministe et borné", () => {
    for (const g of [1, 42, graineObjet("v", 0)]) {
      for (let i = 0; i < 2000; i++) {
        const t = tremblement(g, i, 25);
        expect(t).toEqual(tremblement(g, i, 25));
        expect(Math.abs(t.dx)).toBeLessThanOrEqual(TREMBLEMENT.pxMax + 1e-9);
        expect(Math.abs(t.dy)).toBeLessThanOrEqual(TREMBLEMENT.pxMax + 1e-9);
        expect(Math.abs(t.angle)).toBeLessThanOrEqual(TREMBLEMENT.degresMax + 1e-9);
      }
    }
  });
  it("constant dans chaque palier, change entre paliers", () => {
    const g = 987;
    let change = false;
    for (let i = 1; i < 500; i++) {
      const memePalier = Math.floor((i * 8) / 25) === Math.floor(((i - 1) * 8) / 25);
      const a = tremblement(g, i, 25), b = tremblement(g, i - 1, 25);
      if (memePalier) expect(a).toEqual(b);
      else if (a.dx !== b.dx || a.dy !== b.dy || a.angle !== b.angle) change = true;
    }
    expect(change).toBe(true);
  });
});

describe("tons", () => {
  const tons = ["neutre", "accent", "valide", "erreur"] as const;
  const permises = new Set<string>([...Object.values(CHARTE_AXION), PALETTE.reussite]);
  it("chaque ton sur chaque fond est une couleur de la charte", () => {
    for (const t of tons) for (const f of ["ivoire", "noir"] as const) expect(permises.has(couleurDuTon(t, f))).toBe(true);
  });
  it("orange absent sur ivoire ; erreur = terracotta ; valide = sauge", () => {
    for (const t of tons) expect(couleurDuTon(t, "ivoire")).not.toBe(CHARTE_AXION.orange);
    expect(ERREUR_FILET_PERMIS).toBe(false);
    expect(couleurDuTon("erreur", "ivoire")).toBe(CHARTE_AXION.terracotta);
    expect(couleurDuTon("valide", "noir")).toBe(PALETTE.reussite);
    expect(couleurDuTon("accent", "noir")).toBe(CHARTE_AXION.orange);
    expect(couleurDuTon("accent", "ivoire")).toBe(CHARTE_AXION.terracotta);
  });
  it("aucune teinte interdite", () => {
    for (const t of tons) for (const f of ["ivoire", "noir"] as const) {
      const c = couleurDuTon(t, f).toLowerCase();
      for (const x of TEINTES_INTERDITES) expect(c).not.toContain(x);
    }
  });
});

describe("contrat", () => {
  it("les 12 capacités", () => {
    expect([...CAPACITES_OBJET].sort()).toEqual(
      ["objet.trait","objet.marque","objet.etiquette","objet.appel","objet.chiffre","objet.etape","objet.cartes","objet.schema","objet.ecran","objet.reseau-schema","objet.manuscrit","objet.emoji"].sort());
    expect(new Set(CAPACITES_OBJET).size).toBe(12);
    for (const c of CAPACITES_OBJET) expect(c.startsWith("objet.")).toBe(true);
  });
  it("constantes", () => {
    expect([OBJETS_A_L_ECRAN_MAX, OBJETS_PAR_VIDEO_MAX, MOTS_MAX, SURFACE_MAX]).toEqual([1, 4, 4, 0.6]);
    expect(DUREE_SEC).toEqual({ min: 0.4, max: 4 });
  });
  const base = (o: Record<string, unknown>) => ({
    id: "objet-trait", famille: "trait", capacite: "objet.trait", valider: () => null,
    toile: { largeur: 100, hauteur: 100 }, dureeSec: { min: 0.5, max: 2 }, donnees: "aucune", Rendu: () => null, ...o,
  }) as unknown as DefinitionObjet<unknown>;
  it("verifierDefinition", () => {
    expect(verifierDefinition(base({}))).toBe("ok");
    expect(verifierDefinition(base({ id: "trait" }))).not.toBe("ok");
    expect(verifierDefinition(base({ dureeSec: { min: 0.5, max: 5 } }))).not.toBe("ok");
    expect(verifierDefinition(base({ capacite: "objet.inconnu" }))).not.toBe("ok");
  });
});
