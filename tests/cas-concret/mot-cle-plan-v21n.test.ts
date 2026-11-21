/**
 * BR-MOT-CLE-b (X1-18) · option `motCle?` de `planScenesCasConcret` : éteinte = plan identique ; `actif: true` pose le mot-clé
 * (BR-MOT-CLE-a) puis revalide. Aucun appel Claude (stock seulement), 0 €.
 */
import { describe, expect, it } from "vitest";
import { planScenesCasConcret, type GroupePourPlan } from "@/moteurs/montage-cas-concret/plan-scenes";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

function groupe(id: string, texte: string): GroupePourPlan {
  const phrases = texte.match(/[^.?!]+[.?!]?/g)!.map((p) => p.trim()).filter(Boolean);
  let t = 0;
  return {
    id,
    ecrans: phrases.map((texteDit, i) => {
      const debutMs = t;
      t += texteDit.split(/\s+/).length * 350;
      return { id: `e${i + 1}`, texteDit, debutMs, finMs: t };
    }),
  };
}
// Première phrase sans fait ni chiffre : le stock ne pose rien entre 0 et 3 s, la place est libre pour le mot-clé.
const SCRIPT = "Voici comment relancer vos devis sans stress avec cette méthode très simple. Hier 3 clients ont répondu. Merci à vous.";
const GROUPES = [groupe("g0", SCRIPT), ...DIX_SCRIPTS.map((s, i) => groupe(`g${i + 1}`, s))];
const mots = (r: Awaited<ReturnType<typeof planScenesCasConcret>>) => Object.values(r.tranches).flatMap((t) => t.scenes).filter((s) => s.piece === "legende" && s.position === "haut" && (s.parametres as { style?: string }).style === "etiquette");

describe("planScenesCasConcret · motCle", () => {
  it("absent ou actif:false : résultat identique en profondeur (tranches, remarques, mémo)", async () => {
    const base = await planScenesCasConcret({ groupes: GROUPES });
    expect(Object.keys(base.tranches).length).toBeGreaterThan(0);
    const eteint = await planScenesCasConcret({ groupes: GROUPES, motCle: { actif: false, sujet: "devis", motsInterdits: [] } });
    expect(eteint).toEqual(base);
    expect(mots(base)).toHaveLength(0);
  });
  it("actif:true : une légende d'un mot en haut avant 3 s quand la place est libre, mémo inchangé, aucune remarque neuve", async () => {
    const base = await planScenesCasConcret({ groupes: GROUPES });
    let pose = 0;
    for (const g of GROUPES) {
      for (const sujet of g.ecrans[0]!.texteDit.split(/\s+/).filter((m) => m.length > 4)) {
        const r = await planScenesCasConcret({ groupes: [g], motCle: { actif: true, sujet, motsInterdits: [] } });
        const sans = await planScenesCasConcret({ groupes: [g] });
        expect(r.memo).toEqual(sans.memo);
        expect(r.remarques).toEqual(sans.remarques);
        for (const s of mots(r)) {
          pose++;
          expect(s.piece).toBe("legende");
          expect(s.position).toBe("haut");
          expect(s.debutMs).toBeLessThan(3000);
          expect((s.parametres as { texte: string }).texte).not.toMatch(/\s/);
        }
      }
    }
    expect(base.tranches["g0/e1"]).toBeUndefined();
    expect(pose).toBeGreaterThan(0);
  });
  it("aucun mot commun avec le sujet : plan identique", async () => {
    const base = await planScenesCasConcret({ groupes: GROUPES });
    const r = await planScenesCasConcret({ groupes: GROUPES, motCle: { actif: true, sujet: "zzzzqqq", motsInterdits: [] } });
    expect(r.tranches).toEqual(base.tranches);
  });
  it("motsInterdits transmis : le sujet interdit ne pose aucun mot-clé (plan identique au plan sans option)", async () => {
    const base = await planScenesCasConcret({ groupes: GROUPES });
    const libre = await planScenesCasConcret({ groupes: GROUPES, motCle: { actif: true, sujet: "devis", motsInterdits: [] } });
    expect(mots(libre).length).toBeGreaterThan(0);
    const r = await planScenesCasConcret({ groupes: GROUPES, motCle: { actif: true, sujet: "devis", motsInterdits: ["devis"] } });
    expect(r.tranches).toEqual(base.tranches);
    expect(mots(r)).toHaveLength(0);
  });
});
