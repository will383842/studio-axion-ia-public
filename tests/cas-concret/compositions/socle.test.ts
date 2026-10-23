/**
 * Socle des compositions « Cas concret MD » (R1a) : plan commun (marque, mot par mot, fil d'étapes, entrées),
 * exemples valides, fichiers attendus, garde-fous du code (aucune couleur ni police en dur, aucun hasard ni date,
 * aucun `.tsx` importé par un test, rien au chargement du module).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boitesEcran, controlerProprietes, imagesEcran, TYPES_ECRAN } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO, FONDS } from "../../../src/briques/habillage/charte-duo";
import { exemplesEcrans, exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";
import {
  couleursDuFond,
  finMotParMot,
  MOT_PAR_MOT,
  planEclair,
  planEntreeEcran,
  planEntreeObjet,
  planEtiquette,
  planFilEtapes,
  planMarque,
  planMotParMot,
  planSurgir,
  teinte,
} from "../../../studio-rendu/compositions/cas-concret/plans/commun";
import { DOSSIER, FICHIERS_OBJETS, FICHIERS_TYPES, sourcesDuDossier } from "./outils";

const FPS = 25;
const image = (n: number) => n / FPS;

describe("plans/commun.ts", () => {
  it("la marque vaut « axion-ia.com », dans la couleur du fond", () => {
    for (const p of exemplesEcrans()) {
      const m = planMarque(p, boitesEcran(p).marque.boite);
      expect(m.texte).toBe("axion-ia.com");
      expect(m.couleur).toBe(p.fond === "sombre" ? COULEURS_DUO.blanc : COULEURS_DUO.encre);
    }
  });

  it("mot par mot : le 3ᵉ mot est invisible à l'image 0 et opaque à la fin", () => {
    const texte = "On recrute *nos collaborateurs*";
    const debut = planMotParMot(texte, image(0));
    expect(debut).toHaveLength(4);
    expect(debut[2].mot).toBe("nos");
    expect(debut[2].accent).toBe(true);
    expect(debut[2].opacite).toBe(0);
    expect(debut[2].decalageY).toBe(MOT_PAR_MOT.monteePx);
    expect(debut[2].flou).toBe(MOT_PAR_MOT.flouPx);
    const fin = planMotParMot(texte, finMotParMot(texte));
    expect(fin[2].opacite).toBe(1);
    expect(fin[2].decalageY).toBe(0);
    expect(fin[2].flou).toBe(0);
    expect(fin.every((m) => m.opacite === 1)).toBe(true);
    // Pas de 90 ms, durée 340 ms.
    expect(planMotParMot(texte, 0.09 * 2 + 0.34)[2].opacite).toBe(1);
    expect(planMotParMot(texte, 0.09 * 2)[2].opacite).toBe(0);
  });

  it("le fil des étapes vaut 0 puis 100 %", () => {
    expect(planFilEtapes(1, 6, 0).fraction).toBe(0);
    expect(planFilEtapes(6, 6, 1).fraction).toBe(1);
    expect(planFilEtapes(3, 6, 0.5).fraction).toBeCloseTo(2.5 / 6, 9);
    expect(planFilEtapes(1, 6, 0).couleur).toBe(COULEURS_DUO.orangeVif);
  });

  it("entrées : écran en 0,2 s, objet, surgissement, éclair", () => {
    expect(planEntreeEcran({ debutMs: 0 }, 0).opacite).toBe(1);
    expect(planEntreeEcran({ debutMs: 3000 }, 0).opacite).toBeCloseTo(0.35, 9);
    expect(planEntreeEcran({ debutMs: 3000 }, 0.2)).toEqual({ opacite: 1, echelle: 1 });
    expect(planEntreeObjet(0)).toEqual({ opacite: 0, decalageY: 90, echelle: 0.93 });
    expect(planEntreeObjet(1)).toEqual({ opacite: 1, decalageY: 0, echelle: 1 });
    expect(planSurgir(0).opacite).toBe(0);
    expect(planSurgir(1)).toEqual({ opacite: 1, echelle: 1, rotation: 0 });
    expect(planEclair(1, 1).opacite).toBeCloseTo(0.55, 9);
    expect(planEclair(1.2, 1).opacite).toBe(0);
    expect(planEclair(1, null).opacite).toBe(0);
  });

  it("couleurs : toutes tirées de la charte", () => {
    const permises = new Set(Object.values(COULEURS_DUO).map((c) => c.toLowerCase()));
    for (const fond of ["sombre", "ivoire"] as const) {
      const c = couleursDuFond(fond);
      expect(c.fond).toBe(FONDS[fond].fond);
      expect(c.accent).toBe(FONDS[fond].accent);
      for (const v of [c.fond, c.texte, c.accent, c.secondaire, c.marque, c.degrade.centre, c.degrade.milieu, c.degrade.bord, c.ombre, c.lueur, c.lueurLarge]) expect(permises.has(v.slice(0, 7).toLowerCase()), v).toBe(true);
    }
    expect(teinte(COULEURS_DUO.orangeVif, 0.75)).toBe(`${COULEURS_DUO.orangeVif}bf`);
    const pose = { ...boitesEcran(exempleEcran("accroche")).textes[0], texte: "Avant", tailleRendue: 28, lignes: ["Avant"], tient: true };
    expect(planEtiquette("ivoire", pose, 0.2).couleur).toBe(COULEURS_DUO.orange);
  });

  it("déterministe", () => {
    expect(JSON.stringify(planMotParMot("Le *rendez-vous*", 0.2))).toBe(JSON.stringify(planMotParMot("Le *rendez-vous*", 0.2)));
  });
});

describe("exemples", () => {
  it("un exemple par type, valide, 1080 × 1920 à 25 i/s", () => {
    const e = exemplesEcrans();
    expect(e.map((x) => x.type)).toEqual([...TYPES_ECRAN]);
    for (const p of e) {
      expect(controlerProprietes(p), p.type).toEqual([]);
      expect([p.largeur, p.hauteur, p.fps]).toEqual([1080, 1920, 25]);
      expect(imagesEcran(p)).toBe(75);
    }
  });
});

describe("fichiers du dossier", () => {
  it("les 12 fichiers de type et les 17 d'objet existent, avec le registre et le socle", () => {
    expect(FICHIERS_TYPES).toHaveLength(12);
    expect(FICHIERS_OBJETS).toHaveLength(17);
    for (const f of [...FICHIERS_TYPES, ...FICHIERS_OBJETS]) expect(existsSync(join(DOSSIER, f)), f).toBe(true);
    for (const f of ["Compositions.tsx", "Ecran.tsx", "exemples.ts", "plans/commun.ts", "objets/registre.ts"]) expect(existsSync(join(DOSSIER, f)), f).toBe(true);
    for (const f of ["Fond", "Marque", "MotParMot", "Etiquette", "Ligne", "Biais", "Surgir", "Puce", "FilEtapes", "Eclair"]) expect(existsSync(join(DOSSIER, `socle/${f}.tsx`)), f).toBe(true);
  });

  it("le registre des objets et l'aiguillage des types citent chaque fichier", () => {
    const sources = sourcesDuDossier();
    const registre = sources.find((s) => s.f === "objets/registre.ts")!.texte;
    for (const f of FICHIERS_OBJETS) expect(registre).toContain(`from "./${f.slice(7, -4)}"`);
    const ecran = sources.find((s) => s.f === "Ecran.tsx")!.texte;
    for (const f of FICHIERS_TYPES) expect(ecran).toContain(`from "./${f.slice(0, -4)}"`);
  });

  it("aucune couleur ni police en dur (hors exemples.ts)", () => {
    for (const { f, texte } of sourcesDuDossier()) {
      if (f === "exemples.ts") continue;
      expect(texte.match(/#[0-9a-f]{3,8}\b/gi) ?? [], f).toEqual([]);
      expect(texte.match(/rgba?\(|hsla?\(|["'`][^"'`\n]*\b(Anton|Inter|Montserrat|Poppins|serif|sans-serif|Arial|Helvetica)\b/g) ?? [], f).toEqual([]);
    }
  });

  it("aucun hasard ni date", () => {
    for (const { f, texte } of sourcesDuDossier()) {
      expect(texte, f).not.toMatch(/Math\.random|Date\.now|new Date\b|performance\.now/);
    }
  });

  it("les plans sont purs : ni remotion ni React", () => {
    for (const { f, texte } of sourcesDuDossier().filter((s) => s.f.startsWith("plans/"))) {
      expect(texte, f).not.toMatch(/from\s+["'](remotion|react|react\/[^"']*)["']/);
      expect(f.endsWith(".ts"), f).toBe(true);
    }
  });

  it("rien au chargement du module des compositions, ni import de Racine, de src/moteurs ou de tests", () => {
    const sources = sourcesDuDossier();
    const comp = sources.find((s) => s.f === "Compositions.tsx")!.texte;
    // Hors des fonctions : seulement des imports, des constantes gelées et des fonctions.
    const horsFonctions = comp.replace(/export function[\s\S]*$/m, "");
    expect(horsFonctions).not.toMatch(/exemplesEcrans\(|exempleEcran\(|proprietesEcrans\(/);
    for (const { f, texte } of sources) {
      expect(texte, f).not.toMatch(/from\s+["'][^"']*(Racine|src\/moteurs|\/tests\/)[^"']*["']/);
    }
  });

  it("les tests du format n'importent aucun fichier .tsx du dossier", () => {
    for (const { f, texte } of sourcesDuDossier(join(process.cwd(), "tests/cas-concret/compositions"))) {
      expect(texte.match(/from\s+["'][^"']*compositions\/cas-concret\/[^"']*\.tsx?["']|from\s+["'][^"']*compositions\/cas-concret\/(Compositions|Ecran|socle|types|objets)[^"']*["']/g) ?? [], f).toEqual([]);
    }
  });
});
