/**
 * GV2-43 — plan de scènes du stock réparé : une scène seulement là où le script donne un fait,
 * plus de fragments de phrase, plus de chiffres hors sujet. Aucun fournisseur, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { faitsDuScript } from "../../../src/briques/faits-script";
import { parametresDepuisTexte } from "../../../src/briques/plan-scenes/validateur";
import { planPourVideo, segmenterEnPhrases } from "../../../src/briques/plan-scenes-generateurs/video";
import type { MotEnSecondes } from "../../../src/briques/plan-scenes-generateurs/video";
import type { PlanValide } from "../../../src/briques/plan-scenes/schema";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
const LIAISONS = ["de", "à", "par", "le", "la", "et", "du", "des", "les", "un", "une", "en", "pour"];

function enSecondes(script: string): MotEnSecondes[] {
  return motsHorodates(script).map((m) => ({ texte: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 }));
}
async function planDe(script: string, facecam = true) {
  const mots = enSecondes(script);
  const r = await planPourVideo({ generateur: "facecam", mots, dureeSec: mots.at(-1)!.finSec + 1, facecam, format: FORMAT });
  return r.plan;
}
/** Tous les textes affichés par une scène (tous les champs texte des paramètres). */
function textesAffiches(p: unknown): string[] {
  if (typeof p === "string") return [p];
  if (Array.isArray(p)) return p.flatMap(textesAffiches);
  if (p && typeof p === "object") return Object.entries(p).filter(([k]) => k !== "unite" && k !== "genre").flatMap(([, v]) => textesAffiches(v));
  return [];
}
const motsDeLaScene = (plan: PlanValide, s: PlanValide["scenes"][number]) => plan.mots.slice(s.mots.premier, s.mots.dernier + 1);

describe("stock réparé : dix scripts", () => {
  it("aucune légende d'un seul mot, aucun texte affiché qui finit par une liaison", async () => {
    for (const script of DIX_SCRIPTS) {
      const plan = await planDe(script);
      for (const s of plan?.scenes ?? []) {
        if (s.piece === "legende") expect(((s.parametres as { texte: string }).texte).split(/\s+/).length).toBeGreaterThan(1);
        for (const t of textesAffiches(s.parametres)) {
          const dernier = t.trim().toLowerCase().replace(/[.,;:!?…]+$/, "").split(/[\s']+/).at(-1) ?? "";
          expect(LIAISONS).not.toContain(dernier);
        }
      }
    }
  });

  it("script 7 : aucune scène n'affiche « 2026 »", async () => {
    const plan = await planDe(DIX_SCRIPTS[6]!);
    expect(JSON.stringify(plan?.scenes ?? [])).not.toContain("2026");
  });

  it("script 5 : la scène du 30 % ne porte pas « hausse »", async () => {
    const plan = await planDe(DIX_SCRIPTS[4]!);
    const s = plan!.scenes.find((x) => JSON.stringify(x.parametres).includes("30"))!;
    expect(s).toBeDefined();
    expect(JSON.stringify(s)).not.toContain("hausse");
  });

  it("script 1 : une scène avant-apres 2 h → 20 min et une scène etapes à 3 éléments", async () => {
    const plan = await planDe(DIX_SCRIPTS[0]!);
    const aa = plan!.scenes.find((s) => s.piece === "avant-apres")!;
    const p = aa.parametres as { avant: { valeur: number; unite: string }; apres: { valeur: number; unite: string } };
    expect([p.avant.valeur, p.avant.unite, p.apres.valeur, p.apres.unite]).toEqual([2, "h", 20, "min"]);
    const et = plan!.scenes.find((s) => s.piece === "etapes")!;
    expect((et.parametres as { elements: unknown[] }).elements).toHaveLength(3);
  });

  it("tout nombre affiché dans une scène est un nombre dit dans les mots de la scène", async () => {
    for (const script of DIX_SCRIPTS) {
      const plan = await planDe(script);
      for (const s of plan?.scenes ?? []) {
        const dits = faitsDuScript(motsDeLaScene(plan!, s)).flatMap((f) => (f.type === "nombre" ? [f.valeur] : f.type === "passage" ? [f.avant.valeur, f.apres.valeur] : []));
        const p = s.parametres as Record<string, unknown>;
        const affiches: number[] = [];
        if (typeof p.valeur === "number") affiches.push(p.valeur);
        for (const k of ["avant", "apres"]) if (p[k]) affiches.push((p[k] as { valeur: number }).valeur);
        for (const v of affiches) expect(dits).toContain(v);
      }
    }
  });

  it("une scène par fait, posée sur les mots du fait, dans l'ordre et sans chevauchement", async () => {
    for (const script of DIX_SCRIPTS) {
      const plan = await planDe(script);
      const mots = plan?.mots ?? [];
      let fin = 0;
      for (const s of plan?.scenes ?? []) {
        expect(s.debutMs).toBe(mots[s.mots.premier]!.debutMs);
        expect(s.finMs).toBeGreaterThanOrEqual(mots[s.mots.dernier]!.finMs);
        expect(s.finMs - mots[s.mots.dernier]!.finMs).toBeLessThanOrEqual(1200);
        expect(s.debutMs).toBeGreaterThanOrEqual(fin);
        fin = s.finMs;
      }
    }
  });

  it("scripts 6 et 10 (aucun fait) : aucune scène, plan nul", async () => {
    expect(await planDe(DIX_SCRIPTS[5]!)).toBeNull();
    expect(await planDe(DIX_SCRIPTS[9]!)).toBeNull();
  });

  it("un script sans aucun fait donne plan: null", async () => {
    expect(await planDe("Bonjour à tous, merci d'être là.")).toBeNull();
  });

  it("face caméra : alternance bas / haut, transitions en suite déterministe, jamais devant le visage", async () => {
    const plan = await planDe(DIX_SCRIPTS[4]!);
    const positions = plan!.scenes.map((s) => s.position);
    expect(positions.length).toBeGreaterThan(1);
    positions.forEach((p, i) => expect(p).toBe(i % 2 === 0 ? "bas" : "haut"));
    expect(plan!.scenes.map((s) => s.transition.entree)).toEqual(plan!.scenes.map((_, i) => (["fondu", "glisse-haut", "zoom-doux"] as const)[i % 3]));
  });

  it("même entrée, même plan (empreintes identiques)", async () => {
    for (const script of DIX_SCRIPTS) {
      const a = await planDe(script);
      const b = await planDe(script);
      expect(a?.scenes.map((s) => s.empreinte)).toEqual(b?.scenes.map((s) => s.empreinte));
    }
  });
});

describe("parametresDepuisTexte (carte KPI)", () => {
  const kpi = (t: string) => parametresDepuisTexte("carte-kpi", t) as { libelle: string; valeur: number; tendance: string };
  it("saute une année seule, coupe le libellé à la fin d'un mot, lit la tendance", () => {
    expect(kpi("Faut-il un site internet en 2026 ?").valeur).toBe(0);
    expect(kpi("En 2026 on gagne 12 clients").valeur).toBe(12);
    const long = kpi("Une phrase très longue qui dépasse largement les quarante caractères permis 25 %");
    expect(long.libelle.length).toBeLessThanOrEqual(40);
    expect("Une phrase très longue qui dépasse largement les quarante caractères permis").toContain(long.libelle);
    expect(long.libelle.endsWith(" ")).toBe(false);
    expect(kpi("a réduit son gaspillage de 30 %").tendance).toBe("baisse");
    expect(kpi("on gagne 30 % de devis").tendance).toBe("hausse");
    expect(kpi("il y a 30 devis").tendance).toBe("stable");
  });
});

describe("segmenterEnPhrases", () => {
  const mots = (n: number, virgules: number[] = [], fort: number[] = []) =>
    Array.from({ length: n }, (_, i) => ({ texte: `m${i}${fort.includes(i) ? "." : virgules.includes(i) ? "," : ""}`, debutMs: i * 100, finMs: i * 100 + 100 }));
  it("ne coupe plus tous les 12 mots", () => {
    expect(segmenterEnPhrases(mots(25))).toHaveLength(1);
    expect(segmenterEnPhrases(mots(25, [], [9]))).toHaveLength(2);
  });
  it("au-delà de 30 mots, coupe à la virgule la plus proche", () => {
    const s = segmenterEnPhrases(mots(40, [5, 28, 35]));
    expect(s).toHaveLength(2);
    expect(s[0]!.mots).toHaveLength(29);
    expect(segmenterEnPhrases(mots(40))).toHaveLength(1);
  });
});
