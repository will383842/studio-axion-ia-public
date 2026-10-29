/**
 * Finitions de la vue d'ensemble (essai LinkedIn 4:5 v-d67cc6670a97) :
 * - la carte de la toile n'est jamais estompée sous des blocs du schéma : en 4:5, toile et vue d'ensemble se fondent l'une
 *   après l'autre (jamais ensemble), et la vue d'ensemble vaut exactement 0 dès la mi-fondu de sortie (aucun fantôme flou) ;
 * - un trait vertical qui saute une rangée passe à côté du bloc intermédiaire (Relance), jamais à travers.
 * 9:16 : le fondu enchaîné d'origine est inchangé.
 */
import { describe, expect, it } from "vitest";
import type { SchemaEntree } from "@/briques/schema-motion";
import { fondusEnsemble } from "../../studio-rendu/compositions/image-video/plan";
import { cheminContourne, planEnsemble } from "../../studio-rendu/compositions/image-video/plan-objets";

const FONDUS = Array.from({ length: 21 }, (_, i) => i / 20);

describe("fondu toile / vue d'ensemble", () => {
  it("4:5 : jamais les deux à la fois, et la vue d'ensemble tombe à 0 net", () => {
    for (const f of FONDUS) {
      const { toile, ensemble } = fondusEnsemble(f, true);
      expect(toile * ensemble).toBe(0);
    }
    expect(fondusEnsemble(0, true)).toEqual({ toile: 1, ensemble: 0 });
    expect(fondusEnsemble(1, true)).toEqual({ toile: 0, ensemble: 1 });
    // Sortie : à la mi-fondu la vue d'ensemble est déjà à 0, la toile n'est pas encore revenue.
    expect(fondusEnsemble(0.5, true)).toEqual({ toile: 0, ensemble: 0 });
  });

  it("4:5 : monotone (la vue d'ensemble monte, la toile descend avec le fondu)", () => {
    let toile = 2;
    let ensemble = -1;
    for (const f of FONDUS) {
      const r = fondusEnsemble(f, true);
      expect(r.toile).toBeLessThanOrEqual(toile);
      expect(r.ensemble).toBeGreaterThanOrEqual(ensemble);
      ({ toile, ensemble } = r);
    }
  });

  it("9:16 : fondu enchaîné d'origine, inchangé", () => {
    for (const f of FONDUS) expect(fondusEnsemble(f, false)).toEqual({ toile: 1 - f, ensemble: f });
  });
});

describe("trait vertical de la vue d'ensemble", () => {
  const n = (id: string, libelle: string, ordre: number): SchemaEntree["noeuds"][number] => ({ id, libelle, role: "etape", couleur: "orange", ordre });
  const schema: SchemaEntree = {
    noeuds: [n("a", "Message reçu", 0), n("b", "Relance", 1), n("c", "Rendez-vous confirmé", 2)],
    // a → c saute « Relance » : sans contournement, le trait vertical traverserait le bloc b.
    liens: [
      { id: "l1", de: "a", vers: "b", couleur: "orange" },
      { id: "l2", de: "b", vers: "c", couleur: "orange" },
      { id: "l3", de: "a", vers: "c", couleur: "orange" },
    ],
    groupes: [],
  };
  const plan = planEnsemble(schema, {});
  const bloc = (id: string) => plan.blocs.find((b) => b.id === id)!;

  it("la flèche qui saute une rangée contourne le bloc intermédiaire", () => {
    const saut = plan.fleches.find((f) => f.id === "l3")!;
    expect(saut.via).toBeDefined();
    const b = bloc("b");
    const { x } = saut.via!;
    // À côté du bloc, dans l'écran, jamais dedans.
    expect(x < b.x || x > b.x + b.largeur).toBe(true);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1080);
    // Elle quitte l'écart sous son départ et arrive par l'écart sous le bloc intermédiaire.
    expect(saut.via!.yHaut).toBeGreaterThan(saut.de.y);
    expect(saut.via!.yHaut).toBeLessThanOrEqual(b.y);
    expect(saut.via!.yBas).toBeGreaterThanOrEqual(b.y + b.hauteur);
    expect(saut.via!.yBas).toBeLessThan(saut.vers.y);
  });

  it("les flèches entre rangées voisines restent droites (aucun contournement)", () => {
    for (const id of ["l1", "l2"]) expect(plan.fleches.find((f) => f.id === id)!.via).toBeUndefined();
  });

  it("le chemin dessiné longe le bloc : son segment vertical est à l'abscisse du contournement", () => {
    const saut = plan.fleches.find((f) => f.id === "l3")!;
    const d = cheminContourne(saut.de, saut.vers, saut.via!);
    expect(d).toContain(`L ${saut.via!.x} ${saut.via!.yBas}`);
    expect(d.startsWith(`M ${saut.de.x} ${saut.de.y}`)).toBe(true);
    expect(d.trim().endsWith(`${saut.vers.x} ${saut.vers.y}`)).toBe(true);
  });
});
