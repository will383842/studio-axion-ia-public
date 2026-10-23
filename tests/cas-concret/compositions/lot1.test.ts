/**
 * Lot 1 des compositions (R1) : types `accroche`, `titre`, `chiffre`. Les tests n'appellent que les fonctions `plan…`
 * (modules purs) et lisent les fichiers comme du texte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boiteDans, imagesEcran, type ProprietesEcran, type TextePose } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { planAccroche, type ProprietesAccroche } from "../../../studio-rendu/compositions/cas-concret/plans/Accroche";
import { planChiffre, poserPastilles, type ProprietesChiffre } from "../../../studio-rendu/compositions/cas-concret/plans/Chiffre";
import { planTitre, type ProprietesTitre } from "../../../studio-rendu/compositions/cas-concret/plans/Titre";
import { DOSSIER, sansCommentaires } from "./outils";

const accroche = exempleEcran("accroche") as ProprietesAccroche;
const titre = exempleEcran("titre") as ProprietesTitre;
const chiffre = exempleEcran("chiffre") as ProprietesChiffre;
const chiffreCompteur: ProprietesChiffre = { ...chiffre, compteur: true, evenements: [{ cible: "compteur", ms: 200 }] };
const clair = (p: ProprietesEcran): ProprietesEcran => ({ ...p, fond: p.fond === "sombre" ? "ivoire" : "sombre" });

/** Images de début, de milieu et de fin d'un écran. */
const images = (p: ProprietesEcran) => [0, Math.floor(imagesEcran(p) / 2), imagesEcran(p) - 1];

describe("accroche", () => {
  it("rend ses textes au début, au milieu et à la fin ; tous les mots sont opaques à la fin", () => {
    for (const i of images(accroche)) {
      const plan = planAccroche(accroche, i);
      expect(plan.marque.texte).toBe("axion-ia.com");
      expect(plan.etiquette?.texte).toBe("Recrutement · cas réel");
      expect(plan.lignes.map((l) => l.texte)).toEqual(["On recrute", "nos collaborateurs", "*en…*"]);
    }
    const fin = planAccroche(accroche, imagesEcran(accroche) - 1);
    for (const l of fin.lignes) expect(l.mots.every((m) => m.opacite === 1), l.nom).toBe(true);
    const debut = planAccroche(accroche, 0);
    expect(debut.lignes[2].mots[0].opacite).toBe(0);
    expect(debut.lignes[0].mots[0].opacite).toBeGreaterThan(0);
    expect(planAccroche(accroche, 40).lignes[1].mots[0].opacite).toBeGreaterThan(0);
  });

  it("les événements calent les lignes", () => {
    const calee: ProprietesAccroche = { ...accroche, evenements: [{ cible: "titre-2", ms: 1000 }] };
    expect(planAccroche(calee, 24).lignes[1].mots[0].opacite).toBe(0);
    expect(planAccroche(calee, 26).lignes[1].mots[0].opacite).toBeGreaterThan(0);
  });

  it("aucun texte hors de sa boîte, sur les deux fonds", () => {
    for (const p of [accroche, clair(accroche) as ProprietesAccroche]) {
      const plan = planAccroche(p, 40);
      for (const l of plan.lignes) {
        expect(l.tient, l.nom).toBe(true);
        expect(boiteDans(l.boite, p.zone), l.nom).toBe(true);
      }
      expect(boiteDans(plan.marque.boite, p.zone)).toBe(true);
    }
  });

  it("sans étiquette, pas d'étiquette", () => {
    const sans: ProprietesAccroche = { ...accroche, etiquette: undefined, lignes: ["Une ligne"] };
    const plan = planAccroche(sans, 10);
    expect(plan.etiquette).toBeNull();
    expect(plan.lignes).toHaveLength(1);
  });
});

describe("titre", () => {
  it("rend ses textes au début, au milieu et à la fin ; tous les mots sont opaques à la fin", () => {
    for (const i of images(titre)) expect(planTitre(titre, i).lignes.map((l) => l.texte)).toEqual(["Alors on a", "tout *automatisé.*"]);
    const fin = planTitre(titre, imagesEcran(titre) - 1);
    for (const l of fin.lignes) expect(l.mots.every((m) => m.opacite === 1 && m.flou === 0 && m.decalageY === 0), l.nom).toBe(true);
    expect(planTitre(titre, 0).lignes[1].mots[0].opacite).toBe(0);
    expect(fin.lignes[1].mots.find((m) => m.accent)?.mot).toBe("automatisé.");
  });

  it("la dernière ligne est dans la lueur ; particules sur fond sombre seulement, déterministes", () => {
    const sombre: ProprietesTitre = { ...titre, fond: "sombre" };
    const plan = planTitre(sombre, 30);
    expect(plan.lignes.map((l) => l.lueur)).toEqual([false, true]);
    expect(plan.particules).toHaveLength(16);
    expect(JSON.stringify(planTitre(sombre, 30).particules)).toBe(JSON.stringify(plan.particules));
    expect(planTitre({ ...titre, fond: "ivoire" }, 30).particules).toEqual([]);
    for (const q of plan.particules) expect(q.opacite).toBeGreaterThanOrEqual(0.25);
  });

  it("aucun texte hors de sa boîte", () => {
    for (const p of [titre, clair(titre) as ProprietesTitre]) for (const l of planTitre(p, 40).lignes) expect(l.tient && boiteDans(l.boite, p.zone), l.nom).toBe(true);
  });
});

describe("chiffre", () => {
  it("variante en zoom : nombre flou et grand au début, net à la fin ; textes aux trois instants", () => {
    for (const i of images(chiffre)) {
      const plan = planChiffre(chiffre, i);
      expect(plan.nombre.texte).toBe("15");
      expect(plan.unite.texte).toBe("minutes.");
      expect(plan.pastilles.map((q) => q.texte)).toEqual(["0 CV à trier", "0 relance", "0 papier"]);
      expect(plan.anneau).toBeNull();
    }
    const debut = planChiffre(chiffre, 0).nombre;
    expect(debut.opacite).toBe(0);
    expect(debut.echelle).toBeCloseTo(1.5, 9);
    expect(debut.flou).toBeCloseTo(18, 9);
    const fin = planChiffre(chiffre, imagesEcran(chiffre) - 1);
    expect(fin.nombre).toMatchObject({ opacite: 1, echelle: 1, flou: 0 });
    expect(fin.unite.mots.every((m) => m.opacite === 1)).toBe(true);
    expect(fin.pastilles.every((q) => q.opacite === 1 && q.decalageY === 0)).toBe(true);
    expect(planChiffre(chiffre, 0).pastilles.every((q) => q.opacite === 0)).toBe(true);
  });

  it("variante à anneau : le compteur vaut la valeur demandée à la fin, l'anneau est fermé", () => {
    const debut = planChiffre(chiffreCompteur, 0);
    expect(debut.nombre.valeur).toBe(0);
    expect(debut.anneau?.fraction).toBe(0);
    expect(debut.anneau?.decalage).toBeCloseTo(debut.anneau!.circonference, 9);
    const milieu = planChiffre(chiffreCompteur, 10);
    expect(milieu.nombre.valeur).toBeGreaterThan(0);
    expect(milieu.nombre.valeur).toBeLessThan(15);
    const fin = planChiffre(chiffreCompteur, imagesEcran(chiffreCompteur) - 1);
    expect(fin.nombre.valeur).toBe(15);
    expect(fin.nombre.texte).toBe("15");
    expect(fin.anneau?.fraction).toBe(1);
    expect(fin.anneau?.decalage).toBeCloseTo(0, 9);
    expect(fin.anneau?.couleurTrait).toBe(COULEURS_DUO.orangeVif);
    // Le compteur croît sans jamais redescendre.
    let precedent = -1;
    for (let i = 0; i < imagesEcran(chiffreCompteur); i++) {
      const v = planChiffre(chiffreCompteur, i).nombre.valeur;
      expect(v).toBeGreaterThanOrEqual(precedent);
      precedent = v;
    }
  });

  it("aucun texte hors de sa boîte, pastilles dans la zone et sans chevauchement", () => {
    for (const p of [chiffre, chiffreCompteur, clair(chiffre) as ProprietesChiffre]) {
      const plan = planChiffre(p, imagesEcran(p) - 1);
      expect(plan.nombre.tient).toBe(true);
      expect(plan.unite.tient).toBe(true);
      for (const q of plan.pastilles) expect(q.tient, q.texte).toBe(true);
      for (let k = 1; k < plan.pastilles.length; k++) expect(plan.pastilles[k].boite.x).toBeGreaterThan(plan.pastilles[k - 1].boite.x + plan.pastilles[k - 1].boite.largeur);
    }
  });

  it("des pastilles trop larges sont réduites pour tenir", () => {
    const pose: TextePose = { nom: "pastilles", police: "inter-gras", niveau: "marque", taille: 36, plancher: 27, soumisAuPlancher: false, lignesMax: 1, interligne: 1.9, approche: 0, capitales: false, boite: { x: 60, y: 1000, largeur: 400, hauteur: 68 }, texte: "", tailleRendue: 36, lignes: [], tient: true };
    const posees = poserPastilles(["Une pastille très longue", "Une autre pastille", "Et une dernière"], pose);
    const dernier = posees[posees.length - 1].boite;
    expect(dernier.x + dernier.largeur).toBeLessThanOrEqual(460.01);
    expect(posees[0].taille).toBeLessThan(36);
  });
});

describe("code", () => {
  it("aucune couleur en dur dans les plans et types du lot", () => {
    for (const f of ["plans/Accroche.ts", "plans/Titre.ts", "plans/Chiffre.ts", "types/Accroche.tsx", "types/Titre.tsx", "types/Chiffre.tsx"]) {
      const code = sansCommentaires(readFileSync(join(DOSSIER, f), "utf8"));
      expect(code.match(/#[0-9a-f]{3,8}\b/gi) ?? [], f).toEqual([]);
      expect(code.match(/rgba?\(|hsla?\(/g) ?? [], f).toEqual([]);
      expect(code, f).not.toMatch(/Math\.random|Date\.now|new Date\b/);
    }
  });
});
