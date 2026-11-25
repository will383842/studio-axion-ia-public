/**
 * BR-MOT-CLE-c-v21s (X1-18) · la fabrication du cas concret demande le mot-clé de recherche en BANDEAU, au début du corps seulement.
 * ALLUMÉ dès que le plan de scènes tourne ; seul `motCle: false` l'éteint. Doubles seulement, plan du stock, 0 €.
 */
import { describe, expect, it, vi } from "vitest";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { poserMotCleAuPlan, LETTRES_MOT_CLE_MAX, STYLE_MOT_CLE } from "@/briques/plan-scenes-generateurs/mot-cle-au-plan";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { FORMAT_PLAN_CAS_CONCRET, planScenesCasConcret, type GroupePourPlan } from "@/moteurs/montage-cas-concret/plan-scenes";
import { doubles } from "./fabriquer/doubles";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const appelsPlan: Record<string, unknown>[] = [];
vi.mock("@/moteurs/montage-cas-concret/plan-scenes", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-cas-concret/plan-scenes")>();
  return { ...m, planScenesCasConcret: (o: Record<string, unknown>) => { appelsPlan.push(o); return m.planScenesCasConcret(o as never); } };
});

async function fabriquer(extra: Record<string, unknown> = {}, avecPlan = true) {
  const d = doubles();
  if (avecPlan) d.options.planScenes = {};
  Object.assign(d.options, extra);
  appelsPlan.length = 0;
  await fabriquerCasConcret(d.options);
  const props = d.ecransSoumis().map((s) => (s.parametres as { proprietes: { id: string; planScenes?: unknown } }).proprietes);
  return { d, props, appels: [...appelsPlan] };
}
const figer = (x: unknown) => JSON.stringify(x).replace(/jeton=[^"&]*/g, "jeton=_");

function groupe(id: string, texte: string): GroupePourPlan {
  const phrases = texte.match(/[^.?!]+[.?!]?/g)!.map((p) => p.trim()).filter(Boolean);
  let t = 0;
  return { id, ecrans: phrases.map((texteDit, i) => { const debutMs = t; t += texteDit.split(/\s+/).length * 350; return { id: `e${i + 1}`, texteDit, debutMs, finMs: t }; }) };
}
const SCRIPT = "Voici comment relancer vos devis sans stress avec cette méthode très simple. Hier 3 clients ont répondu. Merci à vous.";

describe("BR-MOT-CLE-c-v21s · fabrication", () => {
  it("(a) allumé par défaut : le plan reçoit motCle actif, sujet = titre du cas, mot interdit = cas.mot", async () => {
    const x = await fabriquer();
    expect(x.appels.length).toBeGreaterThan(0);
    const cas = trouverCas(x.d.options.entrees.casId)!;
    for (const a of x.appels) {
      expect(a.motCle).toEqual({ actif: true, sujet: cas.titre || cas.theme || cas.promesse, motsInterdits: [cas.mot] });
    }
  });
  it("(b) motCle:false éteint : aucune clé, écrans identiques à ceux d'un plan appelé sans motCle", async () => {
    const x = await fabriquer({ motCle: false });
    expect(x.appels.length).toBeGreaterThan(0);
    for (const a of x.appels) expect(Object.keys(a)).not.toContain("motCle");
    const y = await fabriquer({ motCle: false });
    expect(figer(y.props)).toBe(figer(x.props));
  });
  it("(c) entrees.mot présent : c'est lui, pas cas.mot, qui est interdit", async () => {
    const d = doubles();
    d.options.planScenes = {};
    d.options.entrees = { ...d.options.entrees, mot: "motdutest" };
    appelsPlan.length = 0;
    await fabriquerCasConcret(d.options);
    expect(appelsPlan.length).toBeGreaterThan(0);
    for (const a of appelsPlan) expect((a.motCle as { motsInterdits: string[] }).motsInterdits).toEqual(["motdutest"]);
  });
  it("(d) sans plan de scènes : le plan n'est pas appelé", async () => {
    const x = await fabriquer({}, false);
    expect(x.appels).toHaveLength(0);
  });
  it("(e) bandeau : une légende d'un mot en haut, style bandeau, dans le corps ; aucune dans les fins", async () => {
    const r = await planScenesCasConcret({
      groupes: [groupe("corps", SCRIPT), groupe("fin-x", SCRIPT)],
      motCle: { actif: true, sujet: "devis", motsInterdits: [] },
    });
    const mots = (pref: string) => Object.entries(r.tranches).filter(([k]) => k.startsWith(pref)).flatMap(([, t]) => t.scenes).filter((s) => s.piece === "legende" && s.position === "haut" && !/\s/.test((s.parametres as { texte: string }).texte));
    const dansCorps = mots("corps/");
    expect(dansCorps.length).toBe(1);
    expect((dansCorps[0]!.parametres as { style: string }).style).toBe("bandeau");
    expect(dansCorps[0]!.debutMs).toBeLessThan(3000);
    expect(mots("fin-x/")).toHaveLength(0);
  });
  it("(f) premier groupe seulement : deux groupes libres à 0 ms, mot-clé dans le premier", async () => {
    const r = await planScenesCasConcret({
      groupes: [groupe("corps", SCRIPT), ...DIX_SCRIPTS.slice(0, 1).map(() => groupe("fin-y", SCRIPT))],
      motCle: { actif: true, sujet: "devis", motsInterdits: [] },
    });
    const ids = new Set(Object.entries(r.tranches).filter(([, t]) => t.scenes.some((s) => s.piece === "legende" && s.position === "haut" && (s.parametres as { style?: string }).style === "bandeau")).map(([k]) => k.split("/")[0]));
    expect([...ids]).toEqual(["corps"]);
  });
  it("(g) le plus long mot tient : 24 lettres au bandeau, scène gardée sans remarque", () => {
    const mot = "désinstitutionnalisation";
    expect([...mot].length).toBe(LETTRES_MOT_CLE_MAX);
    expect(STYLE_MOT_CLE).toBe("bandeau");
    const mots = [{ texte: "Voici", debutMs: 0, finMs: 300 }, { texte: mot, debutMs: 400, finMs: 2200 }, { texte: "merci", debutMs: 2300, finMs: 4000 }];
    const base = { version: 1, format: FORMAT_PLAN_CAS_CONCRET, facecam: false, dureeMs: 4000, habillage: { fond: "ivoire", accent: "terracotta" }, mots, scenes: [] };
    const v0 = validerPlan(base as never, { mots, format: FORMAT_PLAN_CAS_CONCRET, facecam: false, dureeMs: 4000 });
    const pose = poserMotCleAuPlan(v0.plan, mots, mot);
    expect(pose.scenes.length).toBe(1);
    const v = validerPlan(pose, { mots, format: FORMAT_PLAN_CAS_CONCRET, facecam: false, dureeMs: 4000 });
    expect(v.plan.scenes.length).toBe(1);
    expect(v.remarques.filter((r) => /TEXTE_TROP_LONG|DEBORDEMENT/.test(JSON.stringify(r)))).toHaveLength(0);
  });
});
