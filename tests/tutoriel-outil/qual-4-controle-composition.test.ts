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
import { couleursSousTitresDe, fondDuPlan, imagesPlanValideA, rectsSousTitresA, TAILLES_TEXTE_PIECES } from "../../src/moteurs/montage-tutoriel-outil/geometrie-plan-valide";

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
  const r = controlerComposition({ format: avant.plan.format, dureeMs: avant.plan.dureeMs, imagesA: imagesPlanValideA(avant.plan), sousTitresA: rectsSousTitresA(avant.sousTitres), couleursSousTitres: couleursSousTitresDe(avant.sousTitres, avant.plan), fond: fondDuPlan(avant.plan) });

  it("accent des sous-titres #D97757 sur fond ivoire : CHARTE", () => {
    expect(r.defauts.map((d) => d.code)).toContain("CHARTE");
    expect(r.defauts.find((d) => d.code === "CHARTE")!.message).toContain("#D97757");
  });

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
  it("étiquette `texte` posée sous une scène : TEXTE_TROP_PETIT (≈ 20 px, quelle que soit sa longueur)", () => {
    const plan = planSynthetique([scene({ piece: "liste-au-mot", position: "gauche", parametres: { elements: [{ texte: "un", surMot: 0, aMs: 0 }, { texte: "deux", surMot: 1, aMs: 0 }] }, texte: "x".repeat(120) })]);
    const r = controler(plan);
    const d = r.defauts.find((x) => x.code === "TEXTE_TROP_PETIT");
    expect(d?.gravite).toBe("bloquant");
    expect(r.mesures.textePlusPetitPx).toBeGreaterThan(10);
    expect(r.mesures.textePlusPetitPx).toBeLessThan(26);
  });

  it("l'étiquette est à ≈ 20 px même courte : la longueur ne compte pas", () => {
    const el = { id: "s1", elements: [{ texte: "un", surMot: 0, aMs: 0 }, { texte: "deux", surMot: 1, aMs: 0 }] };
    const court = controler(planSynthetique([scene({ piece: "liste-au-mot", position: "gauche", parametres: { elements: el.elements }, texte: "Ok" })]));
    const long = controler(planSynthetique([scene({ piece: "liste-au-mot", position: "gauche", parametres: { elements: el.elements }, texte: "x".repeat(120) })]));
    expect(court.mesures.textePlusPetitPx).toBe(long.mesures.textePlusPetitPx);
    expect(codes(court)).toContain("TEXTE_TROP_PETIT");
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

describe("faux positifs HORS_CADRE écartés", () => {
  const liste = { elements: [{ texte: "un", surMot: 0, aMs: 0 }, { texte: "deux", surMot: 1, aMs: 0 }] };
  it("scène `plein` : le panneau de toile à 20 px (≈ 21,6 px < 24) n'est pas une sortie du cadre", () => {
    const plan = planSynthetique([scene({ piece: "liste-au-mot", position: "plein", parametres: liste })]);
    expect(codes(controler(plan))).not.toContain("HORS_CADRE");
  });
  it("forme de repli inventée (pièce non modélisée) : jamais d'alerte de marge", () => {
    const plan = planSynthetique([scene({ piece: "compteur", position: "plein", parametres: { valeur: 3 } }), scene({ id: "s2", piece: "compteur", position: "droite", parametres: { valeur: 3 } })]);
    const els = imagesPlanValideA(plan)(3000).elements;
    expect(els.length).toBeGreaterThan(0);
    expect(els.every((x) => x.bordTolere === true)).toBe(true);
    expect(codes(controler(plan))).not.toContain("HORS_CADRE");
  });
  it("le contrôle : à 21,6 px du bord, signalé sans `bordTolere`, toléré avec ; une vraie sortie reste signalée", () => {
    const el = (rect: ElementVisible["rect"], plus: Partial<ElementVisible> = {}): ElementVisible => ({ id: "a", genre: "forme", rect, opacite: 1, z: 0, ...plus });
    const run = (e: ElementVisible) => controlerComposition({ format: FORMAT, dureeMs: 500, imagesA: (tMs) => ({ tMs, fond: "ivoire", elements: [e] }), sousTitresA: () => [] });
    const pres = { x: 21.6, y: 400, largeur: 500, hauteur: 300 };
    expect(codes(run(el(pres)))).toContain("HORS_CADRE");
    expect(codes(run(el(pres, { bordTolere: true })))).not.toContain("HORS_CADRE");
    expect(codes(run(el({ x: -30, y: 400, largeur: 500, hauteur: 300 }, { bordTolere: true })))).toContain("HORS_CADRE");
  });
  it("zoom caméra seul qui coupe un texte : HORS_CADRE (le rognage à la toile ne le masque plus)", () => {
    const plan = planSynthetique([scene({ piece: "zoom-camera", position: "centre", parametres: { cible: { x: 50, y: 50 }, facteur: 2.5, moment: 0, titreFenetre: "Contacts importants" } })]);
    const r = controler(plan);
    expect(codes(r)).toContain("HORS_CADRE");
    expect(r.defauts.find((d) => d.code === "HORS_CADRE")!.message).toContain("zoomée");
  });
  it("zoom caméra seul doux (facteur 1) : rien de coupé", () => {
    const plan = planSynthetique([scene({ piece: "zoom-camera", position: "centre", parametres: { cible: { x: 50, y: 50 }, facteur: 1, moment: 0, titreFenetre: "Contacts" } })]);
    expect(codes(controler(plan))).not.toContain("HORS_CADRE");
  });
});

describe("légendes centrées (Legende.tsx centre le texte)", () => {
  it("titre « Bonjour » : le centre du texte est le centre de la zone, pas poussé à droite", () => {
    const plan = planSynthetique([scene({ piece: "legende", position: "centre", parametres: { texte: "Bonjour", sousTexte: "", style: "titre" } })]);
    const t = imagesPlanValideA(plan)(3000).elements.find((x) => x.genre === "texte")!;
    expect(t.rect.x + t.rect.largeur / 2).toBeCloseTo(plan.format.largeur / 2, 1);
  });
  it("bandeau avec sous-texte : texte et sous-texte centrés sur la boîte", () => {
    const plan = planSynthetique([scene({ piece: "legende", position: "centre", parametres: { texte: "Bonjour", sousTexte: "à tous", style: "bandeau" } })]);
    for (const x of imagesPlanValideA(plan)(3000).elements.filter((e) => e.genre === "texte")) expect(x.rect.x + x.rect.largeur / 2).toBeCloseTo(plan.format.largeur / 2, 1);
  });
});

describe("sous-titres : taille, couleurs, rectangles par excès", () => {
  const vide = (tMs: number): ImageSansVoix => ({ tMs, fond: "ivoire", elements: [] });
  const elTxt: ElementVisible = { id: "a", genre: "texte", rect: { x: 100, y: 300, largeur: 400, hauteur: 60 }, opacite: 1, z: 0, taillePx: 48 };
  const avecSt = (st: { x: number; y: number; largeur: number; hauteur: number; taillePx?: number }, extra: Partial<EntreeControleComposition> = {}) =>
    controlerComposition({ format: FORMAT, dureeMs: 1000, imagesA: (tMs) => ({ ...vide(tMs), elements: [elTxt] }), sousTitresA: () => [st], ...extra });
  const bas = { x: 100, y: 1100, largeur: 800, hauteur: 80 };
  it("sous-titre de 40 px sur 1080 : TEXTE_TROP_PETIT (minimum 52) ; 52 px : rien", () => {
    expect(codes(avecSt({ ...bas, taillePx: 40 }))).toContain("TEXTE_TROP_PETIT");
    expect(codes(avecSt({ ...bas, taillePx: 52 }))).not.toContain("TEXTE_TROP_PETIT");
    expect(codes(avecSt(bas))).not.toContain("TEXTE_TROP_PETIT");
  });
  it("couleurs : hex hors charte signalé ; orange sur ivoire signalé, sur noir toléré ; blanc admis", () => {
    expect(codes(avecSt(bas, { couleursSousTitres: { accent: "#0000FF" } }))).toContain("CHARTE");
    expect(codes(avecSt(bas, { couleursSousTitres: { accent: "#d97757" }, fond: "ivoire" }))).toContain("CHARTE");
    expect(codes(avecSt(bas, { couleursSousTitres: { accent: "#D97757" }, fond: "noir" }))).not.toContain("CHARTE");
    expect(codes(avecSt(bas, { couleursSousTitres: { texte: "#fff", accent: "#B23F16", contour: "#141413" }, fond: "ivoire" }))).not.toContain("CHARTE");
  });
  const donnees = (extra: Record<string, unknown>) => ({ ...avant.sousTitres, ...extra }) as DonneesCalque;
  const tRef = (() => {
    const seg = avant.sousTitres.segments[0]!;
    return ((seg.debutSec + seg.finSec) / 2) * 1000;
  })();
  it("rectsSousTitresA donne la taille de police effective", () => {
    const r = rectsSousTitresA(avant.sousTitres)(tRef);
    expect(r).toHaveLength(1);
    expect(r[0]!.taillePx).toBeGreaterThan(20);
  });
  it("pastille (margeYPx), boîte arrondie et escalier agrandissent le rectangle par excès", () => {
    const nu = rectsSousTitresA(avant.sousTitres)(tRef)[0]!;
    const boite = rectsSousTitresA(donnees({ boite: { rayonEm: 0.3, margeEm: 0.4, couleurs: { fond: "#141413", texte: "#FAF9F5" } } }))(tRef)[0]!;
    expect(boite.hauteur).toBeGreaterThan(nu.hauteur);
    expect(boite.largeur).toBeGreaterThan(nu.largeur);
    const esc = rectsSousTitresA(donnees({ escalier: { zone: { xPx: 60, yPx: 200, largeurPx: 900, hauteurPx: 700 }, taillePx: 64 } }))(tRef);
    expect(esc.some((x) => x.largeur === 900 && x.hauteur === 700)).toBe(true);
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
  /** Expressions de fontSize non numériques connues et couvertes par la table (taille de Légende et son sous-texte). */
  const EXPRESSIONS_CONNUES = new Set(["taille", "Math.round(taille * 0.5)"]);
  const camel = (piece: string) => piece.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());
  /** Source de la fonction exportée du fichier (jusqu'à la suivante). */
  const fonction = (fichier: string, nom: string): string => {
    const src = lire(fichier);
    const debuts = [...src.matchAll(/^export (?:default )?function (\w+)/gm)];
    const k = debuts.findIndex((m) => m[1] === nom);
    if (k < 0) throw new Error(`fonction ${nom} introuvable dans ${fichier}`);
    return src.slice(debuts[k]!.index, debuts[k + 1]?.index ?? src.length);
  };
  const lecture = (src: string) => {
    const tailles = new Set<number>();
    const inconnues: string[] = [];
    for (const m of src.matchAll(/fontSize:\s*([^,}]+)/g)) {
      const v = m[1]!.trim();
      if (/^\d+$/.test(v)) tailles.add(Number(v));
      else if (!EXPRESSIONS_CONNUES.has(v)) inconnues.push(v);
    }
    for (const m of src.matchAll(/const taille =[^\n]*/g)) for (const x of m[0].matchAll(/\b(\d{2,3})\b/g)) tailles.add(Number(x[1]));
    return { tailles, inconnues };
  };
  for (const [piece, def] of Object.entries(TAILLES_TEXTE_PIECES)) {
    if (Object.keys(def.tailles).length === 0) continue;
    it(`${piece} : chaque taille de la table est dans la fonction ${camel(piece)} de ${def.fichier}`, () => {
      const { tailles, inconnues } = lecture(fonction(def.fichier, camel(piece)));
      expect(inconnues, `taille écrite en expression non reconnue dans ${camel(piece)}`).toEqual([]);
      for (const v of Object.values(def.tailles)) expect(tailles.has(v as number), `${v} dans ${camel(piece)}`).toBe(true);
    });
    it(`${piece} : aucune taille de la fonction ${camel(piece)} absente de la table (contrôle inverse)`, () => {
      const { tailles } = lecture(fonction(def.fichier, camel(piece)));
      const table = new Set<number>(Object.values(def.tailles) as number[]);
      for (const v of tailles) expect(table.has(v), `${v} dans ${camel(piece)}`).toBe(true);
    });
  }
  it("une taille écrite en expression inconnue fait échouer la lecture (jamais ignorée)", () => {
    expect(lecture("<div style={{ fontSize: base * 2 }} />").inconnues).toEqual(["base * 2"]);
    expect(lecture("<div style={{ fontSize: taille }} />").inconnues).toEqual([]);
  });
  it("les toiles utilisées existent", () => {
    for (const p of Object.keys(TAILLES_TEXTE_PIECES)) expect(TOILES[p as keyof typeof TOILES]).toBeDefined();
  });
});
