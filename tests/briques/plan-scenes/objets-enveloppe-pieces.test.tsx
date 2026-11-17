/**
 * C9-34t — filet : toutes les définitions livrées dans `petits-objets` passent l'enveloppe du plan de scènes
 * (C9-34a) sans être écartées. Rien n'est inscrit ; ce test empêche C9-34b / N-05 / N-08c de perdre une pièce en silence.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { envelopperObjetsAvecEcartes, type PieceObjet } from "../../../src/briques/plan-scenes/briques/objets";
import type { DefinitionObjet, IdPetitObjet } from "../../../src/briques/motion/petits-objets/contrat";
import { EXEMPLES_ANNEAU, OBJET_ANNEAU_DONNEES } from "../../../src/briques/motion/petits-objets/anneau-donnees";
import { DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION } from "../../../src/briques/motion/petits-objets/appel-action";
import { EXEMPLES_GROS_CHIFFRE, OBJET_GROS_CHIFFRE } from "../../../src/briques/motion/petits-objets/gros-chiffre";
import { EXEMPLES_CARTES, OBJET_CARTES_COCHE } from "../../../src/briques/motion/petits-objets/cartes";
import { EXEMPLES_ETAPES, OBJET_ETAPE } from "../../../src/briques/motion/petits-objets/etapes";
import { EXEMPLES_FENETRE_APP, OBJET_FENETRE_APP } from "../../../src/briques/motion/petits-objets/fenetre-app";
import { EXEMPLES_TERMINAL_COMMANDE, OBJET_TERMINAL_COMMANDE } from "../../../src/briques/motion/petits-objets/terminal-commande";
import { EXEMPLES_PANNEAU_REGLAGES, OBJET_PANNEAU_REGLAGES } from "../../../src/briques/motion/petits-objets/panneau-reglages";
import { DEF_POST_IT, EXEMPLES_POST_IT } from "../../../src/briques/motion/petits-objets/post-it";
import { EXEMPLES_BULLES, OBJET_BULLE_PAROLE } from "../../../src/briques/motion/petits-objets/bulles";
import { DEF_CADRE_RECTANGLE, EXEMPLES_CADRES } from "../../../src/briques/motion/petits-objets/cadres";
import { EXEMPLES_MARQUES, OBJET_COCHE } from "../../../src/briques/motion/petits-objets/marques";

const DOSSIER = join(__dirname, "../../../src/briques/motion/petits-objets");
const graineDe = (id: string) => id.length * 7 + 3;

const estDefinition = (v: unknown): v is DefinitionObjet<unknown> => {
  const d = v as Partial<DefinitionObjet<unknown>> | null;
  return (
    !!d &&
    typeof d === "object" &&
    typeof d.id === "string" &&
    d.id.startsWith("objet-") &&
    typeof d.capacite === "string" &&
    d.capacite.startsWith("objet.") &&
    typeof d.valider === "function" &&
    typeof d.Rendu === "function"
  );
};

/** Balaye chaque .tsx du dossier ; garde les exports de forme `DefinitionObjet`, dédoublonnés par identité. */
async function balayerDefinitions(): Promise<DefinitionObjet<unknown>[]> {
  const vues = new Set<unknown>();
  const trouvees: DefinitionObjet<unknown>[] = [];
  for (const nom of readdirSync(DOSSIER).filter((f) => f.endsWith(".tsx")).sort()) {
    const mod = (await import(/* @vite-ignore */ join(DOSSIER, nom))) as Record<string, unknown>;
    for (const valeur of Object.values(mod)) {
      if (estDefinition(valeur) && !vues.has(valeur)) {
        vues.add(valeur);
        trouvees.push(valeur);
      }
    }
  }
  return trouvees;
}

const BASE = { image: 50, fps: 25, dureeImages: 100 };
/** Couples (définition, premier exemple) écrits à la main. */
const COUPLES: [DefinitionObjet<unknown>, unknown][] = [
  [OBJET_ANNEAU_DONNEES, EXEMPLES_ANNEAU[0]],
  [DEF_APPEL_ACTION, EXEMPLES_APPEL_ACTION[0]],
  [OBJET_GROS_CHIFFRE, EXEMPLES_GROS_CHIFFRE[0]],
  [OBJET_CARTES_COCHE, EXEMPLES_CARTES[0]],
  [OBJET_ETAPE, EXEMPLES_ETAPES[0]],
  [OBJET_FENETRE_APP, EXEMPLES_FENETRE_APP[0]],
  [OBJET_TERMINAL_COMMANDE, EXEMPLES_TERMINAL_COMMANDE[0]],
  [OBJET_PANNEAU_REGLAGES, EXEMPLES_PANNEAU_REGLAGES[0]],
  [DEF_POST_IT, EXEMPLES_POST_IT[0]],
  [OBJET_BULLE_PAROLE, EXEMPLES_BULLES[0]],
  [DEF_CADRE_RECTANGLE, EXEMPLES_CADRES.rectangle[0]],
  [OBJET_COCHE, EXEMPLES_MARQUES[0]],
] as unknown as [DefinitionObjet<unknown>, unknown][];

describe("C9-34t filet : toutes les pièces passent l'enveloppe", () => {
  let toutes: DefinitionObjet<unknown>[] = [];
  let pieces = {} as Record<IdPetitObjet, PieceObjet>;
  let ecartees: { id: string; refus: string }[] = [];

  beforeAll(async () => {
    toutes = await balayerDefinitions();
    ({ pieces, ecartees } = envelopperObjetsAvecEcartes(toutes, graineDe));
  });

  it("aucune définition écartée ; une pièce par identifiant unique", () => {
    expect(ecartees).toEqual([]);
    const ids = toutes.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(pieces).length).toBe(ids.length);
    // Plancher (relevé sur master au départ), jamais une égalité figée.
    expect(toutes.length).toBeGreaterThanOrEqual(52);
  });

  it("le balayage trouve les pièces attendues", () => {
    const ids = toutes.map((d) => d.id);
    for (const id of ["objet-anneau-donnees", "objet-appel-action", "objet-gros-chiffre", "objet-cadre-rectangle", "objet-particules", "objet-volet-avant-apres"]) {
      expect(ids).toContain(id);
    }
  });

  it("couples (définition, premier exemple) : schéma accepté, balisage identique sur ivoire et noir", () => {
    expect(COUPLES.length).toBeGreaterThanOrEqual(10);
    for (const [def, parametres] of COUPLES) {
      expect(pieces[def.id], def.id).toBeDefined();
      expect(pieces[def.id].schema.safeParse(parametres).success, def.id).toBe(true);
      for (const fond of ["ivoire", "noir"] as const) {
        const attendu = renderToStaticMarkup(def.Rendu({ ...BASE, fond, parametres, ton: "neutre", graine: graineDe(def.id) }));
        const obtenu = renderToStaticMarkup(pieces[def.id].Rendu({ ...BASE, fond, parametres }));
        expect(obtenu, `${def.id} ${fond}`).toBe(attendu);
        expect(obtenu.length).toBeGreaterThan(0);
      }
    }
  });

  it("chaque pièce refuse null, undefined, 42, « texte » sans exception", () => {
    for (const piece of Object.values(pieces)) {
      for (const mauvais of [null, undefined, 42, "texte"]) {
        expect(() => piece.schema.safeParse(mauvais)).not.toThrow();
        expect(piece.schema.safeParse(mauvais).success).toBe(false);
      }
    }
  });

  it("rouge d'abord : contre une liste vide, les attentes « trouve au moins » échoueraient", () => {
    const vide = envelopperObjetsAvecEcartes([], graineDe);
    expect(Object.keys(vide.pieces)).not.toContain("objet-anneau-donnees");
    expect(Object.keys(vide.pieces).length).toBeLessThan(toutes.length);
  });
});
