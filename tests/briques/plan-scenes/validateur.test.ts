/* eslint-disable @typescript-eslint/no-explicit-any -- plans volontairement abîmés pour éprouver le validateur */
import { describe, expect, it } from "vitest";
import { validerPlan, CODE_LIBRE_ACTIF } from "@/briques/plan-scenes/validateur";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { schemaPlanStrict } from "@/briques/plan-scenes/schema";

const copie = () => structuredClone(PLAN_DEMO) as unknown as Record<string, any>;

describe("validateur du plan : remarques et réparation par repli, jamais de refus", () => {
  it("un plan juste passe sans remarque, empreintes posées", () => {
    const r = validerPlan(PLAN_DEMO);
    expect(r.remarques).toEqual([]);
    expect(r.plan.scenes.every((s) => /^[0-9a-f]{16}$/.test(s.empreinte))).toBe(true);
    expect(schemaPlanStrict.safeParse(r.plan).success).toBe(true);
  });

  it("n'importe quoi en entrée : un plan de repli rendable et une remarque", () => {
    for (const brut of [null, 42, "texte", { scenes: "non" }]) {
      const r = validerPlan(brut);
      expect(schemaPlanStrict.safeParse(r.plan).success).toBe(true);
      expect(r.remarques.length).toBeGreaterThan(0);
    }
  });

  it("durées liées aux mots : début/fin recalés sur le minutage, remarque", () => {
    const p = copie();
    p.scenes[0].debutMs = 900;
    p.scenes[0].finMs = 100;
    const r = validerPlan(p);
    const s = r.plan.scenes[0]!;
    expect(s.debutMs).toBe(PLAN_DEMO.mots[s.mots.premier]!.debutMs);
    expect(s.finMs).toBeGreaterThan(s.debutMs);
    expect(r.remarques.some((m) => m.code === "DUREE_RECALEE" && m.sceneId === s.id)).toBe(true);
  });

  it("scènes qui se chevauchent : la suivante commence après, remarque", () => {
    const p = copie();
    p.scenes[1].mots = { ...p.scenes[0].mots };
    const r = validerPlan(p);
    expect(r.plan.scenes[1]!.debutMs).toBeGreaterThanOrEqual(r.plan.scenes[0]!.finMs);
    expect(r.remarques.some((m) => m.code === "CHEVAUCHEMENT")).toBe(true);
  });

  it("pièce inconnue au niveau 1 : pièce la plus proche (chiffre → carte KPI, sinon légende)", () => {
    const p = copie();
    p.scenes[0].piece = "compteur-magique";
    p.scenes[0].texte = "Plus 38 % de devis";
    const r = validerPlan(p);
    expect(r.plan.scenes[0]!.piece).toBe("carte-kpi");
    expect(r.remarques.some((m) => m.code === "PIECE_INCONNUE")).toBe(true);
    const p2 = copie();
    p2.scenes[0].piece = "rien";
    p2.scenes[0].texte = "Un mot simple";
    expect(validerPlan(p2).plan.scenes[0]!.piece).toBe("legende");
  });

  it("pièce connue par un alias proche (« kpi », « chat ») : remplacée par la vraie pièce", () => {
    const p = copie();
    p.scenes[0].piece = "kpi";
    expect(validerPlan(p).plan.scenes[0]!.piece).toBe("carte-kpi");
  });

  it("paramètres faux : champ par champ remplacé par la valeur de l'exemple, remarque", () => {
    const p = copie();
    const i = p.scenes.findIndex((s: any) => s.niveau === 1 && s.piece === "carte-kpi");
    p.scenes[i].parametres = { ...p.scenes[i].parametres, valeur: "beaucoup" };
    const r = validerPlan(p);
    expect(typeof (r.plan.scenes[i]!.parametres as { valeur: unknown }).valeur).toBe("number");
    expect((r.plan.scenes[i]!.parametres as { libelle: string }).libelle).toBe(p.scenes[i].parametres.libelle);
    expect(r.remarques.some((m) => m.code === "PARAMETRES_REPARES")).toBe(true);
  });

  it("niveau 2 entièrement invalide : repli sur la pièce niveau 1 la plus proche", () => {
    const p = copie();
    const i = p.scenes.findIndex((s: any) => s.niveau === 2);
    p.scenes[i].calques = [{ piece: "inconnue", parametres: {}, debutMs: 0 }];
    p.scenes[i].piece = "inconnue";
    const r = validerPlan(p);
    expect(r.plan.scenes[i]!.niveau).toBe(1);
    expect(r.remarques.some((m) => m.code === "REPLI_NIVEAU_1")).toBe(true);
  });

  it("niveau 2 en partie invalide : calque faux retiré, la scène reste niveau 2", () => {
    const p = copie();
    const i = p.scenes.findIndex((s: any) => s.niveau === 2);
    const avant = p.scenes[i].calques.length;
    p.scenes[i].calques.push({ piece: "inconnue", parametres: {}, debutMs: 0 });
    const r = validerPlan(p);
    expect(r.plan.scenes[i]!.niveau).toBe(2);
    expect(r.plan.scenes[i]!.calques).toHaveLength(avant);
    expect(r.remarques.some((m) => m.code === "CALQUE_RETIRE")).toBe(true);
  });

  it("niveau 3 (code libre) désactivé par défaut : repli d'un niveau, remarque", () => {
    expect(CODE_LIBRE_ACTIF).toBe(false);
    const p = copie();
    const i = p.scenes.findIndex((s: any) => s.niveau === 2);
    p.scenes[i].niveau = 3;
    p.scenes[i].code = "<div>libre</div>";
    const r = validerPlan(p);
    expect(r.plan.scenes[i]!.niveau).toBe(2);
    expect(r.plan.scenes[i]!.code).toBeUndefined();
    expect(r.remarques.some((m) => m.code === "CODE_LIBRE_DESACTIVE")).toBe(true);
  });

  it("couleur hors charte (bleu) et police autre que Manrope : remplacées, remarque", () => {
    const p = copie();
    p.scenes[0].parametres = { ...p.scenes[0].parametres, couleur: "#1E40FF", police: "Arial" };
    const r = validerPlan(p);
    const txt = JSON.stringify(r.plan);
    expect(txt).not.toContain("#1E40FF");
    expect(txt).not.toContain("Arial");
    expect(r.remarques.some((m) => m.code === "COULEUR_HORS_CHARTE")).toBe(true);
    expect(r.remarques.some((m) => m.code === "POLICE_HORS_CHARTE")).toBe(true);
  });

  it("orange demandé sur fond ivoire : terracotta à la place", () => {
    const p = copie();
    p.habillage = { ...p.habillage, fond: "ivoire", accent: "orange" };
    const r = validerPlan(p);
    expect(r.plan.habillage.accent).toBe("terracotta");
    expect(r.remarques.some((m) => m.code === "ORANGE_SUR_CLAIR")).toBe(true);
  });

  it("face caméra : une scène posée devant le visage descend en bas, remarque", () => {
    const p = copie();
    p.facecam = true;
    p.scenes[0].position = "centre";
    const r = validerPlan(p);
    expect(r.plan.scenes[0]!.position).toBe("bas");
    expect(r.remarques.some((m) => m.code === "DEVANT_LE_VISAGE")).toBe(true);
  });

  it("transition brusque ou inconnue : transition douce par défaut", () => {
    const p = copie();
    p.scenes[0].transition = { entree: "rebond", sortie: "fondu", dureeMs: 40 };
    const r = validerPlan(p);
    expect(r.plan.scenes[0]!.transition.entree).toBe("fondu");
    expect(r.plan.scenes[0]!.transition.dureeMs).toBeGreaterThanOrEqual(200);
  });

  it("ids de scène en double : renommés pour rester uniques", () => {
    const p = copie();
    p.scenes[1].id = p.scenes[0].id;
    const r = validerPlan(p);
    expect(new Set(r.plan.scenes.map((s) => s.id)).size).toBe(r.plan.scenes.length);
  });
});
