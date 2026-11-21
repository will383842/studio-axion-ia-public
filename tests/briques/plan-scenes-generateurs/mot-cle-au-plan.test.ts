/** BR-MOT-CLE-a : pose du mot-clé de recherche au plan (fonction pure, sans appelant, éteint). */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { poserMotCleAuPlan, DUREE_MOT_CLE_MS } from "@/briques/plan-scenes-generateurs/mot-cle-au-plan";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { MotMinute, PlanDeScenes } from "@/briques/plan-scenes/schema";

const SUJET = "relancer un devis";
const mot = (texte: string, debutMs: number, finMs = debutMs + 350): MotMinute => ({ texte, debutMs, finMs });
const MOTS: MotMinute[] = [mot("Voici", 0), mot("comment", 400), mot("relancer", 800), mot("un", 1200), mot("devis", 1600), mot("sans", 2000), mot("stress", 2400), mot("et", 6000), mot("voilà", 6400)];
const legende = (id: string, debutMs: number, finMs: number, premier: number, dernier: number, texte = "Un fragment utile"): PlanDeScenes["scenes"][number] =>
  ({ id, version: 1, mots: { premier, dernier }, debutMs, finMs, niveau: 1, position: "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 300 }, piece: "legende", parametres: { texte, sousTexte: "", style: "bandeau" } }) as never;
const plan = (scenes: PlanDeScenes["scenes"] = [legende("a", 4000, 6000, 7, 8, "Voilà le résultat")], mots = MOTS): PlanDeScenes => ({
  version: "plan-scenes-1",
  format: { largeur: 1080, hauteur: 1920, fps: 25 },
  facecam: false,
  dureeMs: 9000,
  habillage: { fond: "ivoire", accent: "terracotta" },
  mots,
  scenes,
});
const ajoutee = (avant: PlanDeScenes, apres: PlanDeScenes) => apres.scenes.filter((s) => !avant.scenes.some((x) => x.id === s.id));

describe("BR-MOT-CLE-a · poserMotCleAuPlan", () => {
  it("rien à poser (sujet sans mot commun) : le MÊME objet", () => {
    const p = plan();
    expect(poserMotCleAuPlan(p, MOTS, "gestion de trésorerie")).toBe(p);
    expect(poserMotCleAuPlan(p, [], SUJET)).toBe(p);
  });
  it("mot posé : de debutMs à finMs, en haut, étiquette, un seul mot, recopié tel que dit", () => {
    const p = plan();
    const r = poserMotCleAuPlan(p, MOTS, SUJET);
    const [s] = ajoutee(p, r);
    expect(r).not.toBe(p);
    expect(s).toBeDefined();
    expect(s!.piece).toBe("legende");
    expect(s!.position).toBe("haut");
    expect(s!.parametres).toEqual({ texte: "relancer", sousTexte: "", style: "etiquette" });
    expect(s!.debutMs).toBe(800);
    expect(s!.finMs - s!.debutMs).toBeGreaterThanOrEqual(DUREE_MOT_CLE_MS);
    expect(s!.mots).toEqual({ premier: 2, dernier: 2 });
    expect(p.scenes).toHaveLength(1);
  });
  it("une scène existante entre 0 et 3 s : sortie identique (même objet)", () => {
    const p = plan([legende("a", 500, 2500, 0, 4, "Voici comment relancer un devis")]);
    expect(poserMotCleAuPlan(p, MOTS, SUJET)).toBe(p);
  });
  it("argent, chiffre, mot outil, mot interdit, mot à commenter : rien", () => {
    const p = plan();
    expect(poserMotCleAuPlan(p, [mot("prix", 500), mot("devis", 900)].concat(MOTS.slice(3)), "prix")).toBe(p);
    expect(poserMotCleAuPlan(p, [mot("2026", 500)], "2026 devis")).toBe(p);
    expect(poserMotCleAuPlan(p, [mot("avec", 500)], "avec devis")).toBe(p);
    expect(poserMotCleAuPlan(p, [mot("devis", 500)], "devis", ["devis"])).toBe(p);
    expect(poserMotCleAuPlan(p, [mot("relancer", 800)], SUJET, ["relancer"])).toBe(p);
  });
  it("moins de 1200 ms disponibles avant la scène suivante : rien", () => {
    const p = plan([legende("a", 1500, 3000, 3, 6, "devis sans stress")]);
    expect(poserMotCleAuPlan(p, MOTS, SUJET)).toBe(p);
  });
  it("mot de plus de 24 lettres : rien", () => {
    const long = "anticonstitutionnellement";
    const p = plan();
    expect(poserMotCleAuPlan(p, [mot(long, 500), ...MOTS.slice(1)], long)).toBe(p);
  });
  it("le plan sorti passe validerPlan sans TROP_COURT, LITTERALITE ni CHEVAUCHEMENT", () => {
    const p = plan();
    const r = poserMotCleAuPlan(p, MOTS, SUJET);
    expect(r).not.toBe(p);
    const v = validerPlan(r, { mots: MOTS, format: p.format, facecam: false, dureeMs: p.dureeMs });
    const codes = v.remarques.map((x) => x.code as string);
    for (const c of ["TROP_COURT", "LITTERALITE", "CHEVAUCHEMENT"]) expect(codes).not.toContain(c);
    expect(v.plan.scenes.some((s) => s.piece === "legende" && (s.parametres as { texte?: string }).texte === "relancer")).toBe(true);
  });
  it("ne lève jamais (entrées absurdes) ; ne lit pas la constante MOT_CLE_RECHERCHE_ACTIF ; aucun importeur", () => {
    const p = plan();
    expect(poserMotCleAuPlan(p, null as never, SUJET)).toBe(p);
    expect(poserMotCleAuPlan(null as never, MOTS, SUJET)).toBeNull();
    expect(poserMotCleAuPlan(p, MOTS, undefined as never)).toBe(p);
    const src = readFileSync("src/briques/plan-scenes-generateurs/mot-cle-au-plan.ts", "utf8");
    expect(src).not.toMatch(/MOT_CLE_RECHERCHE_ACTIF[^\n]*(if|\?|&&)/);
    expect(src.replace(/\/\*[\s\S]*?\*\//, "")).not.toContain("MOT_CLE_RECHERCHE_ACTIF");
  });
});
