/** C9-34a — enveloppe « objet → pièce du plan de scènes » : fonction pure, rien n'est inscrit. */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { envelopperObjets, envelopperObjetsAvecEcartes } from "../../../src/briques/plan-scenes/briques/objets";
import { CATALOGUE_BRIQUES, IDS_PIECES } from "../../../src/briques/plan-scenes/catalogue";
import type { DefinitionObjet } from "../../../src/briques/motion/petits-objets/contrat";
import { DEF_BADGE, EXEMPLES_ETIQUETTES } from "../../../src/briques/motion/petits-objets/etiquettes";
import { EXEMPLES_GROS_CHIFFRE, OBJET_GROS_CHIFFRE } from "../../../src/briques/motion/petits-objets/gros-chiffre";
import { EXEMPLES_FENETRE_APP, OBJET_FENETRE_APP } from "../../../src/briques/motion/petits-objets/fenetre-app";

const DEFS = [DEF_BADGE, OBJET_GROS_CHIFFRE, OBJET_FENETRE_APP] as unknown as DefinitionObjet<unknown>[];
const graineDe = (id: string) => id.length * 7;
const BASE = { image: 10, fps: 25, dureeImages: 60, fond: "ivoire" as const };

describe("C9-34a enveloppe des objets", () => {
  const pieces = envelopperObjets(DEFS, graineDe);

  it("3 pièces, mêmes identifiants", () => {
    expect(Object.keys(pieces).sort()).toEqual(DEFS.map((d) => d.id).sort());
    for (const d of DEFS) {
      expect(pieces[d.id].toile).toEqual(d.toile);
      expect(pieces[d.id].dureeSec).toEqual(d.dureeSec);
    }
  });

  it("paramètres valides acceptés, invalides refusés sans exception", () => {
    expect(pieces["objet-badge"].schema.safeParse(EXEMPLES_ETIQUETTES.badge[0]).success).toBe(true);
    expect(pieces["objet-gros-chiffre"].schema.safeParse(EXEMPLES_GROS_CHIFFRE[0]).success).toBe(true);
    expect(pieces["objet-fenetre-app"].schema.safeParse(EXEMPLES_FENETRE_APP[0]).success).toBe(true);
    for (const id of Object.keys(pieces) as (keyof typeof pieces)[]) {
      for (const mauvais of [{ n: "x" }, null, undefined, 42, "texte"]) {
        expect(() => pieces[id].schema.safeParse(mauvais)).not.toThrow();
        expect(pieces[id].schema.safeParse(mauvais).success).toBe(false);
      }
    }
  });

  it("balisage de la pièce = balisage de def.Rendu (ton neutre par défaut, graine fournie)", () => {
    const cas: [DefinitionObjet<unknown>, unknown][] = [
      [DEFS[0], EXEMPLES_ETIQUETTES.badge[0]],
      [DEFS[1], EXEMPLES_GROS_CHIFFRE[1]],
      [DEFS[2], EXEMPLES_FENETRE_APP[0]],
    ];
    for (const [def, parametres] of cas) {
      const attendu = renderToStaticMarkup(def.Rendu({ ...BASE, parametres, ton: "neutre", graine: graineDe(def.id) }));
      const obtenu = renderToStaticMarkup(pieces[def.id].Rendu({ ...BASE, parametres }));
      expect(obtenu).toBe(attendu);
      expect(obtenu.length).toBeGreaterThan(0);
    }
  });

  it("même entrée = même balisage", () => {
    const p = { ...BASE, parametres: EXEMPLES_GROS_CHIFFRE[0] };
    expect(renderToStaticMarkup(pieces["objet-gros-chiffre"].Rendu(p))).toBe(renderToStaticMarkup(pieces["objet-gros-chiffre"].Rendu(p)));
  });

  it("définition non conforme écartée, listée à part", () => {
    const mauvaise = { ...OBJET_GROS_CHIFFRE, id: "mauvais" } as unknown as DefinitionObjet<unknown>;
    const { pieces: p2, ecartees } = envelopperObjetsAvecEcartes([...DEFS, mauvaise], graineDe);
    expect(Object.keys(p2)).toHaveLength(3);
    expect(ecartees).toHaveLength(1);
    expect(ecartees[0].id).toBe("mauvais");
    expect(ecartees[0].refus).toMatch(/objet-/);
    expect(Object.keys(envelopperObjets([mauvaise], graineDe))).toHaveLength(0);
  });

  it("garde : seuls les 56 objets inscrits (4 + 6 + 3 + 5 + 6 + 6 + 8 + 8 + 10) sont au catalogue (porte fermée)", () => {
    // 17/11/2026 BR-OBJETS-a (C9-34b) : référence changée volontairement, « aucun objet » devient « exactement ces 4 ».
    // 18/11/2026 BR-OBJETS-c (amendement n°1 du pilote) : « exactement ces 4 » devient « exactement ces 10 » (4 + 6).
    const dix = ["objet-cartes-coche", "objet-carton-definition", "objet-coche", "objet-compteur-rouleau", "objet-croix", "objet-etape", "objet-fleche-main-levee", "objet-gros-chiffre", "objet-mot-barre", "objet-soulignement-droit"];
    // BR-OBJETS-2027-b : + 3 (croquis, entourage et soulignement au feutre) → 13.
    dix.push("objet-croquis", "objet-feutre-entourage", "objet-feutre-soulignement");
    // N-05-v19b : + 5 (carton magazine, icône qui tourne, particules, panneau de réglages, anneau de données) → 18.
    dix.push("objet-carton-magazine", "objet-tourne", "objet-particules", "objet-panneau-reglages", "objet-anneau-donnees");
    // C9-34-TRAITS-v19c : + 6 (2 soulignements, surligneur, 3 flèches) → 24.
    dix.push("objet-soulignement-vague", "objet-soulignement-double", "objet-surligneur", "objet-fleche-droite", "objet-fleche-courbe", "objet-fleche-pointillee");
    // C9-34-CADRES-v20b : + 6 (3 cadres, cercle, ovale, double boucle) → 30.
    dix.push("objet-cadre-rectangle", "objet-cadre-coins", "objet-cadre-passage", "objet-cercle", "objet-ovale", "objet-double-boucle");
    // C9-34-ETIQUETTES-v20f : + 8 (pastille, étiquette, badge, tampon, 3 bulles, post-it) → 38.
    dix.push("objet-pastille-icone", "objet-etiquette-icone", "objet-badge", "objet-tampon", "objet-bulle-parole", "objet-bulle-pensee", "objet-bulle-notification", "objet-post-it");
    // C9-34-SCHEMAS-v20g : + 8 (6 schémas, fenêtre d'application, terminal) → 46.
    dix.push("objet-schema-flux", "objet-schema-etoile", "objet-icones-reliees", "objet-agents-globe", "objet-grille-pointillee", "objet-vignettes-numerotees", "objet-fenetre-app", "objet-terminal-commande");
    // C9-34-FIN-v20h : + 10 (dossier, chrono, barre, étape en segments, 3 appels, frise, pellicule, onde) → 56.
    dix.push("objet-dossier", "objet-chrono", "objet-barre-progression", "objet-etape-segments", "objet-appel-action", "objet-appel-mot", "objet-appel-rdv", "objet-frise-montage", "objet-pellicule", "objet-onde-motif");
    dix.sort();
    expect(IDS_PIECES.filter((i) => i.startsWith("objet-")).sort()).toEqual(dix);
    expect(Object.keys(CATALOGUE_BRIQUES).filter((i) => i.startsWith("objet-")).sort()).toEqual(dix);
  });
});
