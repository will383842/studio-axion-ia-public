import { describe, expect, it, vi } from "vitest";
import { empreinteScene } from "@/briques/plan-scenes/empreinte";
import { planVideoLongue, type ChapitrePourPlan, type PlanChapitre } from "@/moteurs/montage-video-longue/plan";
import { COURTS_MAX, DIMENSIONS_COURT, planDuCourt, preparerCourts, proposerCourts } from "@/moteurs/montage-video-longue/courts";

const T = (n: number) => `Étape ${n} : ouvrez les réglages, puis cliquez sur le bouton Enregistrer pour garder 42 % de temps.`;
const ch = (i: number, debutMs: number, finMs: number): ChapitrePourPlan => ({ id: `c${i}`, segments: [{ texte: T(i), debutMs, finMs }] });
const CHAPITRES = [ch(1, 0, 50_000), ch(2, 50_000, 100_000), ch(3, 100_000, 160_000), ch(4, 160_000, 190_000)];

async function plans(): Promise<PlanChapitre[]> {
  const r = await planVideoLongue(CHAPITRES);
  expect(r.valide).toBe(true);
  return r.chapitres;
}

describe("courts tirés des chapitres", () => {
  it("propose un court par chapitre, TOUS décochés, avec remarque hors 45-70 s (jamais un refus)", async () => {
    const { courts } = proposerCourts(await plans());
    expect(courts.map((c) => c.chapitreId)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(courts.every((c) => c.choisi === false)).toBe(true);
    expect(courts[0].remarques).toEqual([]);
    expect(courts[3].remarques.join(" ")).toMatch(/court/);
    expect(courts.every((c) => c.possible || c.remarques.length)).toBe(true);
  });

  it("sans accord du lot, rien n'est fabriqué", async () => {
    const r = preparerCourts({ chapitres: await plans(), choisis: ["c1", "c2"], ratio: "9:16", accordLot: false });
    expect(r.courts).toEqual([]);
    expect(r.quantite).toBe(0);
    expect(r.remarques.join(" ")).toMatch(/accord/);
  });

  it("rien de coché = rien à faire, même avec l'accord", async () => {
    const r = preparerCourts({ chapitres: await plans(), choisis: [], ratio: "9:16", accordLot: true });
    expect(r.quantite).toBe(0);
  });

  it.each(["9:16", "4:5", "1:1"] as const)("refait les scènes au format %s, recalées sur 0, contenu inchangé", async (ratio) => {
    const p = await plans();
    const r = preparerCourts({ chapitres: p, choisis: ["c2"], ratio, accordLot: true });
    expect(r.quantite).toBe(1);
    const plan = r.courts[0].plan;
    expect(plan.format).toEqual(DIMENSIONS_COURT[ratio]);
    expect(plan.dureeMs).toBe(50_000);
    for (const s of plan.scenes) {
      expect(s.debutMs).toBeGreaterThanOrEqual(0);
      expect(s.finMs).toBeLessThanOrEqual(50_000);
    }
    // le plan source n'est pas modifié
    expect(p[1].plan?.format).toMatchObject({ largeur: 1920, hauteur: 1080 });
    expect(p[1].plan?.scenes[0].debutMs).toBeGreaterThanOrEqual(50_000);
    // le contenu des scènes (pièces, textes) est celui du chapitre
    expect(plan.scenes.map((s) => s.piece)).toEqual(p[1].plan!.scenes.filter((s) => s.finMs - 50_000 > 0).map((s) => s.piece));
  });

  it("n'écrit aucune phrase : celles de l'utilisateur seulement, les vides sont ignorées", async () => {
    const p = await plans();
    const sans = preparerCourts({ chapitres: p, choisis: ["c1"], ratio: "9:16", accordLot: true });
    expect(sans.courts[0]).not.toHaveProperty("ouverture");
    expect(sans.courts[0]).not.toHaveProperty("fin");
    const avec = preparerCourts({ chapitres: p, choisis: ["c1", "c2"], ratio: "9:16", accordLot: true, phrases: { c1: { ouverture: "  Voici l'essentiel.  ", fin: "   " } } });
    expect(avec.courts[0].ouverture).toBe("Voici l'essentiel.");
    expect(avec.courts[0]).not.toHaveProperty("fin");
    expect(avec.courts[1]).not.toHaveProperty("ouverture");
  });

  it("au plus 5 courts, sans doublon ; chapitre inconnu laissé de côté avec remarque", async () => {
    const p = await plans();
    const r = preparerCourts({ chapitres: p, choisis: ["c1", "c1", "zz", "c2", "c3", "c4", "c1"], ratio: "4:5", accordLot: true });
    expect(r.courts.map((c) => c.chapitreId)).toEqual(["c1", "c2", "c3", "c4"]);
    expect(r.remarques.join(" ")).toMatch(/zz/);
    expect(COURTS_MAX).toBe(5);
  });

  it("chapitre sans plan : pas un court", () => {
    const vide: PlanChapitre = { id: "v", debutMs: 0, finMs: 50_000, plan: null, remarques: [], jetonsEstimes: 0 };
    expect(planDuCourt(vide, "9:16")).toBeNull();
    expect(proposerCourts([vide]).courts[0].possible).toBe(false);
    expect(preparerCourts({ chapitres: [vide], choisis: ["v"], ratio: "9:16", accordLot: true }).quantite).toBe(0);
  });

  it("aucun appel réseau, aucun format inconnu accepté", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const p = await plans();
    preparerCourts({ chapitres: p, choisis: ["c1"], ratio: "9:16", accordLot: true });
    // @ts-expect-error format hors liste
    const mauvais = preparerCourts({ chapitres: p, choisis: ["c1"], ratio: "16:9", accordLot: true });
    vi.unstubAllGlobals();
    expect(f).not.toHaveBeenCalled();
    expect(mauvais.quantite).toBe(0);
  });

  it.each(["9:16", "4:5", "1:1"] as const)("empreintes recalculées au format %s : celles du plan du court, pas celles du 16:9", async (ratio) => {
    const p = await plans();
    const r = preparerCourts({ chapitres: p, choisis: ["c2"], ratio, accordLot: true });
    const plan = r.courts[0].plan;
    const origine = p[1].plan!;
    expect(plan.scenes.length).toBeGreaterThan(0);
    for (const s of plan.scenes) {
      expect(s.empreinte).toBe(empreinteScene(s, plan));
      expect(origine.scenes.map((o) => o.empreinte)).not.toContain(s.empreinte);
    }
  });

  it("plus de 5 chapitres possibles : une remarque « 5 au plus » dès la proposition", async () => {
    const huit = Array.from({ length: 8 }, (_, i) => ch(i + 1, i * 50_000, (i + 1) * 50_000));
    const r = await planVideoLongue(huit);
    const { courts, remarques } = proposerCourts(r.chapitres);
    expect(courts).toHaveLength(8);
    expect(courts.every((c) => c.choisi === false)).toBe(true);
    expect(remarques.join(" ")).toMatch(/Au plus 5 courts à la fois/);
    expect(proposerCourts(r.chapitres.slice(0, 5)).remarques.join(" ")).not.toMatch(/Au plus/);
  });
});
