/**
 * BR-MOT-CLE-b (X1-18) · option `motCle?` de `planScenesCasConcret` : éteinte = plan identique ; `actif: true` pose le mot-clé
 * (BR-MOT-CLE-a) puis revalide. Aucun appel Claude (stock seulement), 0 €.
 */
import { describe, expect, it, vi } from "vitest";

// Espion de passage : validerPlan reste le vrai ; on compte les appels qui reçoivent un plan portant la légende mot-clé.
const appelsAvecMot: unknown[] = [];
vi.mock("@/briques/plan-scenes/validateur", async (orig) => {
  const vrai = await orig<typeof import("@/briques/plan-scenes/validateur")>();
  return {
    ...vrai,
    validerPlan: (brut: { scenes?: { piece?: string; position?: string; parametres?: { style?: string } }[] }, ctx?: unknown) => {
      if (brut?.scenes?.some((x) => x.piece === "legende" && x.position === "haut" && x.parametres?.style === "bandeau")) appelsAvecMot.push(brut);
      return vrai.validerPlan(brut, ctx as never);
    },
  };
});
import { planScenesCasConcret, type GroupePourPlan } from "@/moteurs/montage-cas-concret/plan-scenes";
import { avecEmpreintes, empreinteScene } from "@/briques/plan-scenes/empreinte";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { poserMotCleAuPlan } from "@/briques/plan-scenes-generateurs/mot-cle-au-plan";
import { tranchePlan } from "@/briques/plan-scenes-generateurs/tranche";
import { FORMAT_PLAN_CAS_CONCRET } from "@/moteurs/montage-cas-concret/plan-scenes";
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
const mots = (r: Awaited<ReturnType<typeof planScenesCasConcret>>) => Object.values(r.tranches).flatMap((t) => t.scenes).filter((s) => s.piece === "legende" && s.position === "haut" && (s.parametres as { style?: string }).style === "bandeau");

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
  it("actif:true : le plan posé est REVALIDÉ (plan-scenes.ts:67) : tranches = validerPlan(pose) tranché, empreintes recalculées, aucune remarque neuve", async () => {
    let controles = 0;
    for (const g of GROUPES) {
      const sans = await planScenesCasConcret({ groupes: [g] });
      const plan = sans.memo[g.id]?.plan;
      if (!plan) continue;
      for (const sujet of g.ecrans[0]!.texteDit.split(/\s+/).filter((m) => m.length > 4)) {
        const pose = poserMotCleAuPlan(plan, plan.mots, sujet, []);
        if (pose === plan) continue;
        const v = validerPlan(pose, { mots: plan.mots, format: FORMAT_PLAN_CAS_CONCRET, facecam: false, dureeMs: plan.dureeMs });
        expect(v.remarques).toEqual([]);
        // Limite écrite : le contexte `mots` de validerPlan ne change aucune scène ici (une légende d'un mot dit : la mutation « mots: [] » n'est pas distinguable) ; seuls facecam et format le sont, et ils rougissent.
        const r = await planScenesCasConcret({ groupes: [g], motCle: { actif: true, sujet, motsInterdits: [] } });
        for (const e of g.ecrans) {
          const attendu = tranchePlan(v.plan, e.debutMs, e.finMs);
          expect(r.tranches[`${g.id}/${e.id}`] ?? null).toEqual(attendu);
          for (const sc of attendu?.scenes ?? []) {
            controles++;
            expect(sc.empreinte).toBe(empreinteScene(sc, attendu!));
          }
        }
        // le plan posé et revalidé porte une empreinte par scène, égale à celle de avecEmpreintes
        expect(v.plan).toEqual(avecEmpreintes(v.plan));
      }
    }
    expect(controles).toBeGreaterThan(0);
  });
  it("actif:true : validerPlan est réellement appelé sur le plan posé (plan-scenes.ts:67) ; éteint : jamais sur un plan portant le mot", async () => {
    appelsAvecMot.length = 0;
    await planScenesCasConcret({ groupes: GROUPES });
    await planScenesCasConcret({ groupes: GROUPES, motCle: { actif: false, sujet: "devis", motsInterdits: [] } });
    expect(appelsAvecMot).toHaveLength(0);
    const r = await planScenesCasConcret({ groupes: GROUPES, motCle: { actif: true, sujet: "devis", motsInterdits: [] } });
    expect(mots(r).length).toBeGreaterThan(0);
    expect(appelsAvecMot.length).toBeGreaterThanOrEqual(mots(r).length);
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
