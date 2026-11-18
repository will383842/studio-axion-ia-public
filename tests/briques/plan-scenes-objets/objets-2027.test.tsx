/**
 * BR-OBJETS-2027-a — le croquis et le trait de feutre sont de vrais objets du registre, rien n'est allumé.
 * (a) par le vrai chemin `piecesPermisesDesEntrees` ; (b) fermé = `[]` ; (c) `valider` ne lève jamais, même graine = même SVG ;
 * (d) rendu par instants (le trait se dessine). Aucun appel, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import { verifierDefinition } from "@/briques/motion/petits-objets/contrat";
import { EXEMPLES_OBJETS_2027, OBJET_CROQUIS, OBJET_FEUTRE_ENTOURAGE, OBJET_FEUTRE_SOULIGNEMENT } from "@/briques/motion/petits-objets/objets-2027";
import { IMAGES_ENTREE } from "@/briques/motion/petits-objets/progres";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import { definitionObjet } from "@/briques/plan-scenes-objets/registre";

const IDS = ["objet-croquis", "objet-feutre-entourage", "objet-feutre-soulignement"];

/** Forme exacte de `entreeBibliothequeDuLancement` (src/services/bibliotheque-video.ts). */
function entrees(capacites: Record<string, { permis: boolean }>, verrous: string[] = []) {
  const profil: ProfilVideo = { ...profilNeutre("format-essai"), capacites: capacites as unknown as ProfilVideo["capacites"], verrous };
  const e: EntreeBibliotheque = { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-18" };
  return { bibliothequeVideo: e };
}

describe("(a) permis : les 3 objets sont proposés par le vrai chemin", () => {
  it("objet.trait + objet.manuscrit → croquis et 2 feutres", () => {
    const r = piecesPermisesDesEntrees(entrees({ [ID.objetTrait]: { permis: true }, [ID.objetManuscrit]: { permis: true } }));
    for (const id of IDS) expect(r).toContain(id);
  });
  it("objet.manuscrit seul → croquis seulement ; objet.trait seul → les 2 feutres sans croquis", () => {
    const m = piecesPermisesDesEntrees(entrees({ [ID.objetManuscrit]: { permis: true } }));
    expect(m).toContain("objet-croquis");
    expect(m).not.toContain("objet-feutre-entourage");
    const t = piecesPermisesDesEntrees(entrees({ [ID.objetTrait]: { permis: true } }));
    expect(t).toContain("objet-feutre-entourage");
    expect(t).toContain("objet-feutre-soulignement");
    expect(t).not.toContain("objet-croquis");
  });
  it("les 3 sont au registre et passent verifierDefinition", () => {
    for (const id of IDS) {
      const d = definitionObjet(id);
      expect(d, id).toBeDefined();
      expect(verifierDefinition(d!), id).toBe("ok");
    }
  });
});

describe("(b) fermé : inchangé", () => {
  it.each([[undefined], [null], [{}], ["x"]])("entrée %j → []", (e) => {
    expect(piecesPermisesDesEntrees(e)).toEqual([]);
  });
  it("capacités fermées, ou famille verrouillée → aucun des 3", () => {
    expect(piecesPermisesDesEntrees(entrees({ [ID.objetTrait]: { permis: false }, [ID.objetManuscrit]: { permis: false } }))).toEqual([]);
    const verrouille = piecesPermisesDesEntrees(entrees({ [ID.objetTrait]: { permis: true }, [ID.objetManuscrit]: { permis: true } }, ["objet"]));
    for (const id of IDS) expect(verrouille).not.toContain(id);
  });
});

const DEFS = [
  { id: "objet-croquis", def: OBJET_CROQUIS as never, exemple: EXEMPLES_OBJETS_2027.croquis[0] },
  { id: "objet-feutre-entourage", def: OBJET_FEUTRE_ENTOURAGE as never, exemple: EXEMPLES_OBJETS_2027.feutreEntourage[0] },
  { id: "objet-feutre-soulignement", def: OBJET_FEUTRE_SOULIGNEMENT as never, exemple: EXEMPLES_OBJETS_2027.feutreSoulignement[0] },
] as const;
type Def = { id: string; toile: { largeur: number; hauteur: number }; valider(p: unknown): unknown; Rendu: (p: unknown) => never };

describe("(c) valider et déterminisme", () => {
  it.each(DEFS)("$id : entrées absurdes → null sans exception, exemple valide", ({ def, exemple }) => {
    const d = def as Def;
    for (const absurde of [undefined, null, 42, "x", [], {}, { boite: null }, { boite: { x: "a" } }, { x: NaN, y: 0, largeur: 1, hauteur: 1 }, { boite: { x: 0, y: 0, largeur: 100, hauteur: 100 } }, { boite: { x: 30, y: 20, largeur: 20, hauteur: 10 } }]) {
      expect(() => d.valider(absurde)).not.toThrow();
      expect(d.valider(absurde)).toBeNull();
    }
    expect(d.valider(exemple)).not.toBeNull();
  });
  it.each(DEFS)("$id : même entrée + même graine = même SVG, autre graine = autre SVG", ({ def, exemple }) => {
    const d = def as Def;
    const rendre = (graine: number) => renderToStaticMarkup(createElement(d.Rendu as never, { image: 30, fps: 25, dureeImages: 75, fond: "noir", parametres: exemple, graine }));
    expect(rendre(7)).toBe(rendre(7));
    expect(rendre(7)).not.toBe(rendre(8));
  });
});

describe("(d) rendu par instants : le trait se dessine, rien hors de la toile", () => {
  it.each(DEFS)("$id : 3 sorties différentes à la phase 0, 0,5 et 1", ({ def, exemple }) => {
    const d = def as Def;
    const dureeImages = 75;
    const instants = [0, Math.floor(IMAGES_ENTREE / 2), IMAGES_ENTREE + 5];
    const sorties = instants.map((image) => renderToStaticMarkup(createElement(d.Rendu as never, { image, fps: 25, dureeImages, fond: "noir", parametres: exemple, graine: 7 })));
    expect(new Set(sorties).size).toBe(3);
    expect(d.toile).toEqual({ largeur: 1000, hauteur: 1000 });
    for (const s of sorties) {
      expect(s).toContain('viewBox="0 0 1000 1000"');
      for (const [, x, y] of s.matchAll(/[ML] ?(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g).map((m) => m)) {
        expect(Number(x)).toBeGreaterThanOrEqual(-10);
        expect(Number(x)).toBeLessThanOrEqual(1010);
        expect(Number(y)).toBeGreaterThanOrEqual(-10);
        expect(Number(y)).toBeLessThanOrEqual(1010);
      }
    }
  });
});
