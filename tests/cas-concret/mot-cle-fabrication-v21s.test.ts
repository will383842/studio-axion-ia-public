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
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { doubles } from "./fabriquer/doubles";
import { DIX_SCRIPTS } from "../briques/faits-script/dix-scripts";

const appelsPlan: Record<string, unknown>[] = [];
vi.mock("@/moteurs/montage-cas-concret/plan-scenes", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-cas-concret/plan-scenes")>();
  return { ...m, planScenesCasConcret: (o: Record<string, unknown>) => { appelsPlan.push(o); return m.planScenesCasConcret(o as never); } };
});

async function fabriquer(extra: Record<string, unknown> = {}, avecPlan = true, casId?: string) {
  const d = doubles(casId ? { casId } : {});
  if (avecPlan) d.options.planScenes = {};
  Object.assign(d.options, extra);
  appelsPlan.length = 0;
  await fabriquerCasConcret(d.options);
  const props = d.ecransSoumis().map((s) => (s.parametres as { proprietes: { id: string; planScenes?: unknown } }).proprietes);
  return { d, props, appels: [...appelsPlan] };
}
type SceneMin = { piece: string; position?: string; debutMs: number; parametres: { texte?: string; style?: string } };
type EcranMin = { id: string; planScenes?: { scenes: SceneMin[] } };
/** Les scènes « mot-clé » : légende d'un mot, en haut, style bandeau. */
const bandeaux = (props: EcranMin[]) => props.flatMap((p) => (p.planScenes?.scenes ?? []).map((s) => ({ ecran: p.id, ...s }))).filter((s) => s.piece === "legende" && s.position === "haut" && s.parametres.style === "bandeau" && !/\s/.test(s.parametres.texte ?? ""));
/** Cas du stock dont le premier écran du corps laisse 0-1,2 s libre (sonde sur la vraie fabrication). */
const CAS_PLACE_LIBRE = "contact-vers-crm";

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
    const cas = trouverCas(x.d.options.entrees.casId as string)!;
    for (const a of x.appels) {
      expect(a.motCle).toEqual({ actif: true, sujet: cas.titre || cas.theme || cas.promesse, motsInterdits: [cas.mot] });
    }
  });
  it("(b) motCle:false éteint : aucune clé, aucun bandeau, alors que le même cas allumé en reçoit un", async () => {
    const x = await fabriquer({ motCle: false }, true, CAS_PLACE_LIBRE);
    expect(x.appels.length).toBeGreaterThan(0);
    for (const a of x.appels) expect(Object.keys(a)).not.toContain("motCle");
    expect(bandeaux(x.props as EcranMin[])).toHaveLength(0);
    const allume = await fabriquer({}, true, CAS_PLACE_LIBRE);
    expect(bandeaux(allume.props as EcranMin[]).length).toBeGreaterThan(0);
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
  it("(e) bandeau (vraie fabrication, plan du stock, sans Claude) : un seul mot en haut, au début du corps ; rien dans les fins ; appels Claude identiques à (b)", async () => {
    const x = await fabriquer({}, true, CAS_PLACE_LIBRE);
    const e = new Set(bandeaux(x.props as EcranMin[]).map((s) => `${s.parametres.texte}`));
    const b = bandeaux(x.props as EcranMin[]);
    expect(e.size).toBe(1);
    // une scène à cheval sur deux écrans apparaît dans deux tranches : toutes les tranches sont dans les premiers écrans du corps
    expect(b.every((s) => ["e01", "e02"].includes(s.ecran))).toBe(true);
    expect(b[0]!.ecran).toBe("e01");
    expect(b[0]!.debutMs).toBeLessThan(3000);
    const eteint = await fabriquer({ motCle: false }, true, CAS_PLACE_LIBRE);
    expect(x.d.appelsEcriture()).toBe(eteint.d.appelsEcriture());
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
  it("(h) objets permis : les scènes objet du corps sont IDENTIQUES mot-clé allumé / éteint (seule la légende du mot-clé s'ajoute)", async () => {
    const permis = ["objet-gros-chiffre", "objet-coche", "carte-kpi"];
    const sur = async (extra: Record<string, unknown>) => {
      const d = doubles();
      d.options.planScenes = {};
      d.options.scriptValide = { ...SCRIPT_V4_RECRUTEMENT, ecrans: SCRIPT_V4_RECRUTEMENT.ecrans.map((e, i) => (i === 1 ? { ...e, texteDit: `${e.texteDit.trim()} On gagne 3 heures par semaine. C'est fait.` } : e)) };
      Object.assign(d.options, { objetsPermis: permis }, extra);
      await fabriquerCasConcret(d.options);
      return d.ecransSoumis().map((x) => (x.parametres as { proprietes: EcranMin }).proprietes);
    };
    const [on, off] = [await sur({}), await sur({ motCle: false })];
    const objets = (props: EcranMin[]) => JSON.stringify(props.map((p) => [p.id, (p.planScenes?.scenes ?? []).filter((s) => s.piece.startsWith("objet-")).map((s) => ({ piece: s.piece, debutMs: s.debutMs, finMs: (s as unknown as { finMs: number }).finMs, parametres: s.parametres }))]));
    expect(objets(off)).toContain("objet-gros-chiffre");
    expect(bandeaux(on).length).toBeGreaterThan(0);
    expect(objets(on)).toBe(objets(off));
  });
});
