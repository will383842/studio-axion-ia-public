/** C5-5.07 · filtre pur du plan face caméra (non branché). Mêmes mots et mêmes 4 formats que le constat C5-5.01. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bandeSousTitres, filtrerPlanFacecam } from "@/briques/plan-scenes-generateurs/dessin-facecam";
import { planPourVideo, type MotEnSecondes } from "@/briques/plan-scenes-generateurs/video";
import type { FormatPlan, PlanValide } from "@/briques/plan-scenes/schema";
import { ZONES } from "@/briques/plan-scenes/zones";

const SCRIPT =
  "Aujourd'hui je vous montre comment j'ai généré 12 000 euros de chiffre d'affaires en 30 jours. Ouvrez l'application, cliquez sur le bouton Nouveau projet puis choisissez le modèle. Résultat : 87 % de clients satisfaits et 3 fois plus de demandes.";
const MOTS: MotEnSecondes[] = SCRIPT.split(" ").map((texte, i) => ({ texte, debutSec: i * 0.4, finSec: i * 0.4 + 0.35 }));
const DUREE_SEC = MOTS.length * 0.4 + 0.5;
const FORMATS: { ratio: "9:16" | "1:1" | "4:5" | "16:9"; format: FormatPlan }[] = [
  { ratio: "9:16", format: { largeur: 1080, hauteur: 1920, fps: 25 } },
  { ratio: "1:1", format: { largeur: 1080, hauteur: 1080, fps: 25 } },
  { ratio: "4:5", format: { largeur: 1080, hauteur: 1350, fps: 25 } },
  { ratio: "16:9", format: { largeur: 1920, hauteur: 1080, fps: 25 } },
];

async function planFacecam(format: FormatPlan): Promise<PlanValide> {
  const m = await planPourVideo({ generateur: "facecam", mots: MOTS, dureeSec: DUREE_SEC, facecam: true, format });
  if (!m.plan) throw new Error("plan absent");
  return m.plan;
}

describe("C5-5.07 · filtrerPlanFacecam", () => {
  for (const { ratio, format } of FORMATS) {
    it(`${ratio} : la pièce « bas » est retirée (sous-titres), les autres restent`, async () => {
      const plan = await planFacecam(format);
      const bande = bandeSousTitres(ratio, format);
      const r = filtrerPlanFacecam(plan, { bande });
      const bas = plan.scenes.filter((s) => s.position === "bas");
      expect(bas.length).toBe(1);
      expect(r.retirees).toEqual([{ id: bas[0].id, raison: "sous-titres" }]);
      expect(r.plan.scenes.map((s) => s.id)).toEqual(plan.scenes.filter((s) => s.position !== "bas").map((s) => s.id));
      // Nombre de pièces restantes par vidéo (à reporter au journal) ; < 1 = question à Williams.
      console.info(`C5-5.07 ${ratio} : ${r.plan.scenes.length} pièce(s) restante(s) sur ${plan.scenes.length}`);
      expect(r.plan.scenes.length).toBeGreaterThanOrEqual(1);
    });
  }

  it("plan sans conflit → identique, rien de retiré", async () => {
    const plan = await planFacecam(FORMATS[0].format);
    const sans = { ...plan, scenes: plan.scenes.filter((s) => s.position !== "bas") };
    const r = filtrerPlanFacecam(sans, { bande: bandeSousTitres("9:16", FORMATS[0].format) });
    expect(r.plan).toEqual(sans);
    expect(r.retirees).toEqual([]);
  });

  it("une carte sur [2 s ; 4 s] retire la pièce qui la chevauche (raison « carte »)", async () => {
    const plan = await planFacecam(FORMATS[0].format);
    // Bande neutre (ne coupe aucune zone) : seule la carte peut retirer une pièce.
    const bande = { x: 0, y: 99, largeur: 100, hauteur: 1 };
    const cible = plan.scenes.find((s) => s.debutMs < 4000 && s.finMs > 2000);
    expect(cible).toBeDefined();
    const r = filtrerPlanFacecam(plan, { bande, occupes: [{ debutSec: 2, finSec: 4 }] });
    expect(r.retirees).toEqual([{ id: cible!.id, raison: "carte" }]);
    expect(r.plan.scenes.map((s) => s.id)).toEqual(plan.scenes.filter((s) => s.id !== cible!.id).map((s) => s.id));
  });

  it("cas limite : une pièce seulement adjacente à la carte n'est pas retirée", async () => {
    const plan = await planFacecam(FORMATS[0].format);
    const bande = { x: 0, y: 99, largeur: 100, hauteur: 1 };
    const s0 = plan.scenes[0];
    const apres = { ...plan, scenes: [{ ...s0, debutMs: 2000, finMs: 3000 }] };
    // La carte finit exactement quand la pièce commence, et commence exactement quand elle finit.
    expect(filtrerPlanFacecam(apres, { bande, occupes: [{ debutSec: 1, finSec: 2 }] }).retirees).toEqual([]);
    expect(filtrerPlanFacecam(apres, { bande, occupes: [{ debutSec: 3, finSec: 4 }] }).retirees).toEqual([]);
    expect(filtrerPlanFacecam(apres, { bande, occupes: [{ debutSec: 2.5, finSec: 4 }] }).retirees).toEqual([{ id: s0.id, raison: "carte" }]);
  });

  it("une pièce devant le visage est retirée (raison « visage »)", async () => {
    const plan = await planFacecam(FORMATS[0].format);
    const s0 = { ...plan.scenes[0], position: "centre" as const };
    const r = filtrerPlanFacecam({ ...plan, scenes: [s0] }, { bande: { x: 0, y: 99, largeur: 100, hauteur: 1 } });
    expect(ZONES.centre.y).toBeLessThan(56);
    expect(r.retirees).toEqual([{ id: s0.id, raison: "visage" }]);
  });

  it("pur : n'importe ni studio-rendu ni @/services/", () => {
    const src = readFileSync(join(__dirname, "../../../src/briques/plan-scenes-generateurs/dessin-facecam.ts"), "utf8");
    expect(src).not.toMatch(/studio-rendu|@\/services\//);
  });
});
