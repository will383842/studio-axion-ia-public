import { describe, expect, it } from "vitest";
import { autoriserTexte, PALETTE } from "@/briques/charte/axion-2026";
import { BANDEAU_NOM, bandeauActif, bandeauAuTemps, cssBandeauNom, poserBandeauNom } from "@/briques/sous-titres/bandeau-nom";
import { sceneAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import { dimensions, positionsVerticales, RESEAUX_VERTICAUX_PAR_DEFAUT, zoneDe } from "@/briques/sous-titres/largeur";
import { empreinteTexte, instantsTexte } from "../../../studio-rendu/src/composition/texte-instants";
import type { IdReseau, Ratio } from "@/domaine/types";

const ZONE = { haut: 8, droite: 18, bas: 22, gauche: 8 };
const base = { nom: "Marie Durand", fonction: "Avocate en droit du travail", dureeVideoSec: 30, largeur: 1080, hauteur: 1920, zone: ZONE, basPct: 73 };

describe("C2-U10 · horaires", () => {
  it("sans encadré : début 0,8 s, fin 3,8 s", () => {
    const b = poserBandeauNom(base)!;
    expect(b.debutSec).toBeCloseTo(0.8, 6);
    expect(b.finSec).toBeCloseTo(3.8, 6);
  });
  it("avec encadré jusqu'à 2 s : début 2,2 s", () => {
    expect(poserBandeauNom({ ...base, encadreFinSec: 2 })!.debutSec).toBeCloseTo(2.2, 6);
  });
  it("vidéo de 5 s : rien ; vidéo de 7 s, encadré jusqu'à 5,5 s : fin bornée à 7 s", () => {
    expect(poserBandeauNom({ ...base, dureeVideoSec: 5 })).toBeNull();
    const b = poserBandeauNom({ ...base, dureeVideoSec: 7, encadreFinSec: 5.5 })!;
    expect(b.debutSec).toBeCloseTo(5.7, 6);
    expect(b.finSec).toBe(7);
  });
  it("fin avant début + 1 s : rien", () => {
    expect(poserBandeauNom({ ...base, dureeVideoSec: 7, encadreFinSec: 6.1 })).toBeNull();
  });
});

describe("C2-U10 · zone sûre", () => {
  const jeux: IdReseau[][] = [RESEAUX_VERTICAUX_PAR_DEFAUT, ["tiktok"], ["instagram"], ["youtube-shorts"]];
  const ratios: Ratio[] = ["9:16", "4:5", "1:1", "16:9"];
  for (const reseaux of jeux)
    for (const ratio of ratios)
      it(`${reseaux.join("+")} ${ratio}`, () => {
        const { largeur, hauteur } = dimensions(ratio);
        const zone = zoneDe(ratio, reseaux);
        const { basPct } = positionsVerticales(ratio, reseaux);
        const b = poserBandeauNom({ ...base, largeur, hauteur, zone, basPct })!;
        expect(b).not.toBeNull();
        const r = b.rect;
        expect(r.x).toBeGreaterThanOrEqual((zone.gauche / 100) * largeur - 1e-6);
        expect(r.x + r.largeur).toBeLessThanOrEqual(largeur * (1 - zone.droite / 100) + 1e-6);
        expect(r.y).toBeGreaterThanOrEqual((zone.haut / 100) * hauteur - 1e-6);
        expect(r.y + r.hauteur).toBeLessThanOrEqual((basPct / 100) * hauteur + 1e-6);
        expect(r.y + r.hauteur).toBeLessThanOrEqual(hauteur * (1 - zone.bas / 100) + 1e-6);
        expect(b.tailleNomPx).toBeGreaterThanOrEqual(BANDEAU_NOM.tailleMinPx * (largeur / 1080) - 1e-6);
        expect(b.tailleFonctionPx).toBeGreaterThanOrEqual(BANDEAU_NOM.tailleMinPx * (largeur / 1080) - 1e-6);
      });
});

describe("C2-U10 · couleurs et refus", () => {
  it("paires de la charte", () => {
    expect(autoriserTexte(PALETTE.ivoire, PALETTE.noir)).toBe(true);
    expect(autoriserTexte(PALETTE.noir, PALETTE.ivoire)).toBe(true);
  });
  it("nom de 33 caractères, fonction de 49, texte vide : rien", () => {
    expect(poserBandeauNom({ ...base, nom: "a".repeat(33) })).toBeNull();
    expect(poserBandeauNom({ ...base, fonction: "a".repeat(49) })).toBeNull();
    expect(poserBandeauNom({ ...base, nom: "   " })).toBeNull();
    expect(poserBandeauNom({ ...base, fonction: "" })).toBeNull();
  });
  it("cas normal : tailles ≥ 36 px", () => {
    const b = poserBandeauNom(base)!;
    expect(b.nom).toBe("Marie Durand");
    expect(b.tailleNomPx).toBeGreaterThanOrEqual(36);
    expect(b.tailleFonctionPx).toBeGreaterThanOrEqual(36);
  });
  it("CSS : couleurs de la palette seulement, ni ombre ni image", () => {
    const b = poserBandeauNom(base)!;
    const css = cssBandeauNom(b, bandeauAuTemps(b, 2), { nom: "N", fonction: "F" });
    expect(css.nom).toMatchObject({ color: PALETTE.ivoire, background: PALETTE.noir, fontFamily: '"N"' });
    expect(css.fonction).toMatchObject({ color: PALETTE.noir, background: PALETTE.ivoire, fontFamily: '"F"' });
    expect(css.filet.background).toBe(PALETTE.terracotta);
    expect(JSON.stringify(css)).not.toMatch(/shadow|url\(|cubic-bezier/i);
  });
});

describe("C2-U10 · mouvement", () => {
  const b = poserBandeauNom(base)!;
  it("invisible avant et après, entrée depuis la gauche, tenue, fondu de sortie", () => {
    expect(bandeauAuTemps(b, 0.5).visible).toBe(false);
    expect(bandeauAuTemps(b, 3.9).visible).toBe(false);
    const e = bandeauAuTemps(b, b.debutSec + 0.1);
    expect(e.visible).toBe(true);
    expect(e.decalageXPx).toBeLessThan(0);
    const tenue = bandeauAuTemps(b, 2.5);
    expect(tenue).toEqual({ visible: true, opacite: 1, decalageXPx: 0 });
    const s = bandeauAuTemps(b, b.finSec - 0.1);
    expect(s.opacite).toBeGreaterThan(0);
    expect(s.opacite).toBeLessThan(1);
    expect(s.decalageXPx).toBe(0);
  });
  it("pas de rebond : décalage monotone vers 0", () => {
    let prec = -Infinity;
    for (let t = b.debutSec; t <= b.debutSec + BANDEAU_NOM.entreeSec; t += 0.01) {
      const d = bandeauAuTemps(b, t).decalageXPx;
      expect(d).toBeLessThanOrEqual(0);
      expect(d).toBeGreaterThanOrEqual(prec - 1e-9);
      prec = d;
    }
  });
  it("bandeauActif", () => {
    expect(bandeauActif(undefined, 2)).toBe(false);
    expect(bandeauActif(b, 2)).toBe(true);
    expect(bandeauActif(b, 4)).toBe(false);
  });
  it("déterminisme", () => {
    expect(poserBandeauNom(base)).toEqual(poserBandeauNom(base));
    expect(bandeauAuTemps(b, 1)).toEqual(bandeauAuTemps(b, 1));
  });
});

const segment = (id: string, debutSec: number, finSec: number) => ({ id, debutSec, finSec, mots: [{ mot: "Voici", debutSec, finSec: finSec - 0.2 }, { mot: "comment", debutSec: finSec - 0.2, finSec }], style: "base" as const, position: "bas" as const });
const donnees: DonneesCalque = {
  largeur: 1080,
  hauteur: 1920,
  segments: [segment("g1", 0.5, 2), segment("g2", 2, 4), segment("g3", 4, 5)],
  base: "karaoke",
  couleurs: { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" },
  largeurMaxPx: 700,
  positions: { milieuPct: 48, hautPct: 13, basPct: 73 },
};

describe("C2-U10 · sous-titres et éteint = identique", () => {
  const b = poserBandeauNom(base)!;
  const avec: DonneesCalque = { ...donnees, bandeauNom: b };
  it("pendant le bandeau, un groupe « bas » est hors du rectangle ; hors bandeau, yPx identique", () => {
    for (const t of [1, 2.5, 3.5]) {
      const y = sceneAuTemps(avec, t)!.yPx;
      expect(y < b.rect.y || y > b.rect.y + b.rect.hauteur).toBe(true);
    }
    const apres = 4.5;
    expect(sceneAuTemps(avec, apres)!.yPx).toBe(sceneAuTemps(donnees, apres)!.yPx);
    expect(sceneAuTemps(avec, 0.6)!.yPx).toBe(sceneAuTemps(donnees, 0.6)!.yPx);
  });
  it("sans champ, scène et empreinte sont celles du modèle sans champ (valeurs de référence)", () => {
    const sansChamp = { ...donnees };
    expect("bandeauNom" in sansChamp).toBe(false);
    for (const t of [0.6, 1, 2.5, 3.5, 4.5, 6]) {
      expect(sceneAuTemps(sansChamp, t)).toEqual(sceneAuTemps({ ...donnees, bandeauNom: undefined }, t));
      const e = empreinteTexte({ sousTitres: sansChamp, encadre: undefined as never, incrustations: [] }, t);
      expect(e).toBe(empreinteTexte({ sousTitres: { ...donnees, bandeauNom: undefined }, encadre: undefined as never, incrustations: [] }, t));
      expect(JSON.parse(e)).toHaveLength(3);
    }
  });
  it("instantsTexte : plusieurs images pendant l'entrée et la sortie, une seule pendant la tenue", () => {
    const nu: DonneesCalque = { ...donnees, segments: [] };
    const p = { sousTitres: { ...nu, bandeauNom: b }, encadre: undefined as never, incrustations: [], images: 150, fps: 30 };
    const { instants } = instantsTexte(p);
    const dans = (a: number, z: number) => instants.filter((t) => t >= a - 1e-9 && t < z).length;
    expect(dans(b.debutSec, b.debutSec + BANDEAU_NOM.entreeSec)).toBeGreaterThan(3);
    expect(dans(b.debutSec + BANDEAU_NOM.entreeSec + 0.1, b.finSec - BANDEAU_NOM.sortieSec - 0.05)).toBeLessThanOrEqual(1);
    expect(dans(b.finSec - BANDEAU_NOM.sortieSec, b.finSec)).toBeGreaterThan(3);
    const sans = instantsTexte({ ...p, sousTitres: nu });
    expect(sans.instants).toEqual([0]);
  });
});
