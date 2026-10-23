/**
 * Mise en page des composants « Image → vidéo » (corrections de la direction) : aux instants clés de TOUTES les galeries,
 * le contenu remplit ≥ 70 % de la zone utile (entre l'en-tête et la bande des sous-titres), aucun bloc ne touche le bord
 * (marge ≥ 5 %), aucun libellé sous le plancher, aucune icône en double ; la scène « Ensemble » porte un libellé court
 * par bloc ; chaque bénéfice prend l'icône lue sur son image. Contrôles PURS, déterministes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { iconeDe } from "@/domaine/image-video/icones";
import { INSTANTS_GALERIE_OBJETS, SCENES_GALERIE_OBJETS } from "../../studio-rendu/compositions/image-video/donnees-galerie-objets";
import { beneficesA, beneficesB, galerieA, galerieB, galerieObjets, INSTANTS_GALERIE_L9A, type ProprietesGalerieIV } from "../../studio-rendu/compositions/image-video/donnees-galerie-l9a";
import { sceneGalerieC } from "../../studio-rendu/compositions/image-video/donnees-galerie";
import { empriseEnsemble, empriseMicro, empriseMoment, empriseObjet } from "../../studio-rendu/compositions/image-video/emprise";
import {
  BANDE_SOUS_TITRES_IV,
  BAS_ENTETE_IV,
  centrer,
  controlerIcones,
  controlerMiseEnPage,
  MARGE_LATERALE_MIN_IV,
  PLANCHER_PX_IV,
  tauxRemplissage,
  ZONE_UTILE_IV,
  zoneUtile,
} from "../../studio-rendu/compositions/image-video/mise-en-page";
import { libelleCourt, objetsA, planEnsemble, unitesDeSens } from "../../studio-rendu/compositions/image-video/plan-objets";
import { BAS_ENTETE } from "../../studio-rendu/compositions/image-video/plan";

const W = 1080;
const H = 1920;
const lire = (nom: string): CarteImage => JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes", `${nom}.json`), "utf8"));
const momentA = (p: ProprietesGalerieIV, t: number) => p.moments.find((m) => t >= m.debut && t < m.fin) ?? p.moments[p.moments.length - 1];

describe("zone utile, marges, contrôles purs", () => {
  it("la zone utile va du bas de l'en-tête au haut des sous-titres, eux-mêmes hors des 20 % du bas", () => {
    expect(BAS_ENTETE_IV).toBe(BAS_ENTETE);
    expect(BANDE_SOUS_TITRES_IV.bas).toBeLessThanOrEqual(0.8);
    expect(ZONE_UTILE_IV.bas).toBeLessThan(BANDE_SOUS_TITRES_IV.haut);
    const z = zoneUtile();
    expect(z.y).toBeCloseTo((BAS_ENTETE + 0.02) * H, 0);
    expect(z.x).toBeGreaterThanOrEqual(MARGE_LATERALE_MIN_IV * W);
    expect(z.x + z.largeur).toBeLessThanOrEqual(W - MARGE_LATERALE_MIN_IV * W);
  });
  it("centrer pose un bloc au milieu de la zone ; le taux de remplissage mesure du premier au dernier bloc", () => {
    const z = { x: 60, y: 100, largeur: 960, hauteur: 800 };
    expect(centrer(400, z)).toBe(300);
    expect(centrer(900, z)).toBe(100);
    expect(tauxRemplissage([{ x: 60, y: 100, largeur: 10, hauteur: 100 }, { x: 60, y: 600, largeur: 10, hauteur: 100 }], z)).toBeCloseTo(0.75, 9);
    expect(tauxRemplissage([], z)).toBe(0);
  });
  it("le contrôle refuse : bas vide, bloc au bord, bloc dans les sous-titres, texte sous le plancher, icône en double", () => {
    const zone = zoneUtile();
    const plein = { nom: "carte", x: zone.x, y: zone.y, largeur: zone.largeur, hauteur: zone.hauteur };
    expect(controlerMiseEnPage({ zone, blocs: [plein], textes: [], icones: [] })).toEqual([]);
    expect(controlerMiseEnPage({ zone, blocs: [{ ...plein, hauteur: zone.hauteur * 0.6 }], textes: [], icones: [] }).join()).toMatch(/Remplissage vertical de 60 %/);
    expect(controlerMiseEnPage({ zone, blocs: [{ ...plein, x: 10 }], textes: [], icones: [] }).join()).toMatch(/touche le bord/);
    // Un FOND (aplat) peut aller bord à bord.
    expect(controlerMiseEnPage({ zone, blocs: [plein, { nom: "aplat", x: 0, y: zone.y, largeur: W, hauteur: 300, fond: true }], textes: [], icones: [] })).toEqual([]);
    expect(controlerMiseEnPage({ zone, blocs: [{ ...plein, hauteur: zone.hauteur + 200 }], textes: [], icones: [] }).join()).toMatch(/sous-titres/);
    expect(controlerMiseEnPage({ zone, blocs: [plein], textes: [{ texte: "petit", taille: 40 }], icones: [] }).join()).toMatch(/plancher/);
    expect(controlerMiseEnPage({ zone, blocs: [plein], textes: [{ texte: "Étiquette", taille: 30, horsPlancher: true }], icones: [] })).toEqual([]);
    expect(controlerIcones([{ element: "Plus de clarté", icone: "boussole" }, { element: "Résultats concrets", icone: "boussole" }]).join()).toMatch(/boussole/);
    expect(controlerIcones([{ element: "a", icone: "mail" }, { element: "a", icone: "mail" }])).toEqual([]);
  });
});

describe("toutes les galeries : remplies, dans les marges, lisibles, sans icône en double", () => {
  const galeries = { A: galerieA(), B: galerieB(), objets: galerieObjets() };
  for (const [nom, p] of Object.entries(galeries)) {
    for (const i of INSTANTS_GALERIE_L9A[nom as keyof typeof INSTANTS_GALERIE_L9A]) {
      it(`${nom} · ${i.nom} (t = ${i.t} s)`, () => {
        const m = momentA(p, i.t);
        const e = empriseMoment(m, i.t);
        expect(controlerMiseEnPage(e)).toEqual([]);
        if (e.remplir !== false) expect(tauxRemplissage(e.blocs, e.zone)).toBeGreaterThanOrEqual(0.7);
      });
    }
  }
  for (const [image, instants] of Object.entries(INSTANTS_GALERIE_OBJETS)) {
    const scene = SCENES_GALERIE_OBJETS[image as keyof typeof SCENES_GALERIE_OBJETS]();
    for (const i of instants) {
      it(`${image} · ${i.nom} (t = ${i.t} s)`, () => {
        const objets = objetsA(scene, i.t);
        expect(objets.length).toBeGreaterThan(0);
        for (const { objet } of objets) expect(controlerMiseEnPage(empriseObjet(objet, i.t))).toEqual([]);
      });
    }
  }
  it("C · scène « Ensemble » (galerie continue)", () => {
    const c = sceneGalerieC();
    const e = empriseEnsemble(planEnsemble(c.schema, { chiffresCles: c.ensembles![0].chiffresCles }));
    expect(controlerMiseEnPage(e)).toEqual([]);
    expect(tauxRemplissage(e.blocs, e.zone)).toBeGreaterThanOrEqual(0.7);
  });
  for (const liste of ["A", "B", "banque"] as const) {
    it(`micro-objets · ${liste}`, () => expect(controlerMiseEnPage(empriseMicro(liste))).toEqual([]));
  }
});

describe("scène « Ensemble » lisible : un libellé court par bloc, au plancher ou au-dessus", () => {
  it("C : chaque bloc porte son libellé court (exemples de la direction), son icône, aucune en double", () => {
    const c = sceneGalerieC();
    const p = planEnsemble(c.schema, { chiffresCles: ["80 %", "20 %"] });
    expect(p.alertes).toEqual([]);
    const libelles = new Map(p.blocs.map((b) => [b.id, b.libelle.lignes.map((l) => l.join(" ")).join(" ")]));
    expect(libelles.get("n03")).toBe("RÉPONSE GÉNÉRÉE");
    expect(libelles.get("n05")).toBe("TICKET CLÔTURÉ");
    expect(libelles.get("n09")).toBe("ALERTE TELEGRAM");
    expect(libelles.get("n10")).toBe("CLIENT INFORMÉ");
    expect(libelles.get("n08")).toBe("EMAIL À L'ÉQUIPE");
    for (const b of p.blocs) {
      expect(b.libelle.taille).toBeGreaterThanOrEqual(PLANCHER_PX_IV);
      expect(unitesDeSens(libelleCourt(c.schema.noeuds.find((n) => n.id === b.id)!)).length).toBeLessThanOrEqual(3);
      expect(b.icone).toBeDefined();
    }
    expect(controlerIcones(p.blocs.map((b) => ({ element: b.id, icone: b.icone! })))).toEqual([]);
    // Les parts en tête de leur colonne : 80 % à gauche, à la couleur de sa branche.
    expect(p.chiffres.map((x) => x.texte)).toEqual(["80 %", "20 %"]);
  });
  it("libellé court tiré du libellé : sans préfixe de branche, sans « auto », jamais coupé entre un nombre et son unité ni sur un mot outil", () => {
    expect(libelleCourt({ libelle: "Ticket clôturé auto" })).toBe("Ticket clôturé");
    expect(libelleCourt({ libelle: "Devis : vérification" })).toBe("Vérification");
    expect(libelleCourt({ libelle: "Envoyée en 4 sec" })).toBe("Envoyée en 4 sec");
    expect(libelleCourt({ libelle: "IA trie la demande" })).toBe("IA trie");
    expect(libelleCourt({ libelle: "Résolu sans intervention humaine", court: "Résolu sans humain" })).toBe("Résolu sans humain");
  });
  it("faux schéma à 16 nœuds : tous les blocs lisibles dans la zone utile, sans alerte", () => {
    const p = planEnsemble(lire("faux-16-noeuds"));
    expect(p.alertes).toEqual([]);
    expect(p.blocs).toHaveLength(16);
    expect(controlerMiseEnPage(empriseEnsemble(p))).toEqual([]);
  });
});

describe("pictogrammes fidèles à l'image", () => {
  it("A : temps = horloge, clarté = coche, productivité = courbe, coûts = €, résultats = cible ; la carte porte l'icône lue", () => {
    expect(beneficesA().map((b) => [b.titre, b.icone])).toEqual([
      ["Gain de temps immédiat", "horloge"],
      ["Plus de clarté", "coche"],
      ["Meilleure productivité", "tendance"],
      ["Réduction des coûts", "euro"],
      ["Résultats concrets", "cible"],
    ]);
    for (const b of beneficesA()) expect(b.icone).toBe(iconeDe(lire("A").noeuds.find((n) => n.id === b.id)!.icone!));
  });
  it("la table lit « € », « cible », « courbe », « clarté » sur l'image", () => {
    expect(iconeDe("€")).toBe("euro");
    expect(iconeDe("Coûts")).toBe("euro");
    expect(iconeDe("cible")).toBe("cible");
    expect(iconeDe("courbe")).toBe("tendance");
    expect(iconeDe("Clarté")).toBe("coche");
  });
  it("aucune image ne montre deux bénéfices, deux blocs d'ensemble ou deux sources avec la même icône", () => {
    expect(controlerIcones(beneficesA().map((b) => ({ element: b.titre, icone: b.icone! })))).toEqual([]);
    expect(controlerIcones(beneficesB().map((b) => ({ element: b.titre, icone: b.icone! })))).toEqual([]);
    const sources = lire("E").noeuds.filter((n) => n.role === "source");
    expect(controlerIcones(sources.map((n) => ({ element: n.libelle, icone: iconeDe(n.icone!)! })))).toEqual([]);
  });
});
