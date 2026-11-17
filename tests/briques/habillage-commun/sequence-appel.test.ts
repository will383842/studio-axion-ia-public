import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  LIBELLE_APPEL_RDV,
  SEQUENCE_APPEL_ACTIVE,
  etatSequenceAppel,
  haloBoutonAppel,
} from "@/briques/motion/habillage-commun/sequence-appel";

const DUREE = 100;
const DEPART = { x: 80, y: 90 };
const CIBLE = { x: 50, y: 50 };
const o = { depart: DEPART, cible: CIBLE };
const BOITE = { largeur: 400, hauteur: 120 };
const deplacement = Math.round(DUREE * 0.6);

describe("sequence-appel : minutage pur", () => {
  it("constantes : libellé fixe, séquence éteinte", () => {
    expect(LIBELLE_APPEL_RDV).toBe("Prendre rendez-vous");
    expect(SEQUENCE_APPEL_ACTIVE).toBe(false);
  });

  it("image 0 : curseur au départ, bouton au repos, pas d'anneau", () => {
    const e = etatSequenceAppel(0, DUREE, o);
    expect(e.curseur.x).toBeCloseTo(DEPART.x, 6);
    expect(e.curseur.y).toBeCloseTo(DEPART.y, 6);
    expect(e.bouton).toBe("repos");
    expect(e.anneau).toBeNull();
    expect(e.echelleBouton).toBe(1);
  });

  it("fin du déplacement : curseur sur la cible", () => {
    const e = etatSequenceAppel(deplacement, DUREE, o);
    expect(e.curseur.x).toBeCloseTo(CIBLE.x, 6);
    expect(e.curseur.y).toBeCloseTo(CIBLE.y, 6);
  });

  it("pendant le clic : appui, bouton enfoncé, anneau entre 0 et 1", () => {
    const e = etatSequenceAppel(deplacement + 6, DUREE, o);
    expect(e.bouton).toBe("appui");
    expect(e.echelleBouton).toBeLessThan(1);
    expect(e.anneau).not.toBeNull();
    expect(e.anneau!).toBeGreaterThan(0);
    expect(e.anneau!).toBeLessThan(1);
  });

  it("après le clic : valide jusqu'à la dernière image, sans anneau", () => {
    for (let i = deplacement + 12; i < DUREE; i++) {
      const e = etatSequenceAppel(i, DUREE, o);
      expect(e.bouton).toBe("valide");
      expect(e.anneau).toBeNull();
      expect(e.echelleBouton).toBe(1);
    }
  });

  it("les courtes durées finissent aussi sur « valide »", () => {
    expect(etatSequenceAppel(24, 25, o).bouton).toBe("valide");
  });

  it("forceLueur toujours dans [0, 1], déplacement monotone vers la cible", () => {
    let prec = Infinity;
    for (let i = -5; i < DUREE + 10; i++) {
      const e = etatSequenceAppel(i, DUREE, o);
      expect(e.forceLueur).toBeGreaterThanOrEqual(0);
      expect(e.forceLueur).toBeLessThanOrEqual(1);
      if (i <= deplacement) {
        const d = Math.hypot(e.curseur.x - CIBLE.x, e.curseur.y - CIBLE.y);
        expect(d).toBeLessThanOrEqual(prec + 1e-9);
        prec = d;
      }
    }
  });

  it("la lueur monte avant le clic et retombe doucement une fois validé", () => {
    const avant = etatSequenceAppel(deplacement, DUREE, o).forceLueur;
    const fin = etatSequenceAppel(DUREE - 1, DUREE, o).forceLueur;
    expect(avant).toBeGreaterThan(etatSequenceAppel(0, DUREE, o).forceLueur);
    expect(fin).toBeLessThan(1);
    expect(fin).toBeGreaterThan(0);
  });

  it("même entrée, même sortie", () => {
    expect(etatSequenceAppel(37, DUREE, o)).toEqual(etatSequenceAppel(37, DUREE, o));
  });

  it("entrées non finies ou durée < 1 : état de repos, aucune erreur", () => {
    for (const [i, d] of [[Number.NaN, DUREE], [5, 0], [5, Number.NaN], [Infinity, DUREE], [5, -3]] as const) {
      const e = etatSequenceAppel(i, d, o);
      expect(e.bouton).toBe("repos");
      expect(e.anneau).toBeNull();
      expect(e.forceLueur).toBe(0);
      expect(Number.isFinite(e.curseur.x) && Number.isFinite(e.curseur.y)).toBe(true);
    }
    expect(() => etatSequenceAppel(10, DUREE, { depart: { x: Number.NaN, y: 1 }, cible: { x: 1, y: Infinity } })).not.toThrow();
  });

  it("halo : jamais de blur, « none » à force 0", () => {
    expect(haloBoutonAppel({ ...etatSequenceAppel(0, DUREE, o), forceLueur: 0 }, BOITE, "#ff6a00").boxShadow).toBe("none");
    for (let i = 0; i < DUREE; i++) {
      const s = String(haloBoutonAppel(etatSequenceAppel(i, DUREE, o), BOITE, "#ff6a00").boxShadow);
      expect(s).not.toContain("blur");
    }
    expect(haloBoutonAppel({ ...etatSequenceAppel(0, DUREE, o), forceLueur: 1 }, BOITE, "#ff6a00").boxShadow).not.toBe("none");
  });

  it("garde statique : rien dans src/ n'importe sequence-appel", () => {
    const racine = join(process.cwd(), "src");
    const visiter = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? visiter(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
      });
    const fautifs = visiter(racine).filter((p) => !p.endsWith("sequence-appel.ts") && /sequence-appel/.test(readFileSync(p, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("le texte du fichier : ni lien, ni arobase, ni « Tape »", () => {
    const src = readFileSync(join(process.cwd(), "src/briques/motion/habillage-commun/sequence-appel.ts"), "utf8");
    expect(src).not.toMatch(/http/);
    expect(src).not.toMatch(/@/);
    expect(src).not.toMatch(/Tape/);
    expect(src).not.toMatch(/import .*from "@\//);
  });
});
