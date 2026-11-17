import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { seChevauchent, ZONE_VISAGE, devantLeVisage } from "../../../src/briques/plan-scenes/zones";
import {
  etapeMontante,
  pastilleContexte,
  RATIOS_COUVERTURE,
  ENTREE_S,
  SORTIE_S,
  TENUE_S,
  TAILLES_TEXTE,
  POLICE_COUVERTURE,
  ETAPE_Y_FINAL_PCT,
  ETAPE_HAUTEUR_PCT,
  ETAPE_LARGEUR_PCT,
  ETAPE_X_PCT,
} from "../../../src/briques/motion/titres-couverture/etapes";

const IPS = 30;
const DEBUT = 12;
const ok = { numero: 3, libelle: "On pose le cadre", debutImage: DEBUT, ips: IPS };
const FIN = DEBUT + Math.round((ENTREE_S + TENUE_S + SORTIE_S) * IPS);

/** Rectangle occupé par l'étape à une image donnée (largeur/hauteur fixes, y rendu en %). */
function rectEtape(y: number) {
  return { x: ETAPE_X_PCT, y, largeur: ETAPE_LARGEUR_PCT, hauteur: ETAPE_HAUTEUR_PCT };
}

describe("étape qui monte (C11-T6b-a) — refus", () => {
  it("refuse un numéro 0 ou 10, ou non entier", () => {
    expect(() => etapeMontante({ ...ok, numero: 0 })).toThrow();
    expect(() => etapeMontante({ ...ok, numero: 10 })).toThrow();
    expect(() => etapeMontante({ ...ok, numero: 2.5 })).toThrow();
  });
  it("refuse un libellé vide ou de 6 mots, accepte 5 mots", () => {
    expect(() => etapeMontante({ ...ok, libelle: "" })).toThrow();
    expect(() => etapeMontante({ ...ok, libelle: "   " })).toThrow();
    expect(() => etapeMontante({ ...ok, libelle: "un deux trois quatre cinq six" })).toThrow();
    expect(() => etapeMontante({ ...ok, libelle: "un deux trois quatre cinq" })).not.toThrow();
  });
  it("refuse des images par seconde ou un début invalides", () => {
    expect(() => etapeMontante({ ...ok, ips: 0 })).toThrow();
    expect(() => etapeMontante({ ...ok, debutImage: -1 })).toThrow();
  });
});

describe("étape qui monte — temps et place", () => {
  const rend = etapeMontante(ok);
  it("opacité 0 avant l'entrée et après la sortie", () => {
    expect(rend(0).opacite).toBe(0);
    expect(rend(DEBUT - 1).opacite).toBe(0);
    expect(rend(FIN + 1).opacite).toBe(0);
    expect(rend(FIN + 500).opacite).toBe(0);
  });
  it("tenue : opacité 1, échelle 1, y final dans le tiers haut (≤ 33 %)", () => {
    const milieu = DEBUT + Math.round((ENTREE_S + TENUE_S / 2) * IPS);
    const r = rend(milieu);
    expect(r.opacite).toBe(1);
    expect(r.echelle).toBe(1);
    expect(r.y).toBe(ETAPE_Y_FINAL_PCT);
    expect(r.y + ETAPE_HAUTEUR_PCT).toBeLessThanOrEqual(33);
  });
  it("monotone pendant l'entrée : y décroît (elle monte), opacité et échelle croissent", () => {
    const n = Math.round(ENTREE_S * IPS);
    let prec = rend(DEBUT);
    for (let i = 1; i <= n; i++) {
      const c = rend(DEBUT + i);
      expect(c.y).toBeLessThanOrEqual(prec.y);
      expect(c.opacite).toBeGreaterThanOrEqual(prec.opacite);
      expect(c.echelle).toBeGreaterThanOrEqual(prec.echelle);
      prec = c;
    }
    expect(prec.opacite).toBe(1);
  });
  it("monotone pendant la sortie : l'opacité décroît", () => {
    const d = DEBUT + Math.round((ENTREE_S + TENUE_S) * IPS);
    let prec = rend(d);
    for (let i = 1; i <= Math.round(SORTIE_S * IPS); i++) {
      const c = rend(d + i);
      expect(c.opacite).toBeLessThanOrEqual(prec.opacite);
      prec = c;
    }
  });
  it("même entrée = même sortie", () => {
    const a = etapeMontante({ ...ok });
    const b = etapeMontante({ ...ok });
    for (let i = 0; i < FIN + 10; i++) expect(a(i)).toEqual(b(i));
  });
  it("jamais devant le visage, à toutes les images", () => {
    const rend2 = etapeMontante(ok);
    for (let i = 0; i < FIN + 10; i++) {
      const r = rend2(i);
      expect(seChevauchent(rectEtape(r.y), ZONE_VISAGE), `image ${i}`).toBe(false);
      expect(r.y).toBeLessThanOrEqual(33);
    }
    // la zone « haut » du plan de scènes (même bande) n'est pas devant le visage
    expect(devantLeVisage("haut")).toBe(false);
  });
});

describe("pastille de contexte — refus", () => {
  it("refuse un texte vide, de 29 caractères, ou à plusieurs lignes", () => {
    expect(() => pastilleContexte({ texte: "", ratio: "9:16" })).toThrow();
    expect(() => pastilleContexte({ texte: "a".repeat(29), ratio: "9:16" })).toThrow();
    expect(() => pastilleContexte({ texte: "a\nb", ratio: "9:16" })).toThrow();
    expect(() => pastilleContexte({ texte: "a".repeat(28), ratio: "9:16" })).not.toThrow();
  });
  it("refuse un ratio inconnu", () => {
    // @ts-expect-error ratio volontairement faux
    expect(() => pastilleContexte({ texte: "ok", ratio: "21:9" })).toThrow();
  });
});

describe("pastille de contexte — place", () => {
  for (const ratio of RATIOS_COUVERTURE) {
    it(`${ratio} : hors visage, dans le cadre, coin haut, fixe`, () => {
      const p = pastilleContexte({ texte: "a".repeat(28), ratio });
      expect(seChevauchent(p, ZONE_VISAGE)).toBe(false);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.largeur).toBeLessThanOrEqual(100);
      expect(p.y + p.hauteur).toBeLessThanOrEqual(33);
      expect(p.y).toBeLessThan(ZONE_VISAGE.y);
      expect(pastilleContexte({ texte: "a".repeat(28), ratio })).toEqual(p);
    });
    it(`${ratio} : l'étape ne recouvre pas la pastille`, () => {
      const p = pastilleContexte({ texte: "a".repeat(28), ratio });
      const r = etapeMontante(ok);
      for (let i = 0; i < FIN; i++) expect(seChevauchent(rectEtape(r(i).y), p)).toBe(false);
    });
  }
});

describe("constantes", () => {
  it("durées demandées et Manrope 400/800", () => {
    expect(ENTREE_S).toBe(0.3);
    expect(SORTIE_S).toBe(0.2);
    expect(TENUE_S).toBeGreaterThan(0);
    expect(POLICE_COUVERTURE).toBe("Manrope");
    expect(TAILLES_TEXTE.etape.graisse).toBe(800);
    expect(TAILLES_TEXTE.pastille.graisse).toBe(400);
  });
});

describe("garde statique", () => {
  const chemin = "src/briques/motion/titres-couverture/etapes.ts";
  const src = readFileSync(chemin, "utf8");
  it("n'importe ni React, ni Remotion, ni @/services", () => {
    expect(src).not.toMatch(/from\s+["'](react|remotion)/);
    expect(src).not.toMatch(/from\s+["']@\/services/);
    expect(src).not.toMatch(/require\(/);
  });
  it("rien ne l'importe (code éteint)", () => {
    const sortie = execSync(
      `grep -rlE "titres-couverture/etapes" src studio-rendu --include=*.ts --include=*.tsx || true`,
      { encoding: "utf8" },
    );
    expect(sortie.trim()).toBe("");
  });
});
