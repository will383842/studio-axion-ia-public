/**
 * K2-T2-a : preuve préalable à K2-T2. Un groupe VIDÉ par `filtrerSelectif` (`mots: []`, mêmes bornes) traverse la vraie
 * chaîne de dessin (`donneesCalque` → `sceneAuTemps` / `elementDe` / `boiteAuTemps` / `paveAuTemps` / `etiquetteAuTemps`
 * / `escalierAuTemps` / `controlerSousTitres`) sans exception et sans rien dessiner ; les groupes gardés restent identiques.
 */
import { describe, expect, it } from "vitest";
import { controlerSousTitres, donneesCalque, type StyleSousTitresVarie } from "@/briques/sous-titres";
import { filtrerSelectif } from "@/briques/sous-titres/selectif";
import { boiteAuTemps, elementDe, escalierAuTemps, etiquetteAuTemps, largeurElement, paveAuTemps, sceneAuTemps, segmentAuTemps, type DonneesCalque } from "@/briques/sous-titres/scene";
import type { SegmentRendu } from "@/briques/sous-titres/types-rendu";

const seg = (id: string, debut: number, texte: string, extra: Partial<SegmentRendu> = {}): SegmentRendu => {
  const mots = texte.split(" ");
  return { id, debutSec: debut, finSec: debut + 1, mots: mots.map((mot, i) => ({ mot, debutSec: debut + i / mots.length, finSec: debut + (i + 1) / mots.length })), ...extra };
};
// a : gardé (mot-clé « devis ») ; b : vidé ; c : gardé (nombre) ; d : vidé ; e : vidé, style impact ; f : vidé, style bandeau.
const ENTREE: SegmentRendu[] = [
  seg("a", 0, "Le devis arrive."),
  seg("b", 1, "puis on regarde ensemble"),
  seg("c", 2, "pour trente euros."),
  seg("d", 3, "et voilà tout"),
  seg("e", 4, "vraiment très bien", { style: "impact", inclinaison: 3 }),
  seg("f", 5, "juste ici", { style: "bandeau" }),
];
const VIDES = ["b", "d", "e", "f"];
const GARDES = ["a", "c"];
const filtres = filtrerSelectif(ENTREE, ["devis"], true);

const STYLES: Record<string, StyleSousTitresVarie | null> = {
  base: null,
  pave: { texteEcran: { pave: { mots: "forts-et-chiffres" } } } as unknown as StyleSousTitresVarie,
  marqueur: { texteEcran: { marqueur: { teinte: "terracotta" } } } as unknown as StyleSousTitresVarie,
  outils: { texteEcran: { outils: "etiquette" } } as unknown as StyleSousTitresVarie,
  boite: { boiteArrondie: true } as unknown as StyleSousTitresVarie,
  poids: { poidsVariable: true } as unknown as StyleSousTitresVarie,
  pastille: { pastille: "axion" } as unknown as StyleSousTitresVarie,
};

const donnees = (base: "karaoke" | "minimal", style: StyleSousTitresVarie | null): DonneesCalque => donneesCalque({ segments: filtres, base, ratio: "9:16", style });
const milieu = (id: string) => (ENTREE.find((s) => s.id === id)!.debutSec) + 0.5;

describe("filtrerSelectif : forme de la sortie", () => {
  it("groupes vidés : mêmes bornes, mots []; gardés : identiques à l'entrée", () => {
    expect(filtres.map((g) => g.id)).toEqual(ENTREE.map((g) => g.id));
    for (const g of filtres) {
      const e = ENTREE.find((x) => x.id === g.id)!;
      expect([g.debutSec, g.finSec]).toEqual([e.debutSec, e.finSec]);
      if (VIDES.includes(g.id)) expect(g.mots).toEqual([]);
      else expect(g).toEqual(e);
    }
  });
});

describe.each(["karaoke", "minimal"] as const)("groupes vidés dans la vraie chaîne (base %s)", (base) => {
  describe.each(Object.entries(STYLES))("style %s", (_nom, style) => {
    const d = donnees(base, style);
    it("aucune exception, à aucun instant (pas de 0,1 s sur toute la durée)", () => {
      for (let t = 0; t <= 6.5; t += 0.1) {
        expect(() => {
          sceneAuTemps(d, t);
          boiteAuTemps(d, t);
          paveAuTemps(d, t);
          etiquetteAuTemps(d, t);
          escalierAuTemps(d, t);
        }).not.toThrow();
      }
    });
    it.each(VIDES)("groupe vidé %s : élément sans aucun mot, largeur finie", (id) => {
      const el = sceneAuTemps(d, milieu(id));
      expect(el?.cle).toBe(id);
      expect(el?.mots).toEqual([]);
      expect(Number.isFinite(largeurElement(el!))).toBe(true);
      expect(Number.isFinite(el!.taillePx)).toBe(true);
      expect(() => elementDe(d, segmentAuTemps(d.segments, milieu(id))!, milieu(id))).not.toThrow();
    });
    it.each(VIDES)("groupe vidé %s : ni boîte, ni plaque, ni étiquette", (id) => {
      const t = milieu(id);
      expect(boiteAuTemps(d, t)).toBeNull();
      expect(paveAuTemps({ ...d, paveAnime: true }, t)).toBeNull();
      expect(etiquetteAuTemps(d, t)).toBeNull();
    });
    it.each(GARDES)("groupe gardé %s : dessiné avec ses mots", (id) => {
      const el = sceneAuTemps(d, milieu(id));
      expect(el?.mots.length).toBe(ENTREE.find((s) => s.id === id)!.mots.length);
    });
  });

  it("groupes gardés : même dessin avec ou sans filtrage", () => {
    const brut = donneesCalque({ segments: ENTREE, base, ratio: "9:16" });
    const filtre = donneesCalque({ segments: filtres, base, ratio: "9:16" });
    for (const id of GARDES) expect(sceneAuTemps(filtre, milieu(id))).toEqual(sceneAuTemps(brut, milieu(id)));
  });

  it("escalier : un groupe vidé donne une ligne vide, sans exception", () => {
    const d = { ...donnees(base, null), escalier: { zone: { xPx: 60, yPx: 1300, largeurPx: 900, hauteurPx: 420 }, taillePx: 48 } };
    expect(escalierAuTemps(d, milieu("b"))?.lignes.at(-1)).toBe("");
    expect(escalierAuTemps(d, milieu("a"))?.lignes).toEqual(["Le devis arrive."]);
  });

  it("controlerSousTitres : aucune exception, aucun débordement dû aux groupes vidés", () => {
    const d = donnees(base, null);
    expect(() => controlerSousTitres(d, { texte: "Le devis arrive. pour trente euros.", motsScript: ["Le", "devis", "arrive."], dureeVideoSec: 7, fps: 30 })).not.toThrow();
    expect(controlerSousTitres(d).some((a) => a.code === "debordement-sous-titres")).toBe(false);
  });
});
