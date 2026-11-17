import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { IDS_PIECES } from "@/briques/plan-scenes/catalogue";
import { MONTRE_PAR_PIECE, momentsDepuisScenes } from "@/briques/note-extraits/moments-ecran";

const plan = () => JSON.parse(readFileSync(join(__dirname, "fixtures/plan-demo.json"), "utf8"));
const scene = (id: string, piece: string, debutMs: number, finMs: number, plus: Record<string, unknown> = {}) => ({ id, piece, debutMs, finMs, ...plus });
const planDe = (scenes: unknown[]) => ({ ...plan(), scenes });

describe("X4-03 moments écran depuis le plan de scènes", () => {
  it("chaque pièce du catalogue a une ligne (casse si une pièce neuve arrive)", () => {
    expect(Object.keys(MONTRE_PAR_PIECE).sort()).toEqual([...IDS_PIECES].sort());
  });

  it("la table suit la fiche", () => {
    expect(MONTRE_PAR_PIECE["tableau-de-bord"]).toBe("interface");
    expect(MONTRE_PAR_PIECE["carte-kpi"]).toBe("chiffre");
    expect(MONTRE_PAR_PIECE["etapes"]).toBe("demarche");
    expect(MONTRE_PAR_PIECE["curseur"]).toBe("geste");
    expect(MONTRE_PAR_PIECE["repere"]).toBe("texte");
  });

  it("scène de 14 s → 3 moments de 6 s au plus, qui couvrent la scène", () => {
    const m = momentsDepuisScenes(planDe([scene("a", "tableau-de-bord", 0, 14000)]), { avecVisage: false });
    expect(m).toHaveLength(3);
    for (const x of m) expect(x.finSec - x.debutSec).toBeLessThanOrEqual(6);
    expect(m[0].debutSec).toBe(0);
    expect(m[2].finSec).toBe(14);
    expect(m.every((x) => x.origine === "scene" && x.montre === "interface")).toBe(true);
  });

  it("scène de 2 s isolée → aucun moment", () => {
    expect(momentsDepuisScenes(planDe([scene("a", "graphique", 0, 2000)]), { avecVisage: false })).toEqual([]);
  });

  it("scène courte fondue avec la voisine de même `montre`", () => {
    const m = momentsDepuisScenes(planDe([scene("a", "graphique", 0, 4000), scene("b", "barres", 4000, 6000)]), { avecVisage: false });
    expect(m).toHaveLength(1);
    expect(m[0].debutSec).toBe(0);
    expect(m[0].finSec).toBe(6);
    expect(m[0].montre).toBe("chiffre");
  });

  it("scène courte voisine d'une autre `montre` : écartée", () => {
    const m = momentsDepuisScenes(planDe([scene("a", "graphique", 0, 4000), scene("b", "curseur", 4000, 6000)]), { avecVisage: false });
    expect(m.map((x) => x.id)).toEqual(["s-0-400"]);
  });

  it("la pièce principale décide ; les calques complètent `pieces`", () => {
    const m = momentsDepuisScenes(plan(), { avecVisage: true });
    const premier = m[0];
    expect(premier.montre).toBe("interface");
    expect(premier.pieces).toEqual(["tableau-de-bord", "curseur", "carte-kpi"]);
    expect(premier.avecVisage).toBe(true);
    expect(premier.texte).toBe("Votre tableau");
    expect(premier.texteIncruste).toBe(true);
  });

  it("identifiants stables `s-${debutCs}-${finCs}`, sans doublon, identiques d'un appel à l'autre", () => {
    const a = momentsDepuisScenes(plan(), { avecVisage: false });
    const b = momentsDepuisScenes(plan(), { avecVisage: false });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    expect(new Set(a.map((x) => x.id)).size).toBe(a.length);
    for (const x of a) expect(x.id).toBe(`s-${Math.round(x.debutSec * 100)}-${Math.round(x.finSec * 100)}`);
    expect(momentsDepuisScenes(planDe([scene("a", "graphique", 0, 5000)]), { avecVisage: false })[0].id).toBe("s-0-500");
  });

  it("plan invalide → [] sans erreur", () => {
    for (const p of [null, undefined, 42, "x", {}, { scenes: "x" }, { scenes: [] }, { scenes: [null, 3, { piece: "inconnue", debutMs: 0, finMs: 9000 }] }]) {
      expect(momentsDepuisScenes(p, { avecVisage: false })).toEqual([]);
    }
  });

  it("scène à bornes illisibles ignorée, les autres gardées", () => {
    const m = momentsDepuisScenes(planDe([scene("a", "graphique", 5000, 1000), scene("b", "graphique", 0, 4000)]), { avecVisage: false });
    expect(m).toHaveLength(1);
  });
});
