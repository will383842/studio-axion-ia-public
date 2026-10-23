/**
 * Lot 2 des compositions (R2) : types `liste-avant`, `resultat`, `preuve`, `question` et objets `liste-taches`,
 * `barres-avant-apres`, `bouclier-coche`. Les tests n'appellent que les fonctions `plan…` (modules purs).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boiteDans, imagesEcran, type BoitePx, type ProprietesEcran } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { PART_MAINTENANT, planBarresAvantApres } from "../../../studio-rendu/compositions/cas-concret/plans/BarresAvantApres";
import { planBouclierCoche } from "../../../studio-rendu/compositions/cas-concret/plans/BouclierCoche";
import { planListeAvant, type ProprietesListeAvant } from "../../../studio-rendu/compositions/cas-concret/plans/ListeAvant";
import { planListeTaches } from "../../../studio-rendu/compositions/cas-concret/plans/ListeTaches";
import { planPreuve, type ProprietesPreuve } from "../../../studio-rendu/compositions/cas-concret/plans/Preuve";
import { planQuestion, type ProprietesQuestion } from "../../../studio-rendu/compositions/cas-concret/plans/Question";
import { planResultat, type ProprietesResultat } from "../../../studio-rendu/compositions/cas-concret/plans/Resultat";
import { DOSSIER, sansCommentaires } from "./outils";

const listeAvant = exempleEcran("liste-avant") as ProprietesListeAvant;
const resultat = exempleEcran("resultat") as ProprietesResultat;
const preuve = exempleEcran("preuve") as ProprietesPreuve;
const question = exempleEcran("question") as ProprietesQuestion;
const images = (p: ProprietesEcran) => [0, Math.floor(imagesEcran(p) / 2), imagesEcran(p) - 1];
const fonds = <T extends ProprietesEcran>(p: T): T[] => [{ ...p, fond: "sombre" }, { ...p, fond: "ivoire" }];
const local = (b: BoitePx): BoitePx => ({ ...b, x: 0, y: 0 });
const objet = (b: BoitePx, extra = {}) => ({ boite: local(b), t: 0, tVideo: 0, fond: "ivoire" as const, ...extra });

describe("liste-avant", () => {
  it("rend ses textes au début, au milieu et à la fin", () => {
    for (const i of images(listeAvant)) {
      const plan = planListeAvant(listeAvant, i);
      expect(plan.marque.texte).toBe("axion-ia.com");
      expect(plan.etiquettePose?.texte).toBe("Avant");
      expect(plan.titre.texte).toBe("C'était *ça.*");
      expect(plan.liste.rangs.map((r) => r.texte)).toEqual(["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"]);
      expect(plan.total?.valeur).toBe("+1 H");
      expect(plan.total?.ligne).toBe("pour chaque personne");
    }
  });

  it("les rangs entrent un à un, puis s'assombrissent à l'annonce du total, qui surgit", () => {
    const debut = planListeAvant(listeAvant, 0);
    expect(debut.liste.rangs.every((r) => r.opacite === 0)).toBe(true);
    expect(debut.total?.opacite).toBe(0);
    // Une image après l'entrée du 1ᵉʳ rang, le 4ᵉ n'est pas encore là.
    const milieu = planListeAvant(listeAvant, 14).liste.rangs;
    expect(milieu[0].opacite).toBeGreaterThan(0);
    expect(milieu[3].opacite).toBe(0);
    for (let k = 1; k < 4; k++) expect(milieu[k - 1].opacite).toBeGreaterThanOrEqual(milieu[k].opacite);
    const fin = planListeAvant(listeAvant, imagesEcran(listeAvant) - 1);
    expect(fin.liste.rangs.every((r) => Math.abs(r.opacite - 0.4) < 1e-9)).toBe(true);
    expect(fin.total).toMatchObject({ opacite: 1, echelle: 1, rotation: 5 });
  });

  it("les événements calent les rangs et le total ; le tremblement s'éteint", () => {
    const calee: ProprietesListeAvant = { ...listeAvant, evenements: [{ cible: "tache-1", ms: 1000 }, { cible: "total", ms: 2000 }] };
    expect(planListeAvant(calee, 22).liste.rangs[0].opacite).toBe(0);
    expect(planListeAvant(calee, 35).liste.rangs[0].opacite).toBeGreaterThan(0);
    expect(planListeAvant(calee, 49).total?.opacite).toBe(0);
    const trembleur = [56, 58, 60].map((i) => Math.abs(planListeAvant(calee, i).liste.decalageX));
    expect(Math.max(...trembleur)).toBeGreaterThan(0);
    expect(planListeAvant(calee, 74).liste.decalageX).toBe(0);
  });

  it("aucun texte hors de sa boîte, sur les deux fonds", () => {
    for (const p of fonds(listeAvant)) {
      const plan = planListeAvant(p, imagesEcran(p) - 1);
      expect(plan.titre.tient).toBe(true);
      expect(plan.total?.tient).toBe(true);
      for (const r of plan.liste.rangs) {
        expect(r.tient, r.texte).toBe(true);
        expect(boiteDans(r.boite, plan.liste.fiche.boite), r.texte).toBe(true);
      }
      expect(boiteDans({ ...plan.boiteListe }, p.zone)).toBe(true);
    }
  });

  it("sans total, pas de pastille", () => {
    expect(planListeAvant({ ...listeAvant, total: undefined }, 60).total).toBeNull();
  });
});

describe("liste-taches (objet)", () => {
  it("un rang par texte, par défaut un toutes les 0,3 s", () => {
    const b = planListeAvant(listeAvant, 0).boiteListe;
    const textes = ["A", "B", "C"];
    expect(planListeTaches(objet(b, { textes }), 0).rangs.map((r) => r.opacite)).toEqual([0, 0, 0]);
    const fin = planListeTaches(objet(b, { textes }), 100);
    expect(fin.rangs.map((r) => r.opacite)).toEqual([1, 1, 1]);
    expect(fin.rangs[2].separateur).toBeNull();
    expect(fin.rangs[0].separateur).not.toBeNull();
    expect(fin.fiche.couleur).toBe(COULEURS_DUO.blanc);
  });
});

describe("resultat", () => {
  it("rend ses textes au début, au milieu et à la fin", () => {
    for (const i of images(resultat)) {
      const plan = planResultat(resultat, i);
      expect(plan.etiquettePose?.texte).toBe("Résultat");
      expect(plan.titre.texte).toBe("Des heures *gagnées.*");
      expect(plan.etiquetteAvant?.texte).toBe("Avant");
      expect(plan.etiquetteMaintenant?.texte).toBe("Maintenant");
      expect(plan.avant.plan.texte.texte).toBe("+1 H");
      expect(plan.maintenant.plan.texte.texte).toBe("15 MIN");
      expect(plan.ligne.texte).toBe("à chaque recrutement");
    }
  });

  it("la barre « avant » se remplit, la seconde rebondit puis se pose à 520/900", () => {
    const debut = planResultat(resultat, 0);
    expect(debut.avant.plan.barre.boite.largeur).toBe(0);
    expect(debut.maintenant.plan.barre.boite.largeur).toBe(0);
    expect(debut.ligne.opacite).toBe(0);
    const fin = planResultat(resultat, imagesEcran(resultat) - 1);
    expect(fin.avant.plan.barre.boite.largeur).toBeCloseTo(fin.avant.boite.largeur, 6);
    expect(fin.maintenant.plan.barre.boite.largeur).toBeCloseTo(fin.avant.boite.largeur * PART_MAINTENANT, 6);
    expect(fin.ligne.opacite).toBe(1);
    // Rebond : la seconde barre dépasse un instant sa longueur finale.
    const larges = Array.from({ length: imagesEcran(resultat) }, (_, i) => planResultat(resultat, i).maintenant.plan.barre.boite.largeur);
    expect(Math.max(...larges)).toBeGreaterThan(larges[larges.length - 1]);
  });

  it("aucun texte hors de sa boîte, barres dans la zone", () => {
    for (const p of fonds(resultat)) {
      const plan = planResultat(p, imagesEcran(p) - 1);
      for (const x of [plan.titre.tient, plan.avant.tient, plan.maintenant.tient, plan.ligne.tient, plan.etiquetteAvant?.tient, plan.etiquetteMaintenant?.tient]) expect(x).toBe(true);
      expect(boiteDans(plan.avant.boite, p.zone)).toBe(true);
    }
  });
});

describe("barres-avant-apres (objet)", () => {
  it("couleurs de la charte, texte contraste, déterministe", () => {
    const b: BoitePx = { x: 0, y: 0, largeur: 900, hauteur: 190 };
    const avant = planBarresAvantApres(objet(b, { textes: ["+1 H"], fond: "ivoire" }), 60);
    const maintenant = planBarresAvantApres(objet(b, { textes: ["15 min"], variante: "maintenant" }), 60);
    expect(avant.barre.couleur).toBe(COULEURS_DUO.encre);
    expect(avant.texte.couleur).toBe(COULEURS_DUO.blanc);
    expect(maintenant.barre.couleur).toBe(COULEURS_DUO.orangeVif);
    expect(maintenant.texte.texte).toBe("15 MIN");
    expect(JSON.stringify(avant)).toBe(JSON.stringify(planBarresAvantApres(objet(b, { textes: ["+1 H"], fond: "ivoire" }), 60)));
  });
  it("un texte long est réduit pour tenir dans la barre", () => {
    const b: BoitePx = { x: 0, y: 0, largeur: 400, hauteur: 190 };
    const plan = planBarresAvantApres(objet(b, { textes: ["Une valeur beaucoup trop longue"], variante: "maintenant" }), 100);
    expect(plan.texte.tient).toBe(true);
    expect(plan.texte.taille).toBeLessThan(190 * (130 / 190));
  });
});

describe("preuve", () => {
  it("rend ses textes au début, au milieu et à la fin", () => {
    for (const i of images(preuve)) {
      const plan = planPreuve(preuve, i);
      expect(plan.etiquettePose?.texte).toBe("Et les données ?");
      expect(plan.titre.texte).toBe("Conforme *RGPD.*");
      expect(plan.puces.map((q) => q.texte)).toEqual(["100 % automatique", "0 intervention manuelle"]);
    }
  });

  it("la coche et les puces surgissent l'une après l'autre", () => {
    const debut = planPreuve(preuve, 0);
    expect(debut.bouclier.rond.opacite).toBe(0);
    expect(debut.puces.every((q) => q.opacite === 0)).toBe(true);
    const milieu = planPreuve(preuve, 28);
    expect(milieu.bouclier.rond.opacite).toBe(1);
    expect(milieu.puces[0].opacite).toBeGreaterThan(0);
    expect(milieu.puces[1].opacite).toBe(0);
    const fin = planPreuve(preuve, imagesEcran(preuve) - 1);
    expect(fin.puces.every((q) => q.opacite === 1 && q.echelle === 1)).toBe(true);
    expect(fin.puces.map((q) => q.rotationFinale)).toEqual([-3, 3]);
    expect(fin.bouclier.rond.couleur).toBe(COULEURS_DUO.vert);
  });

  it("aucun texte ni puce hors de sa boîte", () => {
    for (const p of fonds(preuve)) {
      const plan = planPreuve(p, imagesEcran(p) - 1);
      expect(plan.titre.tient).toBe(true);
      for (const q of plan.puces) expect(q.tient, q.texte).toBe(true);
      expect(boiteDans(plan.boiteBouclier, p.zone)).toBe(true);
    }
  });
});

describe("bouclier-coche (objet)", () => {
  it("fiche carrée centrée, rond vert dedans, coche dans le rond", () => {
    const b: BoitePx = { x: 0, y: 0, largeur: 500, hauteur: 400 };
    const plan = planBouclierCoche(objet(b), 100);
    expect(plan.fiche.boite).toEqual({ x: 50, y: 0, largeur: 400, hauteur: 400 });
    expect(boiteDans(plan.rond.boite, plan.fiche.boite)).toBe(true);
    expect(boiteDans(plan.coche.boite, local(plan.rond.boite))).toBe(true);
    expect(plan.rond.opacite).toBe(1);
    expect(planBouclierCoche(objet(b), 0).rond.opacite).toBe(0);
    expect(planBouclierCoche(objet(b, { debutCoche: 2 }), 25).rond.opacite).toBe(0);
  });
});

describe("question", () => {
  it("rend ses textes au début, au milieu et à la fin ; tous les mots sont opaques à la fin", () => {
    for (const i of images(question)) {
      const plan = planQuestion(question, i);
      expect(plan.lignes.map((l) => l.texte)).toEqual(["Et dans votre", "*entreprise ?*"]);
      expect(plan.question.texte).toBe("Quelle tâche pourrait tourner toute seule ?");
    }
    const fin = planQuestion(question, imagesEcran(question) - 1);
    for (const l of fin.lignes) expect(l.mots.every((m) => m.opacite === 1), l.nom).toBe(true);
    expect(fin.question.opacite).toBe(1);
    expect(fin.lignes.map((l) => l.lueur)).toEqual([false, true]);
    const debut = planQuestion(question, 0);
    expect(debut.lignes[1].mots[0].opacite).toBe(0);
    expect(debut.question.opacite).toBe(0);
  });

  it("aucun texte hors de sa boîte, sur les deux fonds", () => {
    for (const p of fonds(question)) {
      const plan = planQuestion(p, imagesEcran(p) - 1);
      for (const l of plan.lignes) expect(l.tient, l.nom).toBe(true);
      expect(plan.question.tient).toBe(true);
    }
  });
});

describe("code", () => {
  it("aucune couleur en dur, aucun hasard ni date", () => {
    for (const f of ["Resultat", "ListeAvant", "Preuve", "Question", "ListeTaches", "BarresAvantApres", "BouclierCoche"]) {
      for (const chemin of [`plans/${f}.ts`, `${["ListeTaches", "BarresAvantApres", "BouclierCoche"].includes(f) ? "objets" : "types"}/${f}.tsx`]) {
        const code = sansCommentaires(readFileSync(join(DOSSIER, chemin), "utf8"));
        expect(code.match(/#[0-9a-f]{3,8}\b/gi) ?? [], chemin).toEqual([]);
        expect(code.match(/rgba?\(|hsla?\(/g) ?? [], chemin).toEqual([]);
        expect(code, chemin).not.toMatch(/Math\.random|Date\.now|new Date\b/);
      }
    }
  });
});
