/**
 * QUAL-4 · Contrôle objectif de composition : une image illisible doit être DÉTECTÉE (pur, 0 €, sans navigateur).
 * Fixture : propriétés RÉELLES du rendu « avant » (repli, 41,4 s, 4:5) ; plans synthétiques pour les autres défauts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controlerComposition, type EntreeControleComposition } from "../../src/briques/plan-scenes/tutoriel/controle-composition";
import type { ElementVisible, ImageSansVoix } from "../../src/briques/plan-scenes/tutoriel/sans-voix/types";
import type { PlanValide } from "../../src/briques/plan-scenes/schema";
import type { DonneesCalque } from "../../src/briques/sous-titres/scene";
import { TOILES } from "../../src/briques/plan-scenes/toiles";
import { imagesPlanValideA, rectsSousTitresA, TAILLES_TEXTE_PIECES } from "../../src/moteurs/montage-tutoriel-outil/geometrie-plan-valide";

const avant = JSON.parse(readFileSync(join(__dirname, "fixtures/qual-repli-avant.json"), "utf8"))[0] as { plan: PlanValide; sousTitres: DonneesCalque };

const FORMAT = { largeur: 1080, hauteur: 1350, fps: 25 as const };

function planSynthetique(scenes: unknown[], dureeMs = 6000): PlanValide {
  return { version: "plan-scenes-1", format: FORMAT, facecam: false, dureeMs, habillage: { fond: "ivoire", accent: "terracotta" }, mots: [], scenes } as unknown as PlanValide;
}
const scene = (s: Record<string, unknown>) => ({ id: "s1", version: 1, mots: { premier: 0, dernier: 1 }, debutMs: 0, finMs: 6000, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 }, ...s });
const controler = (plan: PlanValide, extra: Partial<EntreeControleComposition> = {}) =>
  controlerComposition({ format: plan.format, dureeMs: plan.dureeMs, imagesA: imagesPlanValideA(plan), sousTitresA: () => [], ...extra });
const codes = (r: ReturnType<typeof controlerComposition>) => r.defauts.map((d) => d.code);

describe("fixture « avant » (repli réel)", () => {
  const r = controlerComposition({ format: avant.plan.format, dureeMs: avant.plan.dureeMs, imagesA: imagesPlanValideA(avant.plan), sousTitresA: rectsSousTitresA(avant.sousTitres) });

  it("sous-titres sur la liste (≈ 8,8–17,6 s) et sur le repère (≈ 35–37 s)", () => {
    const rec = r.defauts.filter((d) => d.code === "SOUS_TITRES_RECOUVERTS");
    expect(rec.every((d) => d.gravite === "bloquant")).toBe(true);
    expect(rec.some((d) => d.debutMs >= 8500 && d.debutMs <= 11000 && d.finMs >= 16000 && d.finMs <= 18000)).toBe(true);
    expect(rec.some((d) => d.debutMs >= 34500 && d.finMs <= 37500)).toBe(true);
    expect(rec[0]!.message).toMatch(/\d+,\d s → \d+,\d s : le sous-titre recouvre/);
  });

  it("image vide au début et entre les deux scènes", () => {
    const vides = r.defauts.filter((d) => d.code === "IMAGE_VIDE");
    expect(vides.some((d) => d.debutMs === 0 && d.finMs >= 8800 && d.gravite === "bloquant")).toBe(true);
    expect(vides.some((d) => d.debutMs >= 17000 && d.debutMs <= 18000 && d.finMs >= 34000)).toBe(true);
    expect(r.mesures.videMaxMs).toBeGreaterThan(15000);
    expect(r.ok).toBe(false);
  });
});

describe("défauts synthétiques", () => {
  it("étiquette `texte` de 120 caractères : TEXTE_TROP_PETIT (≈ 20 px)", () => {
    const plan = planSynthetique([scene({ piece: "liste-au-mot", position: "gauche", parametres: { elements: [{ texte: "un", surMot: 0, aMs: 0 }, { texte: "deux", surMot: 1, aMs: 0 }] }, texte: "x".repeat(120) })]);
    const r = controler(plan);
    const d = r.defauts.find((x) => x.code === "TEXTE_TROP_PETIT");
    expect(d?.gravite).toBe("bloquant");
    expect(r.mesures.textePlusPetitPx).toBeGreaterThan(10);
    expect(r.mesures.textePlusPetitPx).toBeLessThan(26);
  });

  it("scène `curseur` de niveau 1 seule : CURSEUR_SANS_CIBLE (à corriger)", () => {
    const plan = planSynthetique([scene({ piece: "curseur", parametres: { trajet: [{ x: 10, y: 10 }, { x: 60, y: 50 }], clic: true, partDeplacement: 0.5 } })]);
    const d = controler(plan).defauts.find((x) => x.code === "CURSEUR_SANS_CIBLE");
    expect(d?.gravite).toBe("a-corriger");
  });

  it("curseur posé sur une liste : la cible existe", () => {
    const plan = planSynthetique([
      scene({
        niveau: 2,
        piece: "liste-crm",
        parametres: { titre: "Contacts", lignes: [{ nom: "Marie Durand", detail: "Devis", statut: "nouveau" }], surligner: 0 },
        calques: [
          { piece: "liste-crm", zone: "plein", debutMs: 0, parametres: { titre: "Contacts", lignes: [{ nom: "Marie Durand", detail: "Devis", statut: "nouveau" }], surligner: 0 } },
          { piece: "curseur", zone: "plein", debutMs: 0, parametres: { trajet: [{ x: 50, y: 17 }, { x: 50, y: 17 }], clic: true, partDeplacement: 0.5 } },
        ],
        position: "plein",
      }),
    ]);
    expect(codes(controler(plan)).includes("CURSEUR_SANS_CIBLE")).toBe(false);
  });

  it("calque `droite` + zoom caméra 1,6 : HORS_CADRE", () => {
    const liste = { titre: "Contacts", lignes: [{ nom: "Marie Durand", detail: "Devis", statut: "nouveau" }, { nom: "Paul Martin", detail: "Appel", statut: "gagne" }], surligner: -1 };
    const plan = planSynthetique([
      scene({ niveau: 2, piece: "liste-crm", parametres: liste, position: "droite", calques: [{ piece: "liste-crm", zone: "droite", debutMs: 0, parametres: liste }, { piece: "zoom-camera", zone: "plein", debutMs: 0, parametres: { cible: { x: 0, y: 50 }, facteur: 1.6, moment: 0, titreFenetre: "Zoom" } }] }),
    ]);
    expect(codes(controler(plan))).toContain("HORS_CADRE");
  });

  it("couleur inconnue : CHARTE", () => {
    const el: ElementVisible = { id: "a", genre: "texte", rect: { x: 100, y: 500, largeur: 400, hauteur: 60 }, opacite: 1, z: 0, taillePx: 48, couleur: "bleu" as never };
    const r = controlerComposition({ format: FORMAT, dureeMs: 1000, imagesA: (tMs): ImageSansVoix => ({ tMs, fond: "ivoire", elements: [el] }), sousTitresA: () => [] });
    expect(codes(r)).toEqual(["CHARTE"]);
  });

  it("bande réservée : la scène qui y entre est signalée", () => {
    const el: ElementVisible = { id: "a", genre: "texte", rect: { x: 100, y: 1000, largeur: 400, hauteur: 60 }, opacite: 1, z: 0, taillePx: 48 };
    const r = controlerComposition({ format: FORMAT, dureeMs: 1000, imagesA: (tMs) => ({ tMs, fond: "ivoire", elements: [el] }), sousTitresA: () => [], bande: { x: 0, y: 950, largeur: 1080, hauteur: 250 } });
    expect(codes(r)).toEqual(["SOUS_TITRES_RECOUVERTS"]);
    expect(r.defauts[0]!.message).toContain("bande réservée");
  });

  it("forme porteuse sans enfant visible = image vide ; 1,5 s : à corriger", () => {
    const porteuse: ElementVisible = { id: "carte", genre: "forme", rect: { x: 100, y: 400, largeur: 800, hauteur: 400 }, opacite: 1, z: 0 };
    const enfant: ElementVisible = { id: "t", genre: "texte", rect: { x: 140, y: 450, largeur: 400, hauteur: 50 }, opacite: 1, z: 1, taillePx: 44, parentId: "carte" };
    const r = controlerComposition({ format: FORMAT, dureeMs: 3000, imagesA: (tMs) => ({ tMs, fond: "ivoire", elements: [porteuse, { ...enfant, opacite: tMs < 1500 ? 0 : 1 }] }), sousTitresA: () => [] });
    expect(r.defauts).toHaveLength(1);
    expect(r.defauts[0]).toMatchObject({ code: "IMAGE_VIDE", gravite: "a-corriger", debutMs: 0, finMs: 1500 });
  });
});

describe("image propre", () => {
  it("légende « titre » centrée : aucun défaut", () => {
    const plan = planSynthetique([scene({ piece: "legende", parametres: { texte: "Vos stocks", sousTexte: "", style: "titre" } })]);
    const r = controler(plan);
    expect(r.defauts).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.mesures.textePlusPetitPx).toBeGreaterThanOrEqual(32);
  });
});

describe("la table des tailles de police ne dérive pas des briques", () => {
  const lire = (f: string) => readFileSync(join(__dirname, "../../src/briques/plan-scenes/briques", f), "utf8");
  const tailles = (f: string) => {
    const src = lire(f);
    const n = new Set<number>();
    for (const m of src.matchAll(/fontSize:\s*(\d+)/g)) n.add(Number(m[1]));
    for (const m of src.matchAll(/const taille =[^\n]*/g)) for (const x of m[0].matchAll(/\b(\d{2,3})\b/g)) n.add(Number(x[1]));
    return n;
  };
  for (const [piece, def] of Object.entries(TAILLES_TEXTE_PIECES)) {
    it(`${piece} : chaque taille de la table est dans ${def.fichier}`, () => {
      const dans = tailles(def.fichier);
      for (const v of Object.values(def.tailles)) expect(dans.has(v as number)).toBe(true);
    });
  }
  it("fichiers entièrement modélisés : aucune police du .tsx absente de la table", () => {
    for (const f of ["Legende.tsx", "TableauDeBord.tsx", "ListeCrm.tsx", "CarteKpi.tsx", "FenetreApp.tsx"]) {
      const table = new Set<number>(Object.values(TAILLES_TEXTE_PIECES).filter((d) => d.fichier === f).flatMap((d) => Object.values(d.tailles) as number[]));
      for (const v of tailles(f)) if (f !== "Legende.tsx" || v >= 40) expect(table.has(v)).toBe(true);
    }
  });
  it("les toiles utilisées existent", () => {
    for (const p of Object.keys(TAILLES_TEXTE_PIECES)) expect(TOILES[p as keyof typeof TOILES]).toBeDefined();
  });
});
